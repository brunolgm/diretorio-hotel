import { NextResponse, type NextRequest } from 'next/server';
import {
  ASSISTANT_CHAT_LIMITS,
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

const SAFE_ERROR = { error: 'assistant_unavailable' } as const;

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

  const clientIp = resolveAssistantClientIp(request.headers);
  const rateLimit = await consumeAssistantRateLimit({
    hotelSlug: validation.value.hotelSlug,
    ip: clientIp,
    contextId: validation.value.contextId,
  });
  if (!rateLimit.allowed) {
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

    if (!result) return NextResponse.json(SAFE_ERROR, { status: 404 });
    return NextResponse.json({
      answer: result.answer,
      action: result.action,
      pendingRequest: result.pendingRequest,
      responseLanguage: result.responseLanguage,
    });
  } catch (error) {
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
}
