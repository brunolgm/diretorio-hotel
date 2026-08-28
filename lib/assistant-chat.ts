import { buildPublicAiContext } from './public-ai-context.ts';
import type { PublicHotelPageData } from './public-hotel-data.ts';
import type { SupportedPublicLanguage } from './public-language.ts';

export const ASSISTANT_CHAT_LIMITS = {
  bodyBytes: 8 * 1024,
  contextId: 36,
  hotelSlug: 80,
  message: 1_500,
} as const;

const PAYLOAD_KEYS = ['contextId', 'hotelSlug', 'language', 'message'] as const;
const LANGUAGES = new Set<SupportedPublicLanguage>(['pt', 'en', 'es']);
const CONTEXT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOTEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXTERNAL_URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;

export interface AssistantChatPayload {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  contextId: string;
  message: string;
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
  client: AssistantConversationClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  if (keys.length !== PAYLOAD_KEYS.length || keys.some((key, index) => key !== PAYLOAD_KEYS[index])) {
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

  if (
    !hotelSlug ||
    hotelSlug.length > ASSISTANT_CHAT_LIMITS.hotelSlug ||
    !HOTEL_SLUG_PATTERN.test(hotelSlug) ||
    !LANGUAGES.has(value.language as SupportedPublicLanguage) ||
    contextId.length > ASSISTANT_CHAT_LIMITS.contextId ||
    !CONTEXT_ID_PATTERN.test(contextId) ||
    !message ||
    message.length > ASSISTANT_CHAT_LIMITS.message ||
    EXTERNAL_URL_PATTERN.test(message)
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
    },
  };
}

export async function runAssistantChat(
  payload: AssistantChatPayload,
  dependencies: AssistantChatDependencies
) {
  const pageData = await dependencies.getPageDataBySlug(payload.hotelSlug, payload.language);
  if (!pageData) return null;

  const context = buildPublicAiContext({ pageData, language: payload.language });

  await dependencies.client.addContext({
    contextId: payload.contextId,
    prompt: context,
    role: 'user',
  });

  const answer = await dependencies.client.converse({
    contextId: payload.contextId,
    prompt: payload.message,
  });

  return { answer };
}
