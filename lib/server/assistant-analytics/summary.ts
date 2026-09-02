import type { SupportedPublicLanguage } from '../../public-language.ts';
import {
  ASSISTANT_ANALYTICS_CAPABILITIES,
  ASSISTANT_ANALYTICS_TOURISM_SOURCES,
  type AssistantAnalyticsCapability,
  type AssistantAnalyticsEvent,
  type AssistantAnalyticsResolutionPath,
  type AssistantAnalyticsTourismSource,
} from './types.ts';

export interface AssistantAnalyticsSummaryFilter {
  hotelId?: string;
  language?: SupportedPublicLanguage | null;
  capability?: AssistantAnalyticsCapability | null;
  resolutionPath?: AssistantAnalyticsResolutionPath;
}

export interface AssistantAnalyticsSummary {
  totalHandledMessages: number;
  aiEligibleMessages: number;
  zeroUpstreamMessages: number;
  classifierMessages: number;
  fullAiMessages: number;
  twoCallMessages: number;
  classifierToCapability: number;
  classifierToAi: number;
  classifierFailuresToAi: number;
  directAiMessages: number;
  privacyBlockedMessages: number;
  rateLimitedMessages: number;
  assistantFailures: number;
  totalClassifierCalls: number;
  totalFullAiCalls: number;
  totalUpstreamCalls: number;
  fullAiDeflectionRate: number | null;
  upstreamCallsAvoidedVsAllMaya: number | null;
  upstreamCallReductionRate: number | null;
  capabilities: Record<AssistantAnalyticsCapability, number>;
  tourismSources: Record<AssistantAnalyticsTourismSource, number>;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
}

function isAiEligible(event: AssistantAnalyticsEvent) {
  return event.outcome !== 'privacy_blocked' && event.outcome !== 'rate_limited' &&
    event.outcome !== 'hotel_unavailable';
}

function matchesFilter(event: AssistantAnalyticsEvent, filter: AssistantAnalyticsSummaryFilter) {
  if (filter.hotelId !== undefined &&
    (event.hotelScope.kind !== 'resolved' || event.hotelScope.hotelId !== filter.hotelId)) return false;
  if ('language' in filter && event.language !== filter.language) return false;
  if ('capability' in filter && event.capability !== filter.capability) return false;
  if (filter.resolutionPath !== undefined && event.resolutionPath !== filter.resolutionPath) return false;
  return true;
}

export function summarizeAssistantAnalytics(
  events: readonly AssistantAnalyticsEvent[],
  filter: AssistantAnalyticsSummaryFilter = {}
): AssistantAnalyticsSummary {
  const selected = events.filter((event) => matchesFilter(event, filter));
  const eligible = selected.filter(isAiEligible);
  const countPath = (path: AssistantAnalyticsResolutionPath) =>
    selected.filter((event) => event.resolutionPath === path).length;
  const totalClassifierCalls = selected.reduce((sum, event) => sum + event.classifierCalls, 0);
  const totalFullAiCalls = selected.reduce((sum, event) => sum + event.fullAiCalls, 0);
  const totalUpstreamCalls = selected.reduce((sum, event) => sum + event.totalUpstreamCalls, 0);
  const aiEligibleMessages = eligible.length;
  const avoided = aiEligibleMessages - totalUpstreamCalls;
  const latencies = selected.map((event) => event.totalLatencyMs).sort((a, b) => a - b);
  const average = latencies.length
    ? Math.round((latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length) * 100) / 100
    : null;
  const capabilities = Object.fromEntries(
    ASSISTANT_ANALYTICS_CAPABILITIES.map((capability) => [
      capability, selected.filter((event) => event.capability === capability).length,
    ])
  ) as Record<AssistantAnalyticsCapability, number>;
  const tourismSources = Object.fromEntries(
    ASSISTANT_ANALYTICS_TOURISM_SOURCES.map((source) => [
      source, selected.filter((event) => event.tourismSource === source).length,
    ])
  ) as Record<AssistantAnalyticsTourismSource, number>;

  return {
    totalHandledMessages: selected.length,
    aiEligibleMessages,
    zeroUpstreamMessages: selected.filter((event) => event.totalUpstreamCalls === 0).length,
    classifierMessages: selected.filter((event) => event.classifierCalls === 1).length,
    fullAiMessages: selected.filter((event) => event.fullAiCalls === 1).length,
    twoCallMessages: selected.filter((event) => event.totalUpstreamCalls === 2).length,
    classifierToCapability: countPath('classifier_to_capability'),
    classifierToAi: countPath('classifier_to_ai'),
    classifierFailuresToAi: countPath('classifier_failed_to_ai'),
    directAiMessages: countPath('direct_ai'),
    privacyBlockedMessages: selected.filter((event) => event.outcome === 'privacy_blocked').length,
    rateLimitedMessages: selected.filter((event) => event.outcome === 'rate_limited').length,
    assistantFailures: selected.filter((event) => event.outcome === 'assistant_failed').length,
    totalClassifierCalls,
    totalFullAiCalls,
    totalUpstreamCalls,
    fullAiDeflectionRate: aiEligibleMessages === 0
      ? null
      : eligible.filter((event) => event.fullAiCalls === 0).length / aiEligibleMessages,
    upstreamCallsAvoidedVsAllMaya: aiEligibleMessages === 0 ? null : avoided,
    upstreamCallReductionRate: aiEligibleMessages === 0 ? null : avoided / aiEligibleMessages,
    capabilities,
    tourismSources,
    averageLatencyMs: average,
    p95LatencyMs: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null,
  };
}
