import type { SupportedPublicLanguage } from '@/lib/public-language';

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'language_selected',
  'whatsapp_click',
  'website_click',
  'booking_click',
  'department_click',
  'service_view',
  'flight_center_view',
  'flight_saved',
  'flight_removed',
  'flight_official_link_click',
  'flight_calendar_download',
  'flight_route_open',
  'flight_service_action',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const FLIGHT_SERVICE_ANALYTICS_ACTIONS = [
  'transfer',
  'wake_up',
  'breakfast_box',
  'reception',
] as const;

export type FlightServiceAnalyticsAction = (typeof FLIGHT_SERVICE_ANALYTICS_ACTIONS)[number];

export const ANALYTICS_LIMITS = {
  bodyBytes: 8 * 1024,
  hotelSlug: 80,
} as const;

export interface AnalyticsEventPayload {
  hotelSlug: string;
  eventType: AnalyticsEventType;
  language: SupportedPublicLanguage;
  departmentId?: string | null;
  serviceId?: string | null;
  action?: FlightServiceAnalyticsAction | null;
}

export interface ValidatedAnalyticsPayload {
  hotelSlug: string;
  eventType: AnalyticsEventType;
  language: SupportedPublicLanguage;
  departmentId: string | null;
  serviceId: string | null;
  action: FlightServiceAnalyticsAction | null;
}

export type AnalyticsPayloadValidation =
  | { ok: true; value: ValidatedAnalyticsPayload }
  | { ok: false; reason: string };

const ANALYTICS_PAYLOAD_KEYS = new Set([
  'hotelSlug',
  'eventType',
  'language',
  'departmentId',
  'serviceId',
  'action',
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

  const departmentId = readOptionalBoundedString(value.departmentId, 36);
  if (departmentId === undefined || (departmentId !== null && !isUuid(departmentId))) {
    return { ok: false, reason: 'department_id' };
  }

  const serviceId = readOptionalBoundedString(value.serviceId, 36);
  if (serviceId === undefined || (serviceId !== null && !isUuid(serviceId))) {
    return { ok: false, reason: 'service_id' };
  }

  if (value.eventType === 'department_click' && !departmentId) {
    return { ok: false, reason: 'department_required' };
  }
  if (value.eventType !== 'department_click' && departmentId) {
    return { ok: false, reason: 'department_forbidden' };
  }
  if (value.eventType === 'service_view' && !serviceId) {
    return { ok: false, reason: 'service_required' };
  }
  if (value.eventType !== 'service_view' && serviceId) {
    return { ok: false, reason: 'service_forbidden' };
  }

  const action = value.action === undefined || value.action === null || value.action === ''
    ? null
    : typeof value.action === 'string' && (FLIGHT_SERVICE_ANALYTICS_ACTIONS as readonly string[]).includes(value.action)
      ? value.action as FlightServiceAnalyticsAction
      : undefined;
  if (action === undefined) return { ok: false, reason: 'action' };
  if (value.eventType === 'flight_service_action' && !action) {
    return { ok: false, reason: 'action_required' };
  }
  if (value.eventType !== 'flight_service_action' && action) {
    return { ok: false, reason: 'action_forbidden' };
  }

  return {
    ok: true,
    value: {
      hotelSlug,
      eventType: value.eventType,
      language: value.language,
      departmentId,
      serviceId,
      action,
    },
  };
}

export function isAnalyticsEventType(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}

export function isFlightServiceAnalyticsAction(value: string): value is FlightServiceAnalyticsAction {
  return (FLIGHT_SERVICE_ANALYTICS_ACTIONS as readonly string[]).includes(value);
}
