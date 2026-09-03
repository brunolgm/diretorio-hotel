import { buildPublicAiContext } from './public-ai-context.ts';
import type { PublicHotelPageData } from './public-hotel-data.ts';
import type { SupportedPublicLanguage } from './public-language.ts';
import {
  applyAssistantClassification,
  getAssistantClassificationConfidenceBand,
  routeAssistantMessage,
  shouldCallAI,
  type AssistantClassification,
  type AssistantRouteCategory,
  type AssistantUsageTrace,
} from './assistant-router/index.ts';
import type {
  AssistantAnalyticsCapability,
  AssistantAnalyticsClassifierConfidenceBand,
  AssistantAnalyticsHousekeepingRequestType,
} from './server/assistant-analytics/types.ts';
import {
  applyContactDeclineToAnswer,
  buildContactDeclinedResponse,
  buildHumanHandoffChatResponse,
  buildHousekeepingClarificationRetryResponse,
  buildHousekeepingContactChatResponse,
  buildPreparedHousekeepingChatResponse,
  buildReceptionContactChatResponse,
  getHumanHandoffContact,
  getHousekeepingContact,
  getReceptionContact,
  HOUSEKEEPING_CANCELLATION_UNAVAILABLE_COPY,
  HOUSEKEEPING_PREPARATION_DISCARDED_COPY,
  parseHousekeepingPendingRequest,
  resolveReceptionContactFromPublicData,
} from './assistant-tools/index.ts';
import type {
  AssistantAction,
  HousekeepingPendingRequest,
} from './assistant-tools/types.ts';
import {
  buildUnavailableTourismResponse,
  removeModelProvidedUrls,
  resolveGeneralAiTourismResponse,
  resolvePublishedHotelRestaurantResponse,
  resolveTourismRecommendationSource,
  type TourismRecommendationSource,
} from './assistant-tourism.ts';
import {
  ASSISTANT_PRIVACY_COPY,
  containsExplicitAssistantPii,
} from './assistant-privacy.ts';

export const ASSISTANT_CHAT_LIMITS = {
  bodyBytes: 8 * 1024,
  contextId: 36,
  hotelSlug: 80,
  message: 1_500,
} as const;

const PAYLOAD_KEYS = ['contextId', 'hotelSlug', 'language', 'message', 'pendingRequest'] as const;
const REQUIRED_PAYLOAD_KEYS = ['contextId', 'hotelSlug', 'language', 'message'] as const;
const LANGUAGES = new Set<SupportedPublicLanguage>(['pt', 'en', 'es']);
const CONTEXT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOTEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXTERNAL_URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;

export interface AssistantChatPayload {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  contextId: string;
  message: string;
  pendingRequest?: HousekeepingPendingRequest;
}

export type AssistantChatValidation =
  | { ok: true; value: AssistantChatPayload }
  | { ok: false };

export interface AssistantConversationClient {
  addContext(input: { contextId: string; prompt: string; role: 'user' }): Promise<void>;
  converse(input: { contextId: string; prompt: string }): Promise<string>;
}

export interface AssistantChatDependencies {
  getPageDataBySlug(
    slug: string,
    language: SupportedPublicLanguage
  ): Promise<PublicHotelPageData | null>;
  createClient(): AssistantConversationClient;
  classifyMessage?(
    message: string,
    guestContextId: string
  ): Promise<AssistantClassification | null>;
  getTourismRecommendations?(input: {
    hotelSlug: string;
    language: SupportedPublicLanguage;
    message: string;
  }): Promise<{ answer: string; action: AssistantAction | null } | null>;
  allowGeneralTourismAi?: boolean;
  monotonicNow?(): number;
}

export interface AssistantChatAnalyticsMetadata {
  hotelId: string;
  privacyBlocked: boolean;
  capability: AssistantAnalyticsCapability | null;
  housekeepingRequestType: AssistantAnalyticsHousekeepingRequestType | null;
  classifierIntent: AssistantClassification['intent'] | null;
  classifierConfidenceBand: AssistantAnalyticsClassifierConfidenceBand | null;
  classifierLatencyMs: number | null;
  fullAiLatencyMs: number | null;
}

export const ASSISTANT_CHAT_ANALYTICS = Symbol('assistantChatAnalytics');

export interface AssistantChatResult {
  answer: string;
  action: AssistantAction | null;
  pendingRequest: HousekeepingPendingRequest | null;
  responseLanguage: SupportedPublicLanguage;
  assistantRoute: AssistantRouteCategory;
  usageTrace: AssistantUsageTrace;
  recommendationSource?: TourismRecommendationSource;
  [ASSISTANT_CHAT_ANALYTICS]?: AssistantChatAnalyticsMetadata;
}

export class AssistantChatExecutionError extends Error {
  readonly analytics: AssistantChatAnalyticsMetadata;
  readonly assistantRoute: AssistantRouteCategory;
  readonly usageTrace: AssistantUsageTrace;
  readonly upstreamCause: unknown;

  constructor(
    analytics: AssistantChatAnalyticsMetadata,
    assistantRoute: AssistantRouteCategory,
    usageTrace: AssistantUsageTrace,
    upstreamCause: unknown
  ) {
    super('Assistant execution failed');
    this.name = 'AssistantChatExecutionError';
    this.analytics = analytics;
    this.assistantRoute = assistantRoute;
    this.usageTrace = usageTrace;
    this.upstreamCause = upstreamCause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ClassifierCallStatus = 'none' | 'succeeded' | 'failed';

function buildUsageTrace(
  classifierStatus: ClassifierCallStatus,
  fullAiCalls: 0 | 1
): AssistantUsageTrace {
  const classifierCalls = classifierStatus === 'none' ? 0 : 1;
  const totalUpstreamCalls = (classifierCalls + fullAiCalls) as 0 | 1 | 2;
  const resolutionPath = classifierStatus === 'none'
    ? fullAiCalls === 1 ? 'direct_ai' : 'deterministic'
    : fullAiCalls === 0
      ? 'classifier_to_capability'
      : classifierStatus === 'failed'
        ? 'classifier_failed_to_ai'
        : 'classifier_to_ai';
  return {
    resolutionPath,
    classifierCalls,
    fullAiCalls,
    totalUpstreamCalls,
  };
}

export function isSuccessfulGptMakerAcknowledgement(value: unknown) {
  return isRecord(value) && value.success === true;
}

export function parseGptMakerAnswer(value: unknown) {
  if (!isRecord(value) || value.success !== true || typeof value.message !== 'string') {
    return null;
  }
  return value.message.trim() || null;
}

export function validateAssistantChatPayload(value: unknown): AssistantChatValidation {
  if (!isRecord(value)) return { ok: false };

  const keys = Object.keys(value).sort();
  if (
    keys.some((key) => !PAYLOAD_KEYS.includes(key as typeof PAYLOAD_KEYS[number])) ||
    REQUIRED_PAYLOAD_KEYS.some((key) => !keys.includes(key))
  ) {
    return { ok: false };
  }

  if (
    typeof value.hotelSlug !== 'string' ||
    typeof value.language !== 'string' ||
    typeof value.contextId !== 'string' ||
    typeof value.message !== 'string'
  ) {
    return { ok: false };
  }

  const hotelSlug = value.hotelSlug.trim().toLowerCase();
  const contextId = value.contextId.trim();
  const message = value.message.trim();
  const pendingRequest = 'pendingRequest' in value
    ? parseHousekeepingPendingRequest(value.pendingRequest)
    : null;

  if (
    !hotelSlug ||
    hotelSlug.length > ASSISTANT_CHAT_LIMITS.hotelSlug ||
    !HOTEL_SLUG_PATTERN.test(hotelSlug) ||
    !LANGUAGES.has(value.language as SupportedPublicLanguage) ||
    contextId.length > ASSISTANT_CHAT_LIMITS.contextId ||
    !CONTEXT_ID_PATTERN.test(contextId) ||
    !message ||
    message.length > ASSISTANT_CHAT_LIMITS.message ||
    EXTERNAL_URL_PATTERN.test(message) ||
    ('pendingRequest' in value && !pendingRequest)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      hotelSlug,
      language: value.language as SupportedPublicLanguage,
      contextId,
      message,
      ...(pendingRequest ? { pendingRequest } : {}),
    },
  };
}

export async function runAssistantChat(
  payload: AssistantChatPayload,
  dependencies: AssistantChatDependencies
): Promise<AssistantChatResult | null> {
  const now = dependencies.monotonicNow ?? (() => performance.now());
  const privacyBlocked = containsExplicitAssistantPii(payload.message);
  const initialDecision = privacyBlocked
    ? null
    : routeAssistantMessage({
        message: payload.message,
        uiLanguage: payload.language,
        ...(payload.pendingRequest ? { pendingRequest: payload.pendingRequest } : {}),
      });
  const resolvedLanguage = !initialDecision
    ? payload.language
    : initialDecision.mode === 'deterministic'
      ? initialDecision.detectedLanguage ?? payload.pendingRequest?.language ?? payload.language
      : initialDecision.mode === 'clarification'
        ? initialDecision.detectedLanguage
        : initialDecision.mode === 'capability'
          ? initialDecision.detectedLanguage ?? payload.language
          : payload.language;
  const initialPageData = await dependencies.getPageDataBySlug(payload.hotelSlug, resolvedLanguage);
  if (!initialPageData || initialPageData.hotel.slug !== payload.hotelSlug) return null;
  const resolvedPageData = initialPageData;
  const getResolvedPageData = (slug: string, language: SupportedPublicLanguage) =>
    slug === payload.hotelSlug && language === resolvedLanguage
      ? Promise.resolve(resolvedPageData)
      : dependencies.getPageDataBySlug(slug, language);
  let classifierStatus: ClassifierCallStatus = 'none';
  let classifierIntent: AssistantClassification['intent'] | null = null;
  let classifierConfidenceBand: AssistantAnalyticsClassifierConfidenceBand | null = null;
  let classifierLatencyMs: number | null = null;
  let fullAiLatencyMs: number | null = null;
  let contactDeclinedLanguage = initialDecision?.contactDeclinedLanguage ?? null;

  function finalize(
    result: AssistantChatResult,
    details: {
      privacyBlocked?: boolean;
      capability?: AssistantAnalyticsCapability | null;
      housekeepingRequestType?: AssistantAnalyticsHousekeepingRequestType | null;
    } = {}
  ) {
    const publicResult = contactDeclinedLanguage
      ? {
          ...result,
          answer: applyContactDeclineToAnswer(result.answer, contactDeclinedLanguage),
        }
      : result;
    Object.defineProperty(publicResult, ASSISTANT_CHAT_ANALYTICS, {
      enumerable: false,
      value: {
        hotelId: resolvedPageData.hotel.id,
        privacyBlocked: details.privacyBlocked ?? false,
        capability: details.capability ?? null,
        housekeepingRequestType: details.housekeepingRequestType ?? null,
        classifierIntent,
        classifierConfidenceBand,
        classifierLatencyMs,
        fullAiLatencyMs,
      } satisfies AssistantChatAnalyticsMetadata,
    });
    return publicResult;
  }

  if (privacyBlocked) {
    const contact = resolveReceptionContactFromPublicData({
      input: { hotelSlug: payload.hotelSlug, language: payload.language },
      pageData: initialPageData,
    });
    const contactAction = buildReceptionContactChatResponse(contact, payload.language).action;
    return finalize({
      answer: ASSISTANT_PRIVACY_COPY[payload.language],
      action: contactAction,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: 'deterministic',
      usageTrace: buildUsageTrace('none', 0),
    }, { privacyBlocked: true });
  }

  let decision = initialDecision!;

  if (decision.mode === 'classification') {
    let classification: AssistantClassification | null = null;
    if (dependencies.classifyMessage) {
      classifierStatus = 'failed';
      const classifierStartedAt = now();
      try {
        classification = await dependencies.classifyMessage(
          decision.message.original,
          payload.contextId
        );
        classifierStatus = classification ? 'succeeded' : 'failed';
        classifierIntent = classification?.intent ?? null;
        classifierConfidenceBand = classification
          ? getAssistantClassificationConfidenceBand(classification.confidence)
          : 'invalid';
      } catch {
        classification = null;
        classifierStatus = 'failed';
        classifierConfidenceBand = 'invalid';
      } finally {
        classifierLatencyMs = Math.max(0, Math.round(now() - classifierStartedAt));
      }
    }
    const classifiedDecision = applyAssistantClassification({
      classification,
      message: decision.message,
      uiLanguage: decision.uiLanguage,
    });
    if (
      contactDeclinedLanguage &&
      classifiedDecision.mode === 'capability' &&
      (classifiedDecision.capability === 'reception_contact' ||
        classifiedDecision.capability === 'human_handoff')
    ) {
      decision = {
        mode: 'deterministic',
        assistantRoute: 'deterministic',
        outcome: 'contact_declined',
        detectedLanguage: contactDeclinedLanguage,
        message: classifiedDecision.message,
      };
      contactDeclinedLanguage = null;
    } else {
      decision = contactDeclinedLanguage
        ? { ...classifiedDecision, contactDeclinedLanguage }
        : classifiedDecision;
    }
  }

  switch (decision.mode) {
    case 'deterministic': {
      const responseLanguage = decision.detectedLanguage ??
        payload.pendingRequest?.language ?? payload.language;
      const pageData = await getResolvedPageData(payload.hotelSlug, responseLanguage);
      if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
      return finalize({
        answer: decision.outcome === 'clarification_cancelled'
          ? HOUSEKEEPING_PREPARATION_DISCARDED_COPY[responseLanguage]
          : decision.outcome === 'housekeeping_cancellation_unavailable'
            ? HOUSEKEEPING_CANCELLATION_UNAVAILABLE_COPY[responseLanguage]
            : buildContactDeclinedResponse(responseLanguage),
        action: null,
        pendingRequest: null,
        responseLanguage,
        assistantRoute: decision.assistantRoute,
        usageTrace: buildUsageTrace(classifierStatus, 0),
      });
    }

    case 'clarification': {
      const pageData = await getResolvedPageData(
        payload.hotelSlug,
        decision.detectedLanguage
      );
      if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
      return finalize({
        ...(decision.resolution.kind === 'resolved'
          ? buildPreparedHousekeepingChatResponse(
              decision.resolution.request,
              decision.detectedLanguage
            )
          : buildHousekeepingClarificationRetryResponse(
              decision.resolution.reason,
              decision.detectedLanguage
            )),
        assistantRoute: decision.assistantRoute,
        usageTrace: buildUsageTrace(classifierStatus, 0),
      }, {
        capability: 'housekeeping_request',
        housekeepingRequestType: decision.resolution.kind === 'resolved'
          ? decision.resolution.request.requestType
          : 'towels',
      });
    }

    case 'capability': {
      const capabilityLanguage = decision.detectedLanguage ?? payload.language;
      const contactDependencies = { getPageDataBySlug: getResolvedPageData };

      switch (decision.capability) {
        case 'human_handoff': {
          const contact = await getHumanHandoffContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return finalize({
            ...buildHumanHandoffChatResponse(
              contact,
              capabilityLanguage,
              decision.message.normalized
            ),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          }, { capability: 'human_handoff' });
        }

        case 'reception_contact': {
          const contact = await getReceptionContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return finalize({
            ...buildReceptionContactChatResponse(contact, capabilityLanguage),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          }, { capability: 'reception_contact' });
        }

        case 'housekeeping_contact': {
          const contact = await getHousekeepingContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return finalize({
            ...buildHousekeepingContactChatResponse(contact, capabilityLanguage),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          }, { capability: 'housekeeping_contact' });
        }

        case 'housekeeping_request': {
          const pageData = await getResolvedPageData(
            payload.hotelSlug,
            capabilityLanguage
          );
          if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
          return finalize({
            ...buildPreparedHousekeepingChatResponse(decision.request, capabilityLanguage),
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          }, {
            capability: 'housekeeping_request',
            housekeepingRequestType: decision.request.requestType,
          });
        }
      }
    }

    case 'ai':
    case 'tourism':
      break;
  }

  if (!shouldCallAI(decision)) return null;

  const pageData = initialPageData;

  if (decision.mode === 'tourism' && dependencies.getTourismRecommendations) {
    const curated = await dependencies.getTourismRecommendations({
      hotelSlug: payload.hotelSlug,
      language: payload.language,
      message: decision.message.original,
    });
    if (curated) {
      return finalize({
        answer: curated.answer,
        action: curated.action,
        pendingRequest: null,
        responseLanguage: payload.language,
        assistantRoute: decision.assistantRoute,
        recommendationSource: 'libguest_curated',
        usageTrace: buildUsageTrace(classifierStatus, 0),
      });
    }
  }

  const recommendationSource = decision.mode === 'tourism'
    ? resolveTourismRecommendationSource({
        hasLibguestCuratedRecommendations: false,
        allowGeneralAi: dependencies.allowGeneralTourismAi !== false,
      })
    : null;

  if (recommendationSource === 'unavailable') {
    const contactAction = buildReceptionContactChatResponse(
      resolveReceptionContactFromPublicData({
        input: { hotelSlug: payload.hotelSlug, language: payload.language },
        pageData,
      }),
      payload.language
    ).action;
    return finalize({
      answer: buildUnavailableTourismResponse(payload.language),
      action: contactDeclinedLanguage ? null : contactAction,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: decision.assistantRoute,
      recommendationSource,
      usageTrace: buildUsageTrace(classifierStatus, 0),
    });
  }

  const curatedHotelRestaurant = decision.mode === 'ai'
    ? resolvePublishedHotelRestaurantResponse(decision.message, pageData)
    : null;
  if (curatedHotelRestaurant) {
    return finalize({
      answer: curatedHotelRestaurant,
      action: null,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: 'deterministic',
      recommendationSource: 'libguest_curated',
      usageTrace: buildUsageTrace(classifierStatus, 0),
    });
  }

  const context = buildPublicAiContext({ pageData, language: payload.language });
  const fullAiStartedAt = now();
  let modelAnswer: string;
  try {
    const client = dependencies.createClient();
    await client.addContext({
      contextId: payload.contextId,
      prompt: context,
      role: 'user',
    });
    modelAnswer = await client.converse({
      contextId: payload.contextId,
      prompt: decision.message.original,
    });
  } catch (error) {
    fullAiLatencyMs = Math.max(0, Math.round(now() - fullAiStartedAt));
    throw new AssistantChatExecutionError(
      {
        hotelId: initialPageData.hotel.id,
        privacyBlocked: false,
        capability: null,
        housekeepingRequestType: null,
        classifierIntent,
        classifierConfidenceBand,
        classifierLatencyMs,
        fullAiLatencyMs,
      },
      decision.assistantRoute,
      buildUsageTrace(classifierStatus, 1),
      error
    );
  }
  fullAiLatencyMs = Math.max(0, Math.round(now() - fullAiStartedAt));

  const generalTourismResponse = decision.mode === 'tourism'
    ? resolveGeneralAiTourismResponse(modelAnswer, payload.language)
    : null;
  const tourismFallbackAction = !contactDeclinedLanguage &&
      generalTourismResponse?.source === 'unavailable'
    ? buildReceptionContactChatResponse(
        resolveReceptionContactFromPublicData({
          input: { hotelSlug: payload.hotelSlug, language: payload.language },
          pageData,
        }),
        payload.language
      ).action
    : null;

  return finalize({
    answer: generalTourismResponse?.answer ?? removeModelProvidedUrls(modelAnswer),
    action: tourismFallbackAction,
    pendingRequest: null,
    responseLanguage: payload.language,
    assistantRoute: decision.assistantRoute,
    ...(generalTourismResponse
      ? { recommendationSource: generalTourismResponse.source }
      : {}),
    usageTrace: buildUsageTrace(classifierStatus, 1),
  });
}
