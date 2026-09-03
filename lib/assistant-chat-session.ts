import type { SupportedPublicLanguage } from './public-language.ts';
import { containsExplicitAssistantPii } from './assistant-privacy.ts';
import {
  parseAssistantAction,
  parseHousekeepingPendingRequest,
  type AssistantAction,
  type HousekeepingPendingRequest,
} from './assistant-tools/types.ts';
import { detectContactDecline } from './assistant-tools/reception-contact.ts';
import { detectHousekeepingPreparationCancellationTarget } from './assistant-tools/request-housekeeping.ts';

export const ASSISTANT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ASSISTANT_SESSION_STORAGE_PREFIX = 'libguest:assistant:';
export const ASSISTANT_SESSION_STORAGE_VERSION = 'v1';
export const ASSISTANT_STORED_MESSAGE_LIMIT = 80;

const CONTEXT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LANGUAGES = new Set<SupportedPublicLanguage>(['pt', 'en', 'es']);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d ().-]{7,}\d)/g;
const SENSITIVE_LABEL_PATTERN = /\b(?:roomToken|room_token|guestName|guest_name|reservation|reserva|telefone|phone|e-?mail)\s*[:=#-]\s*\S+/gi;
const ROOM_NUMBER_PATTERN = /\b(?:quarto|room)\s*(?:n[ºo.]?\s*)?(?:[:=#-]\s*)?\d{1,8}\b/gi;

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  action?: AssistantAction;
  language?: SupportedPublicLanguage;
}

export interface AssistantStoredSession {
  contextId: string;
  messages: AssistantChatMessage[];
  language: SupportedPublicLanguage;
  timestamp: string;
}

export interface AssistantStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AssistantChatRequestPayload {
  hotelSlug: string;
  language: SupportedPublicLanguage;
  contextId: string;
  message: string;
  pendingRequest?: HousekeepingPendingRequest;
}

export interface PreparedRequestCancellationTarget {
  messageId: string;
  action: Extract<AssistantAction, { type: 'confirm_request' }>;
  language: SupportedPublicLanguage;
}

export interface LocalAssistantInteractionGuard {
  consumedDraftGeneration: number | null;
}

export function consumeLocalAssistantInteraction(
  guard: LocalAssistantInteractionGuard,
  draftGeneration: number
) {
  if (guard.consumedDraftGeneration === draftGeneration) return false;
  guard.consumedDraftGeneration = draftGeneration;
  return true;
}

export function resetLocalAssistantInteraction(guard: LocalAssistantInteractionGuard) {
  guard.consumedDraftGeneration = null;
}

export function isContactDeclinedInteraction(message: string) {
  return detectContactDecline(message) !== null;
}

export function resolveAssistantErrorMessage(
  message: string,
  normalFallback: string,
  contactDeclinedFallback: string
) {
  return isContactDeclinedInteraction(message)
    ? contactDeclinedFallback
    : normalFallback;
}

export function findPreparedRequestCancellationTarget(
  messages: readonly AssistantChatMessage[],
  message: string,
  fallbackLanguage: SupportedPublicLanguage
): PreparedRequestCancellationTarget | null {
  const cancellation = detectHousekeepingPreparationCancellationTarget(
    message,
    fallbackLanguage
  );
  if (!cancellation) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.role !== 'assistant' || candidate.action?.type !== 'confirm_request') continue;
    if (
      cancellation.requestType &&
      candidate.action.request.requestType !== cancellation.requestType
    ) {
      continue;
    }
    return {
      messageId: candidate.id,
      action: candidate.action,
      language: cancellation.detectedLanguage ?? candidate.language ?? fallbackLanguage,
    };
  }
  return null;
}

export function removePreparedRequestAction(
  messages: readonly AssistantChatMessage[],
  target: PreparedRequestCancellationTarget
) {
  let removed = false;
  const nextMessages = messages.map((message) => {
    if (message.id !== target.messageId || message.action !== target.action) return message;
    removed = true;
    return {
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
      ...(message.language ? { language: message.language } : {}),
    };
  });
  return removed ? nextMessages : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getAssistantSessionStorageKey(hotelSlug: string) {
  return `${ASSISTANT_SESSION_STORAGE_PREFIX}${hotelSlug}:${ASSISTANT_SESSION_STORAGE_VERSION}`;
}

export function sanitizeAssistantStoredText(text: string) {
  return text
    .replace(SENSITIVE_LABEL_PATTERN, '[dado sensível removido]')
    .replace(EMAIL_PATTERN, '[email removido]')
    .replace(PHONE_PATTERN, '[telefone removido]')
    .replace(ROOM_NUMBER_PATTERN, '[quarto removido]')
    .slice(0, 1_500);
}

export function createAssistantSession(
  language: SupportedPublicLanguage,
  now: Date,
  createId: () => string
): AssistantStoredSession {
  return {
    contextId: createId(),
    messages: [],
    language,
    timestamp: now.toISOString(),
  };
}

function parseMessage(value: unknown): AssistantChatMessage | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.some((key) => !['action', 'createdAt', 'id', 'language', 'role', 'text'].includes(key))) return null;
  if (
    typeof value.id !== 'string' ||
    !CONTEXT_ID_PATTERN.test(value.id) ||
    (value.role !== 'user' && value.role !== 'assistant') ||
    typeof value.text !== 'string' ||
    !value.text ||
    value.text.length > 1_500 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }
  const messageLanguage = 'language' in value && value.language !== undefined
    ? value.language
    : null;
  if (
    messageLanguage !== null &&
    (value.role !== 'assistant' ||
      typeof messageLanguage !== 'string' ||
      !LANGUAGES.has(messageLanguage as SupportedPublicLanguage))
  ) {
    return null;
  }
  const language = messageLanguage as SupportedPublicLanguage | null;
  if ('action' in value && value.action !== undefined) {
    if (value.role !== 'assistant') return null;
    const action = parseAssistantAction(value.action);
    if (!action) return null;
    return {
      id: value.id,
      role: value.role,
      text: value.text,
      createdAt: value.createdAt,
      action,
      ...(language ? { language } : {}),
    };
  }
  return {
    id: value.id,
    role: value.role,
    text: value.text,
    createdAt: value.createdAt,
    ...(language ? { language } : {}),
  };
}

export function parseAssistantStoredSession(
  value: string | null,
  language: SupportedPublicLanguage,
  now: Date
): AssistantStoredSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.contextId !== 'string' ||
      !CONTEXT_ID_PATTERN.test(parsed.contextId) ||
      parsed.language !== language ||
      !LANGUAGES.has(parsed.language as SupportedPublicLanguage) ||
      typeof parsed.timestamp !== 'string'
    ) {
      return null;
    }
    const timestamp = Date.parse(parsed.timestamp);
    if (!Number.isFinite(timestamp) || now.getTime() - timestamp >= ASSISTANT_SESSION_TTL_MS || timestamp > now.getTime()) {
      return null;
    }
    if (!Array.isArray(parsed.messages) || parsed.messages.length > ASSISTANT_STORED_MESSAGE_LIMIT) {
      return null;
    }
    const messages = parsed.messages.map(parseMessage);
    if (messages.some((message) => message === null)) return null;
    return { ...parsed, messages } as AssistantStoredSession;
  } catch {
    return null;
  }
}

export function loadOrCreateAssistantSession({
  storage,
  hotelSlug,
  language,
  now,
  createId,
}: {
  storage: AssistantStorage;
  hotelSlug: string;
  language: SupportedPublicLanguage;
  now: Date;
  createId: () => string;
}) {
  const key = getAssistantSessionStorageKey(hotelSlug);
  try {
    const existing = parseAssistantStoredSession(storage.getItem(key), language, now);
    if (existing) return existing;
  } catch {
    // sessionStorage may be unavailable; the in-memory session still works.
  }
  const session = createAssistantSession(language, now, createId);
  saveAssistantSession(storage, hotelSlug, session);
  return session;
}

export function saveAssistantSession(
  storage: AssistantStorage,
  hotelSlug: string,
  session: AssistantStoredSession
) {
  const safeSession: AssistantStoredSession = {
    contextId: session.contextId,
    language: session.language,
    timestamp: session.timestamp,
    messages: session.messages.slice(-ASSISTANT_STORED_MESSAGE_LIMIT).map((message) => {
      const action = message.role === 'assistant' && message.action
        ? parseAssistantAction(message.action)
        : null;
      return {
        id: message.id,
        role: message.role,
        text: sanitizeAssistantStoredText(message.text),
        createdAt: message.createdAt,
        ...(action ? { action } : {}),
        ...(message.role === 'assistant' && message.language && LANGUAGES.has(message.language)
          ? { language: message.language }
          : {}),
      };
    }),
  };
  try {
    storage.setItem(getAssistantSessionStorageKey(hotelSlug), JSON.stringify(safeSession));
  } catch {
    // Storage failures never block the public hotel experience.
  }
}

export function buildAssistantChatRequest(payload: AssistantChatRequestPayload) {
  const pendingRequest = payload.pendingRequest
    ? parseHousekeepingPendingRequest(payload.pendingRequest)
    : null;
  return {
    hotelSlug: payload.hotelSlug,
    language: payload.language,
    contextId: payload.contextId,
    message: payload.message,
    ...(pendingRequest ? { pendingRequest } : {}),
  };
}

export function shouldPersistAssistantUserMessage(message: string) {
  return !containsExplicitAssistantPii(message);
}
