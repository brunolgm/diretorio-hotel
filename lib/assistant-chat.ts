import { buildPublicAiContext } from './public-ai-context.ts';
import type { PublicHotelPageData } from './public-hotel-data.ts';
import type { SupportedPublicLanguage } from './public-language.ts';
import {
  applyAssistantClassification,
  routeAssistantMessage,
  shouldCallAI,
  type AssistantClassification,
  type AssistantRouteCategory,
  type AssistantUsageTrace,
} from './assistant-router/index.ts';
import {
  buildHumanHandoffChatResponse,
  buildHousekeepingClarificationRetryResponse,
  buildHousekeepingContactChatResponse,
  buildPreparedHousekeepingChatResponse,
  buildReceptionContactChatResponse,
  getHumanHandoffContact,
  getHousekeepingContact,
  getReceptionContact,
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
}

export interface AssistantChatResult {
  answer: string;
  action: AssistantAction | null;
  pendingRequest: HousekeepingPendingRequest | null;
  responseLanguage: SupportedPublicLanguage;
  assistantRoute: AssistantRouteCategory;
  usageTrace: AssistantUsageTrace;
  recommendationSource?: TourismRecommendationSource;
}

const CLARIFICATION_CANCELLED_COPY: Record<SupportedPublicLanguage, string> = {
  pt: 'Tudo bem. A solicita\u00e7\u00e3o de toalhas foi cancelada.',
  en: 'All right. The towel request was cancelled.',
  es: 'De acuerdo. La solicitud de toallas fue cancelada.',
};

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
  if (containsExplicitAssistantPii(payload.message)) {
    const pageData = await dependencies.getPageDataBySlug(payload.hotelSlug, payload.language);
    if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
    const contact = resolveReceptionContactFromPublicData({
      input: { hotelSlug: payload.hotelSlug, language: payload.language },
      pageData,
    });
    const contactAction = buildReceptionContactChatResponse(contact, payload.language).action;
    return {
      answer: ASSISTANT_PRIVACY_COPY[payload.language],
      action: contactAction,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: 'deterministic',
      usageTrace: buildUsageTrace('none', 0),
    };
  }

  let classifierStatus: ClassifierCallStatus = 'none';
  let decision = routeAssistantMessage({
    message: payload.message,
    uiLanguage: payload.language,
    ...(payload.pendingRequest ? { pendingRequest: payload.pendingRequest } : {}),
  });

  if (decision.mode === 'classification') {
    let classification: AssistantClassification | null = null;
    if (dependencies.classifyMessage) {
      try {
        classification = await dependencies.classifyMessage(
          decision.message.original,
          payload.contextId
        );
        classifierStatus = classification ? 'succeeded' : 'failed';
      } catch {
        classification = null;
        classifierStatus = 'failed';
      }
    }
    decision = applyAssistantClassification({
      classification,
      message: decision.message,
      uiLanguage: decision.uiLanguage,
    });
  }

  switch (decision.mode) {
    case 'deterministic': {
      const responseLanguage = decision.detectedLanguage ??
        payload.pendingRequest?.language ?? payload.language;
      const pageData = await dependencies.getPageDataBySlug(payload.hotelSlug, responseLanguage);
      if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
      return {
        answer: CLARIFICATION_CANCELLED_COPY[responseLanguage],
        action: null,
        pendingRequest: null,
        responseLanguage,
        assistantRoute: decision.assistantRoute,
        usageTrace: buildUsageTrace(classifierStatus, 0),
      };
    }

    case 'clarification': {
      const pageData = await dependencies.getPageDataBySlug(
        payload.hotelSlug,
        decision.detectedLanguage
      );
      if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
      return {
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
      };
    }

    case 'capability': {
      const capabilityLanguage = decision.detectedLanguage ?? payload.language;
      const contactDependencies = { getPageDataBySlug: dependencies.getPageDataBySlug };

      switch (decision.capability) {
        case 'human_handoff': {
          const contact = await getHumanHandoffContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return {
            ...buildHumanHandoffChatResponse(
              contact,
              capabilityLanguage,
              decision.message.normalized
            ),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          };
        }

        case 'reception_contact': {
          const contact = await getReceptionContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return {
            ...buildReceptionContactChatResponse(contact, capabilityLanguage),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          };
        }

        case 'housekeeping_contact': {
          const contact = await getHousekeepingContact(
            { hotelSlug: payload.hotelSlug, language: capabilityLanguage },
            contactDependencies
          );
          return {
            ...buildHousekeepingContactChatResponse(contact, capabilityLanguage),
            pendingRequest: null,
            responseLanguage: capabilityLanguage,
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          };
        }

        case 'housekeeping_request': {
          const pageData = await dependencies.getPageDataBySlug(
            payload.hotelSlug,
            capabilityLanguage
          );
          if (!pageData || pageData.hotel.slug !== payload.hotelSlug) return null;
          return {
            ...buildPreparedHousekeepingChatResponse(decision.request, capabilityLanguage),
            assistantRoute: decision.assistantRoute,
            usageTrace: buildUsageTrace(classifierStatus, 0),
          };
        }
      }
    }

    case 'ai':
    case 'tourism':
      break;
  }

  if (!shouldCallAI(decision)) return null;

  const pageData = await dependencies.getPageDataBySlug(payload.hotelSlug, payload.language);
  if (!pageData) return null;

  if (decision.mode === 'tourism' && dependencies.getTourismRecommendations) {
    const curated = await dependencies.getTourismRecommendations({
      hotelSlug: payload.hotelSlug,
      language: payload.language,
      message: payload.message,
    });
    if (curated) {
      return {
        answer: curated.answer,
        action: curated.action,
        pendingRequest: null,
        responseLanguage: payload.language,
        assistantRoute: decision.assistantRoute,
        recommendationSource: 'libguest_curated',
        usageTrace: buildUsageTrace(classifierStatus, 0),
      };
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
    return {
      answer: buildUnavailableTourismResponse(payload.language),
      action: contactAction,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: decision.assistantRoute,
      recommendationSource,
      usageTrace: buildUsageTrace(classifierStatus, 0),
    };
  }

  const curatedHotelRestaurant = decision.mode === 'ai'
    ? resolvePublishedHotelRestaurantResponse(decision.message, pageData)
    : null;
  if (curatedHotelRestaurant) {
    return {
      answer: curatedHotelRestaurant,
      action: null,
      pendingRequest: null,
      responseLanguage: payload.language,
      assistantRoute: 'deterministic',
      recommendationSource: 'libguest_curated',
      usageTrace: buildUsageTrace(classifierStatus, 0),
    };
  }

  const context = buildPublicAiContext({ pageData, language: payload.language });
  const client = dependencies.createClient();

  await client.addContext({
    contextId: payload.contextId,
    prompt: context,
    role: 'user',
  });

  const modelAnswer = await client.converse({
    contextId: payload.contextId,
    prompt: payload.message,
  });

  const generalTourismResponse = decision.mode === 'tourism'
    ? resolveGeneralAiTourismResponse(modelAnswer, payload.language)
    : null;
  const tourismFallbackAction = generalTourismResponse?.source === 'unavailable'
    ? buildReceptionContactChatResponse(
        resolveReceptionContactFromPublicData({
          input: { hotelSlug: payload.hotelSlug, language: payload.language },
          pageData,
        }),
        payload.language
      ).action
    : null;

  return {
    answer: generalTourismResponse?.answer ?? removeModelProvidedUrls(modelAnswer),
    action: tourismFallbackAction,
    pendingRequest: null,
    responseLanguage: payload.language,
    assistantRoute: decision.assistantRoute,
    ...(generalTourismResponse
      ? { recommendationSource: generalTourismResponse.source }
      : {}),
    usageTrace: buildUsageTrace(classifierStatus, 1),
  };
}
