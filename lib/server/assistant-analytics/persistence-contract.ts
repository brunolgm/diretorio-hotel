import type { AssistantAnalyticsEvent } from './types.ts';
import { validateAssistantAnalyticsEvent } from './validation.ts';

export interface AssistantAnalyticsRpcArgs {
  p_schema_version: 1;
  p_occurred_at: string;
  p_hotel_id: string;
  p_language: AssistantAnalyticsEvent['language'];
  p_assistant_route: AssistantAnalyticsEvent['assistantRoute'];
  p_resolution_path: AssistantAnalyticsEvent['resolutionPath'];
  p_outcome: AssistantAnalyticsEvent['outcome'];
  p_capability: AssistantAnalyticsEvent['capability'];
  p_housekeeping_request_type: AssistantAnalyticsEvent['housekeepingRequestType'];
  p_action_type: AssistantAnalyticsEvent['actionType'];
  p_tourism_source: AssistantAnalyticsEvent['tourismSource'];
  p_classifier_intent: AssistantAnalyticsEvent['classifierIntent'];
  p_classifier_confidence_band: AssistantAnalyticsEvent['classifierConfidenceBand'];
  p_classifier_calls: AssistantAnalyticsEvent['classifierCalls'];
  p_full_ai_calls: AssistantAnalyticsEvent['fullAiCalls'];
  p_total_upstream_calls: AssistantAnalyticsEvent['totalUpstreamCalls'];
  p_total_latency_ms: number;
  p_classifier_latency_ms: number | null;
  p_full_ai_latency_ms: number | null;
}

export type AssistantAnalyticsRpc = (
  args: AssistantAnalyticsRpcArgs
) => Promise<{ error: unknown }>;

export function isAssistantAnalyticsPersistenceEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export function projectAssistantAnalyticsRpcArgs(
  event: AssistantAnalyticsEvent
): AssistantAnalyticsRpcArgs | null {
  if (!validateAssistantAnalyticsEvent(event)) {
    throw new TypeError('Invalid assistant analytics event');
  }
  if (event.hotelScope.kind === 'unattributed') return null;

  return {
    p_schema_version: event.schemaVersion,
    p_occurred_at: event.occurredAt,
    p_hotel_id: event.hotelScope.hotelId,
    p_language: event.language,
    p_assistant_route: event.assistantRoute,
    p_resolution_path: event.resolutionPath,
    p_outcome: event.outcome,
    p_capability: event.capability,
    p_housekeeping_request_type: event.housekeepingRequestType,
    p_action_type: event.actionType,
    p_tourism_source: event.tourismSource,
    p_classifier_intent: event.classifierIntent,
    p_classifier_confidence_band: event.classifierConfidenceBand,
    p_classifier_calls: event.classifierCalls,
    p_full_ai_calls: event.fullAiCalls,
    p_total_upstream_calls: event.totalUpstreamCalls,
    p_total_latency_ms: event.totalLatencyMs,
    p_classifier_latency_ms: event.classifierLatencyMs,
    p_full_ai_latency_ms: event.fullAiLatencyMs,
  };
}

export async function persistAssistantAnalyticsEvent(
  event: AssistantAnalyticsEvent,
  rpc: AssistantAnalyticsRpc
) {
  const args = projectAssistantAnalyticsRpcArgs(event);
  if (!args) return;
  const { error } = await rpc(args);
  if (error) throw new Error('Assistant analytics persistence failed');
}
