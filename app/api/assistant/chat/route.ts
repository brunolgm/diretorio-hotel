import { NextResponse, type NextRequest } from 'next/server';
import {
  ASSISTANT_CHAT_ANALYTICS,
  ASSISTANT_CHAT_LIMITS,
  AssistantChatExecutionError,
  runAssistantChat,
  validateAssistantChatPayload,
} from '@/lib/assistant-chat';
import { getPublicHotelPageDataBySlug } from '@/lib/public-hotel-data';
import { isJsonContentType, readUtf8BodyWithLimit } from '@/lib/security/http';
import {
  createGptMakerClassifierClientFromEnvironment,
  createGptMakerClientFromEnvironment,
  GptMakerError,
} from '@/lib/server/gptmaker-client';
import {
  consumeAssistantRateLimit,
  resolveAssistantClientIp,
} from '@/lib/server/assistant-rate-limit';
import { classifyAssistantMessage } from '@/lib/server/assistant-classifier';
import {
  clampAssistantAnalyticsLatency,
  recordAssistantAnalyticsEvent,
  type AssistantAnalyticsEventInput,
} from '@/lib/server/assistant-analytics';

const SAFE_ERROR = { error: 'assistant_unavailable' } as const;

function elapsedSince(startedAt: number) {
  return clampAssistantAnalyticsLatency(performance.now() - startedAt);
}

function recordFinalEvent(event: AssistantAnalyticsEventInput) {
  // Deliberately detached: analytics must never delay or alter the guest response.
  void recordAssistantAnalyticsEvent(event);
}

export async function POST(request: NextRequest) {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return NextResponse.json(SAFE_ERROR, { status: 415 });
  }

  const body = await readUtf8BodyWithLimit(request, ASSISTANT_CHAT_LIMITS.bodyBytes);
  if (!body.ok) {
    return NextResponse.json(SAFE_ERROR, {
      status: body.reason === 'too_large' ? 413 : 400,
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(body.text) as unknown;
  } catch {
    return NextResponse.json(SAFE_ERROR, { status: 400 });
  }

  const validation = validateAssistantChatPayload(json);
  if (!validation.ok) {
    return NextResponse.json(SAFE_ERROR, { status: 400 });
  }

  const processingStartedAt = performance.now();
  const occurredAt = new Date().toISOString();

  const clientIp = resolveAssistantClientIp(request.headers);
  const rateLimit = await consumeAssistantRateLimit({
    hotelSlug: validation.value.hotelSlug,
    ip: clientIp,
    contextId: validation.value.contextId,
  });
  if (!rateLimit.allowed) {
    recordFinalEvent({
      occurredAt,
      hotelScope: { kind: 'unattributed' },
      language: validation.value.language,
      assistantRoute: 'deterministic',
      resolutionPath: 'deterministic',
      outcome: 'rate_limited',
      capability: null,
      housekeepingRequestType: null,
      actionType: null,
      tourismSource: null,
      classifierIntent: null,
      classifierConfidenceBand: null,
      classifierCalls: 0,
      fullAiCalls: 0,
      totalUpstreamCalls: 0,
      totalLatencyMs: elapsedSince(processingStartedAt),
      classifierLatencyMs: null,
      fullAiLatencyMs: null,
    });
    return NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const classifierClient = createGptMakerClassifierClientFromEnvironment();
    const result = await runAssistantChat(validation.value, {
      getPageDataBySlug: getPublicHotelPageDataBySlug,
      createClient: createGptMakerClientFromEnvironment,
      ...(classifierClient
        ? {
            classifyMessage(message: string, guestContextId: string) {
              return classifyAssistantMessage(message, guestContextId, {
                createClient: () => classifierClient,
              });
            },
          }
        : {}),
    });

    if (!result) {
      recordFinalEvent({
        occurredAt,
        hotelScope: { kind: 'unattributed' },
        language: validation.value.language,
        assistantRoute: 'deterministic',
        resolutionPath: 'deterministic',
        outcome: 'hotel_unavailable',
        capability: null,
        housekeepingRequestType: null,
        actionType: null,
        tourismSource: null,
        classifierIntent: null,
        classifierConfidenceBand: null,
        classifierCalls: 0,
        fullAiCalls: 0,
        totalUpstreamCalls: 0,
        totalLatencyMs: elapsedSince(processingStartedAt),
        classifierLatencyMs: null,
        fullAiLatencyMs: null,
      });
      return NextResponse.json(SAFE_ERROR, { status: 404 });
    }
    const analytics = result[ASSISTANT_CHAT_ANALYTICS];
    const { assistantRoute, usageTrace } = result;
    recordFinalEvent({
      occurredAt,
      hotelScope: analytics
        ? { kind: 'resolved', hotelId: analytics.hotelId }
        : { kind: 'unattributed' },
      language: result.responseLanguage,
      assistantRoute,
      resolutionPath: usageTrace.resolutionPath,
      outcome: analytics?.privacyBlocked
        ? 'privacy_blocked'
        : 'success',
      capability: analytics?.capability ?? null,
      housekeepingRequestType: analytics?.housekeepingRequestType ?? null,
      actionType: result.action?.type ?? null,
      tourismSource: result.recommendationSource ?? null,
      classifierIntent: analytics?.classifierIntent ?? null,
      classifierConfidenceBand: analytics?.classifierConfidenceBand ?? null,
      classifierCalls: usageTrace.classifierCalls,
      fullAiCalls: usageTrace.fullAiCalls,
      totalUpstreamCalls: usageTrace.totalUpstreamCalls,
      totalLatencyMs: elapsedSince(processingStartedAt),
      classifierLatencyMs: analytics?.classifierLatencyMs === null ||
        analytics?.classifierLatencyMs === undefined
        ? null
        : clampAssistantAnalyticsLatency(analytics.classifierLatencyMs),
      fullAiLatencyMs: analytics?.fullAiLatencyMs === null ||
        analytics?.fullAiLatencyMs === undefined
        ? null
        : clampAssistantAnalyticsLatency(analytics.fullAiLatencyMs),
    });
    return NextResponse.json({
      answer: result.answer,
      action: result.action,
      pendingRequest: result.pendingRequest,
      responseLanguage: result.responseLanguage,
    });
  } catch (caught) {
    if (caught instanceof AssistantChatExecutionError) {
      const error = caught.upstreamCause;
      const outcome = error instanceof GptMakerError && error.kind === 'invalid_response'
        ? 'invalid_upstream_response'
        : 'assistant_failed';
      recordFinalEvent({
        occurredAt,
        hotelScope: { kind: 'resolved', hotelId: caught.analytics.hotelId },
        language: validation.value.language,
        assistantRoute: caught.assistantRoute,
        resolutionPath: caught.usageTrace.resolutionPath,
        outcome,
        capability: caught.analytics.capability,
        housekeepingRequestType: caught.analytics.housekeepingRequestType,
        actionType: null,
        tourismSource: null,
        classifierIntent: caught.analytics.classifierIntent,
        classifierConfidenceBand: caught.analytics.classifierConfidenceBand,
        classifierCalls: caught.usageTrace.classifierCalls,
        fullAiCalls: caught.usageTrace.fullAiCalls,
        totalUpstreamCalls: caught.usageTrace.totalUpstreamCalls,
        totalLatencyMs: elapsedSince(processingStartedAt),
        classifierLatencyMs: caught.analytics.classifierLatencyMs === null
          ? null
          : clampAssistantAnalyticsLatency(caught.analytics.classifierLatencyMs),
        fullAiLatencyMs: caught.analytics.fullAiLatencyMs === null
          ? null
          : clampAssistantAnalyticsLatency(caught.analytics.fullAiLatencyMs),
      });
      if (error instanceof GptMakerError) {
        const status = error.kind === 'timeout'
        ? 504
        : error.kind === 'rate_limited' || error.kind === 'authentication' || error.kind === 'configuration'
            ? 503
            : 502;
        return NextResponse.json(SAFE_ERROR, { status });
      }
      return NextResponse.json(SAFE_ERROR, { status: 500 });
    }
    recordFinalEvent({
      occurredAt,
      hotelScope: { kind: 'unattributed' },
      language: validation.value.language,
      assistantRoute: 'deterministic',
      resolutionPath: 'deterministic',
      outcome: 'assistant_failed',
      capability: null,
      housekeepingRequestType: null,
      actionType: null,
      tourismSource: null,
      classifierIntent: null,
      classifierConfidenceBand: null,
      classifierCalls: 0,
      fullAiCalls: 0,
      totalUpstreamCalls: 0,
      totalLatencyMs: elapsedSince(processingStartedAt),
      classifierLatencyMs: null,
      fullAiLatencyMs: null,
    });
    return NextResponse.json(SAFE_ERROR, { status: 500 });
  }
}
