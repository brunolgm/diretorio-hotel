import type { SupportedPublicLanguage } from '../../public-language.ts';
import type { ClassifiedAssistantIntent } from '../../assistant-router/types.ts';

export const ASSISTANT_ANALYTICS_SCHEMA_VERSION = 1 as const;

export const ASSISTANT_ANALYTICS_ROUTES = [
  'deterministic',
  'capability',
  'clarification',
  'classification',
  'ai',
] as const;

export const ASSISTANT_ANALYTICS_RESOLUTION_PATHS = [
  'deterministic',
  'direct_ai',
  'classifier_to_capability',
  'classifier_to_ai',
  'classifier_failed_to_ai',
] as const;

export const ASSISTANT_ANALYTICS_OUTCOMES = [
  'success',
  'privacy_blocked',
  'rate_limited',
  'hotel_unavailable',
  'assistant_failed',
  'invalid_upstream_response',
] as const;

export const ASSISTANT_ANALYTICS_CAPABILITIES = [
  'human_handoff',
  'reception_contact',
  'housekeeping_contact',
  'housekeeping_request',
] as const;

export const ASSISTANT_ANALYTICS_HOUSEKEEPING_REQUEST_TYPES = [
  'towels',
  'room_cleaning',
] as const;

export const ASSISTANT_ANALYTICS_ACTION_TYPES = ['open_url', 'confirm_request'] as const;

export const ASSISTANT_ANALYTICS_TOURISM_SOURCES = [
  'libguest_curated',
  'general_ai',
  'unavailable',
] as const;

export const ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS = [
  'human_handoff',
  'reception_contact',
  'housekeeping_contact',
  'housekeeping_request_towels',
  'housekeeping_request_room_cleaning',
  'hotel_information',
  'flight_information',
  'tourism',
  'sales',
  'general_chat',
  'unknown',
] as const satisfies readonly ClassifiedAssistantIntent[];

export const ASSISTANT_ANALYTICS_CONFIDENCE_BANDS = [
  'high',
  'medium',
  'low',
  'invalid',
] as const;

export type AssistantAnalyticsRoute = typeof ASSISTANT_ANALYTICS_ROUTES[number];
export type AssistantAnalyticsResolutionPath = typeof ASSISTANT_ANALYTICS_RESOLUTION_PATHS[number];
export type AssistantAnalyticsOutcome = typeof ASSISTANT_ANALYTICS_OUTCOMES[number];
export type AssistantAnalyticsCapability = typeof ASSISTANT_ANALYTICS_CAPABILITIES[number];
export type AssistantAnalyticsHousekeepingRequestType = typeof ASSISTANT_ANALYTICS_HOUSEKEEPING_REQUEST_TYPES[number];
export type AssistantAnalyticsActionType = typeof ASSISTANT_ANALYTICS_ACTION_TYPES[number];
export type AssistantAnalyticsTourismSource = typeof ASSISTANT_ANALYTICS_TOURISM_SOURCES[number];
export type AssistantAnalyticsClassifierIntent = typeof ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS[number];
export type AssistantAnalyticsClassifierConfidenceBand = typeof ASSISTANT_ANALYTICS_CONFIDENCE_BANDS[number];

export type AssistantAnalyticsHotelScope =
  | { kind: 'resolved'; hotelId: string }
  | { kind: 'unattributed' };

export interface AssistantAnalyticsEvent {
  schemaVersion: 1;
  occurredAt: string;
  hotelScope: AssistantAnalyticsHotelScope;
  language: SupportedPublicLanguage | null;
  assistantRoute: AssistantAnalyticsRoute;
  resolutionPath: AssistantAnalyticsResolutionPath;
  outcome: AssistantAnalyticsOutcome;
  capability: AssistantAnalyticsCapability | null;
  housekeepingRequestType: AssistantAnalyticsHousekeepingRequestType | null;
  actionType: AssistantAnalyticsActionType | null;
  tourismSource: AssistantAnalyticsTourismSource | null;
  classifierIntent: AssistantAnalyticsClassifierIntent | null;
  classifierConfidenceBand: AssistantAnalyticsClassifierConfidenceBand | null;
  classifierCalls: 0 | 1;
  fullAiCalls: 0 | 1;
  totalUpstreamCalls: 0 | 1 | 2;
  totalLatencyMs: number;
  classifierLatencyMs: number | null;
  fullAiLatencyMs: number | null;
}

export type AssistantAnalyticsEventInput = Omit<AssistantAnalyticsEvent, 'schemaVersion'> & {
  schemaVersion?: 1;
};
