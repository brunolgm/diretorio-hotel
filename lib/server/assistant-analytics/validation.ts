import {
  ASSISTANT_ANALYTICS_ACTION_TYPES,
  ASSISTANT_ANALYTICS_CAPABILITIES,
  ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS,
  ASSISTANT_ANALYTICS_CONFIDENCE_BANDS,
  ASSISTANT_ANALYTICS_HOUSEKEEPING_REQUEST_TYPES,
  ASSISTANT_ANALYTICS_OUTCOMES,
  ASSISTANT_ANALYTICS_RESOLUTION_PATHS,
  ASSISTANT_ANALYTICS_ROUTES,
  ASSISTANT_ANALYTICS_SCHEMA_VERSION,
  ASSISTANT_ANALYTICS_TOURISM_SOURCES,
  type AssistantAnalyticsEvent,
  type AssistantAnalyticsEventInput,
} from './types.ts';

export const ASSISTANT_ANALYTICS_MAX_LATENCY_MS = 10 * 60 * 1000;

const EVENT_KEYS = [
  'schemaVersion', 'occurredAt', 'hotelScope', 'language', 'assistantRoute',
  'resolutionPath', 'outcome', 'capability', 'housekeepingRequestType',
  'actionType', 'tourismSource', 'classifierIntent', 'classifierConfidenceBand',
  'classifierCalls', 'fullAiCalls', 'totalUpstreamCalls', 'totalLatencyMs',
  'classifierLatencyMs', 'fullAiLatencyMs',
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCatalogValue<T extends string>(catalog: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (catalog as readonly string[]).includes(value);
}

function isLatency(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 &&
    value <= ASSISTANT_ANALYTICS_MAX_LATENCY_MS;
}

export function clampAssistantAnalyticsLatency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(ASSISTANT_ANALYTICS_MAX_LATENCY_MS, Math.round(value));
}

export function validateAssistantAnalyticsEvent(value: unknown): value is AssistantAnalyticsEvent {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== EVENT_KEYS.length ||
    EVENT_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false;
  if (value.schemaVersion !== ASSISTANT_ANALYTICS_SCHEMA_VERSION) return false;
  if (typeof value.occurredAt !== 'string' || !value.occurredAt || Number.isNaN(Date.parse(value.occurredAt))) return false;
  if (!isRecord(value.hotelScope)) return false;
  if (value.hotelScope.kind === 'resolved') {
    if (Object.keys(value.hotelScope).sort().join(',') !== 'hotelId,kind' ||
      typeof value.hotelScope.hotelId !== 'string' || !UUID_PATTERN.test(value.hotelScope.hotelId)) return false;
  } else if (value.hotelScope.kind === 'unattributed') {
    if (Object.keys(value.hotelScope).join(',') !== 'kind') return false;
  } else return false;
  if (value.language !== null && value.language !== 'pt' && value.language !== 'en' && value.language !== 'es') return false;
  if (!isCatalogValue(ASSISTANT_ANALYTICS_ROUTES, value.assistantRoute) ||
    !isCatalogValue(ASSISTANT_ANALYTICS_RESOLUTION_PATHS, value.resolutionPath) ||
    !isCatalogValue(ASSISTANT_ANALYTICS_OUTCOMES, value.outcome)) return false;
  if (value.capability !== null && !isCatalogValue(ASSISTANT_ANALYTICS_CAPABILITIES, value.capability)) return false;
  if (value.housekeepingRequestType !== null &&
    !isCatalogValue(ASSISTANT_ANALYTICS_HOUSEKEEPING_REQUEST_TYPES, value.housekeepingRequestType)) return false;
  if (value.actionType !== null && !isCatalogValue(ASSISTANT_ANALYTICS_ACTION_TYPES, value.actionType)) return false;
  if (value.tourismSource !== null && !isCatalogValue(ASSISTANT_ANALYTICS_TOURISM_SOURCES, value.tourismSource)) return false;
  if (value.classifierIntent !== null && !isCatalogValue(ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS, value.classifierIntent)) return false;
  if (value.classifierConfidenceBand !== null &&
    !isCatalogValue(ASSISTANT_ANALYTICS_CONFIDENCE_BANDS, value.classifierConfidenceBand)) return false;
  if ((value.classifierCalls !== 0 && value.classifierCalls !== 1) ||
    (value.fullAiCalls !== 0 && value.fullAiCalls !== 1) ||
    (value.totalUpstreamCalls !== 0 && value.totalUpstreamCalls !== 1 && value.totalUpstreamCalls !== 2)) return false;
  if (value.totalUpstreamCalls !== value.classifierCalls + value.fullAiCalls) return false;
  const expectedCalls: Record<string, readonly [number, number, number]> = {
    deterministic: [0, 0, 0], direct_ai: [0, 1, 1],
    classifier_to_capability: [1, 0, 1], classifier_to_ai: [1, 1, 2],
    classifier_failed_to_ai: [1, 1, 2],
  };
  const expected = expectedCalls[value.resolutionPath];
  if (!expected || expected[0] !== value.classifierCalls || expected[1] !== value.fullAiCalls || expected[2] !== value.totalUpstreamCalls) return false;
  if (!isLatency(value.totalLatencyMs)) return false;
  if (value.classifierCalls === 0) {
    if (value.classifierLatencyMs !== null || value.classifierIntent !== null || value.classifierConfidenceBand !== null) return false;
  } else if (!isLatency(value.classifierLatencyMs) || value.classifierConfidenceBand === null) return false;
  if (value.fullAiCalls === 0) {
    if (value.fullAiLatencyMs !== null) return false;
  } else if (!isLatency(value.fullAiLatencyMs)) return false;
  if (value.capability !== 'housekeeping_request' && value.housekeepingRequestType !== null) return false;
  if (value.outcome === 'privacy_blocked' &&
    (value.assistantRoute !== 'deterministic' || value.resolutionPath !== 'deterministic')) return false;
  return true;
}

export function buildAssistantAnalyticsEvent(input: AssistantAnalyticsEventInput): AssistantAnalyticsEvent {
  const event: AssistantAnalyticsEvent = { ...input, schemaVersion: ASSISTANT_ANALYTICS_SCHEMA_VERSION };
  if (!validateAssistantAnalyticsEvent(event)) throw new TypeError('Invalid assistant analytics event');
  return event;
}
