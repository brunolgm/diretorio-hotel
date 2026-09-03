import type { AssistantAnalyticsSummary } from './summary.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PERIOD_MS = 366 * DAY_MS;

export interface AssistantAnalyticsPeriodInput {
  from: Date | string;
  to: Date | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableFinite(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

export function normalizeAssistantAnalyticsPeriod(input: AssistantAnalyticsPeriodInput) {
  const from = input.from instanceof Date ? input.from : new Date(input.from);
  const to = input.to instanceof Date ? input.to : new Date(input.to);
  const duration = to.getTime() - from.getTime();
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
    duration <= 0 || duration > MAX_PERIOD_MS) {
    throw new TypeError('Invalid assistant analytics period');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const SUMMARY_KEYS = [
  'totalHandledMessages', 'aiEligibleMessages', 'zeroUpstreamMessages',
  'classifierMessages', 'fullAiMessages', 'twoCallMessages',
  'classifierToCapability', 'classifierToAi', 'classifierFailuresToAi',
  'directAiMessages', 'privacyBlockedMessages', 'rateLimitedMessages',
  'assistantFailures', 'totalClassifierCalls', 'totalFullAiCalls',
  'totalUpstreamCalls', 'fullAiDeflectionRate', 'upstreamCallsAvoidedVsAllMaya',
  'upstreamCallReductionRate', 'capabilities', 'tourismSources',
  'averageLatencyMs', 'p95LatencyMs',
] as const;
const COUNT_KEYS = SUMMARY_KEYS.slice(0, 16);
const CAPABILITY_KEYS = [
  'human_handoff', 'reception_contact', 'housekeeping_contact', 'housekeeping_request',
] as const;
const TOURISM_KEYS = ['libguest_curated', 'general_ai', 'unavailable'] as const;

export function normalizeAssistantAnalyticsSummary(value: unknown): AssistantAnalyticsSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, SUMMARY_KEYS)) return null;
  const capabilities = value.capabilities;
  const tourismSources = value.tourismSources;
  if (
    !COUNT_KEYS.every((key) => isCount(value[key])) ||
    !isNullableFinite(value.fullAiDeflectionRate) ||
    !isNullableFinite(value.upstreamCallsAvoidedVsAllMaya) ||
    !isNullableFinite(value.upstreamCallReductionRate) ||
    !isNullableFinite(value.averageLatencyMs) ||
    !isNullableFinite(value.p95LatencyMs) ||
    !isRecord(capabilities) || !hasExactKeys(capabilities, CAPABILITY_KEYS) ||
    !CAPABILITY_KEYS.every((key) => isCount(capabilities[key])) ||
    !isRecord(tourismSources) || !hasExactKeys(tourismSources, TOURISM_KEYS) ||
    !TOURISM_KEYS.every((key) => isCount(tourismSources[key]))) return null;

  return value as unknown as AssistantAnalyticsSummary;
}
