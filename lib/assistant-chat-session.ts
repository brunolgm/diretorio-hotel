import type { SupportedPublicLanguage } from './public-language.ts';

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
  return value as unknown as AssistantChatMessage;
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
    messages: session.messages.slice(-ASSISTANT_STORED_MESSAGE_LIMIT).map((message) => ({
      id: message.id,
      role: message.role,
      text: sanitizeAssistantStoredText(message.text),
      createdAt: message.createdAt,
    })),
  };
  try {
    storage.setItem(getAssistantSessionStorageKey(hotelSlug), JSON.stringify(safeSession));
  } catch {
    // Storage failures never block the public hotel experience.
  }
}

export function buildAssistantChatRequest(payload: AssistantChatRequestPayload) {
  return {
    hotelSlug: payload.hotelSlug,
    language: payload.language,
    contextId: payload.contextId,
    message: sanitizeAssistantStoredText(payload.message),
  };
}
