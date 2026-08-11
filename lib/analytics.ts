import type { Json } from '@/types/database';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'language_selected',
  'whatsapp_click',
  'website_click',
  'booking_click',
  'department_click',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsMetadata = Record<string, Json | undefined>;

export const ANALYTICS_LIMITS = {
  bodyBytes: 8 * 1024,
  hotelSlug: 80,
  sessionId: 64,
  targetUrl: 2048,
  metadataKeys: 1,
  metadataString: 120,
} as const;

export interface AnalyticsEventPayload {
  hotelSlug: string;
  eventType: AnalyticsEventType;
  sessionId?: string | null;
  language: SupportedPublicLanguage;
  targetUrl?: string | null;
  departmentId?: string | null;
  metadata?: AnalyticsMetadata;
}

export interface ValidatedAnalyticsPayload {
  hotelSlug: string;
  eventType: AnalyticsEventType;
  sessionId: string | null;
  language: SupportedPublicLanguage;
  targetUrl: string | null;
  departmentId: string | null;
  metadata: { label?: string };
}

export type AnalyticsPayloadValidation =
  | { ok: true; value: ValidatedAnalyticsPayload }
  | { ok: false; reason: string };

const ANALYTICS_PAYLOAD_KEYS = new Set([
  'hotelSlug',
  'eventType',
  'sessionId',
  'language',
  'targetUrl',
  'departmentId',
  'metadata',
]);

const CLICK_EVENT_TYPES = new Set<AnalyticsEventType>([
  'whatsapp_click',
  'website_click',
  'booking_click',
  'department_click',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function readOptionalBoundedString(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return undefined;
  return normalized;
}

function validateMetadata(value: unknown): { label?: string } | null {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) return null;

  const keys = Object.keys(value);
  if (keys.length > ANALYTICS_LIMITS.metadataKeys || keys.some((key) => key !== 'label')) {
    return null;
  }

  if (value.label === undefined || value.label === null) return {};
  if (typeof value.label !== 'string') return null;
  const label = value.label.trim();
  if (!label || label.length > ANALYTICS_LIMITS.metadataString) return null;
  return { label };
}

function validateTargetUrl(value: unknown) {
  const normalized = readOptionalBoundedString(value, ANALYTICS_LIMITS.targetUrl);
  if (normalized === undefined) return undefined;
  if (normalized === null) return null;

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function validateAnalyticsPayload(value: unknown): AnalyticsPayloadValidation {
  if (!isPlainObject(value)) return { ok: false, reason: 'payload' };
  if (Object.keys(value).some((key) => !ANALYTICS_PAYLOAD_KEYS.has(key))) {
    return { ok: false, reason: 'unknown_field' };
  }

  if (typeof value.hotelSlug !== 'string') return { ok: false, reason: 'hotel_slug' };
  const hotelSlug = value.hotelSlug.trim().toLowerCase();
  if (
    !hotelSlug ||
    hotelSlug.length > ANALYTICS_LIMITS.hotelSlug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hotelSlug)
  ) {
    return { ok: false, reason: 'hotel_slug' };
  }

  if (typeof value.eventType !== 'string' || !isAnalyticsEventType(value.eventType)) {
    return { ok: false, reason: 'event_type' };
  }

  if (value.language !== 'pt' && value.language !== 'en' && value.language !== 'es') {
    return { ok: false, reason: 'language' };
  }

  const sessionId = readOptionalBoundedString(value.sessionId, ANALYTICS_LIMITS.sessionId);
  if (
    sessionId === undefined ||
    (sessionId !== null && !/^[a-zA-Z0-9_-]+$/.test(sessionId))
  ) {
    return { ok: false, reason: 'session_id' };
  }

  const targetUrl = validateTargetUrl(value.targetUrl);
  if (targetUrl === undefined) return { ok: false, reason: 'target_url' };

  const departmentId = readOptionalBoundedString(value.departmentId, 36);
  if (departmentId === undefined || (departmentId !== null && !isUuid(departmentId))) {
    return { ok: false, reason: 'department_id' };
  }

  if (value.eventType === 'department_click' && !departmentId) {
    return { ok: false, reason: 'department_required' };
  }
  if (value.eventType !== 'department_click' && departmentId) {
    return { ok: false, reason: 'department_forbidden' };
  }
  if (CLICK_EVENT_TYPES.has(value.eventType) && !targetUrl) {
    return { ok: false, reason: 'target_required' };
  }
  if (!CLICK_EVENT_TYPES.has(value.eventType) && targetUrl) {
    return { ok: false, reason: 'target_forbidden' };
  }

  const metadata = validateMetadata(value.metadata);
  if (!metadata) return { ok: false, reason: 'metadata' };

  return {
    ok: true,
    value: {
      hotelSlug,
      eventType: value.eventType,
      sessionId,
      language: value.language,
      targetUrl,
      departmentId,
      metadata,
    },
  };
}

export function isAnalyticsEventType(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}
