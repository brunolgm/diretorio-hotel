import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { AssistantAnalyticsEvent } from '../../lib/server/assistant-analytics/types.ts';
import { NoOpAssistantAnalyticsSink } from '../../lib/server/assistant-analytics/sink.ts';
import { selectAssistantAnalyticsSink } from '../../lib/server/assistant-analytics/sink-selection.ts';
import { recordAssistantAnalyticsEvent } from '../../lib/server/assistant-analytics/recorder.ts';
import { summarizeAssistantAnalytics } from '../../lib/server/assistant-analytics/summary.ts';
import {
  isAssistantAnalyticsPersistenceEnabled,
  persistAssistantAnalyticsEvent,
  projectAssistantAnalyticsRpcArgs,
  type AssistantAnalyticsRpcArgs,
} from '../../lib/server/assistant-analytics/persistence-contract.ts';
import {
  normalizeAssistantAnalyticsPeriod,
  normalizeAssistantAnalyticsSummary,
} from '../../lib/server/assistant-analytics/query-contract.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const HOTEL_ID = '92000000-0000-4000-8000-000000000001';

function resolvedEvent(overrides: Partial<AssistantAnalyticsEvent> = {}): AssistantAnalyticsEvent {
  return {
    schemaVersion: 1,
    occurredAt: '2026-09-02T12:00:00.000Z',
    hotelScope: { kind: 'resolved', hotelId: HOTEL_ID },
    language: 'pt',
    assistantRoute: 'ai',
    resolutionPath: 'classifier_failed_to_ai',
    outcome: 'success',
    capability: null,
    housekeepingRequestType: null,
    actionType: null,
    tourismSource: 'general_ai',
    classifierIntent: null,
    classifierConfidenceBand: 'invalid',
    classifierCalls: 1,
    fullAiCalls: 1,
    totalUpstreamCalls: 2,
    totalLatencyMs: 42,
    classifierLatencyMs: 7,
    fullAiLatencyMs: 35,
    ...overrides,
  };
}

function emptySummary() {
  return {
    totalHandledMessages: 0, aiEligibleMessages: 0, zeroUpstreamMessages: 0,
    classifierMessages: 0, fullAiMessages: 0, twoCallMessages: 0,
    classifierToCapability: 0, classifierToAi: 0, classifierFailuresToAi: 0,
    directAiMessages: 0, privacyBlockedMessages: 0, rateLimitedMessages: 0,
    assistantFailures: 0, totalClassifierCalls: 0, totalFullAiCalls: 0,
    totalUpstreamCalls: 0, fullAiDeflectionRate: null,
    upstreamCallsAvoidedVsAllMaya: null, upstreamCallReductionRate: null,
    averageLatencyMs: null, p95LatencyMs: null,
    capabilities: { human_handoff: 0, reception_contact: 0, housekeeping_contact: 0, housekeeping_request: 0 },
    tourismSources: { libguest_curated: 0, general_ai: 0, unavailable: 0 },
  };
}

test('the server flag defaults to no-op and enables persistence only for true', () => {
  assert.equal(isAssistantAnalyticsPersistenceEnabled(undefined), false);
  assert.equal(isAssistantAnalyticsPersistenceEnabled('false'), false);
  assert.equal(isAssistantAnalyticsPersistenceEnabled(' true '), true);
  let persistentCreations = 0;
  const persistent = { record() {} };
  assert.ok(selectAssistantAnalyticsSink(undefined, () => persistent) instanceof NoOpAssistantAnalyticsSink);
  assert.ok(selectAssistantAnalyticsSink('false', () => persistent) instanceof NoOpAssistantAnalyticsSink);
  assert.equal(selectAssistantAnalyticsSink('true', () => {
    persistentCreations += 1;
    return persistent;
  }), persistent);
  assert.equal(persistentCreations, 1);
  const factory = read('lib', 'server', 'assistant-analytics', 'sink-factory.ts');
  assert.match(factory, /ASSISTANT_ANALYTICS_PERSISTENCE_ENABLED/);
  assert.match(factory, /selectAssistantAnalyticsSink/);
  assert.match(factory, /SupabaseAssistantAnalyticsSink/);
  assert.doesNotMatch(factory, /NEXT_PUBLIC_ASSISTANT/);
  assert.ok(new NoOpAssistantAnalyticsSink());
});

test('unattributed is ignored before client/network work and resolved makes one allowlisted RPC', async () => {
  let calls = 0;
  const rpc = async () => { calls += 1; return { error: null }; };
  await persistAssistantAnalyticsEvent(
    resolvedEvent({ hotelScope: { kind: 'unattributed' } }),
    rpc
  );
  assert.equal(calls, 0);

  let captured: AssistantAnalyticsRpcArgs | undefined;
  await persistAssistantAnalyticsEvent(resolvedEvent(), async (args) => {
    calls += 1;
    captured = args;
    return { error: null };
  });
  assert.equal(calls, 1);
  assert.equal(Object.keys(captured ?? {}).length, 19);
  assert.equal(captured?.p_hotel_id, HOTEL_ID);
  assert.equal(captured?.p_resolution_path, 'classifier_failed_to_ai');
  assert.equal(captured?.p_outcome, 'success');
  assert.equal(captured?.p_total_upstream_calls, 2);
  for (const forbidden of ['message', 'answer', 'prompt', 'context', 'contextId', 'hotelSlug', 'roomToken', 'url']) {
    assert.equal(forbidden in (captured ?? {}), false);
  }
});

test('projection validates again and never accepts arbitrary fields', () => {
  assert.throws(() => projectAssistantAnalyticsRpcArgs({ ...resolvedEvent(), message: 'private' } as AssistantAnalyticsEvent));
  const args = projectAssistantAnalyticsRpcArgs(resolvedEvent());
  assert.ok(args);
  assert.deepEqual(Object.keys(args).sort(), [
    'p_action_type', 'p_assistant_route', 'p_capability', 'p_classifier_calls',
    'p_classifier_confidence_band', 'p_classifier_intent', 'p_classifier_latency_ms',
    'p_full_ai_calls', 'p_full_ai_latency_ms', 'p_hotel_id',
    'p_housekeeping_request_type', 'p_language', 'p_occurred_at', 'p_outcome',
    'p_resolution_path', 'p_schema_version', 'p_total_latency_ms',
    'p_total_upstream_calls', 'p_tourism_source',
  ]);
});

test('RPC failure is best-effort at recorder boundary, with one attempt and no logging', async () => {
  let calls = 0;
  await assert.doesNotReject(recordAssistantAnalyticsEvent(resolvedEvent(), {
    async record(event) {
      await persistAssistantAnalyticsEvent(event, async () => {
        calls += 1;
        return { error: { code: 'synthetic' } };
      });
    },
  }));
  assert.equal(calls, 1);
  const sources = [
    read('lib', 'server', 'assistant-analytics', 'supabase-sink.ts'),
    read('lib', 'server', 'assistant-analytics', 'persistence-contract.ts'),
    read('lib', 'server', 'assistant-analytics', 'recorder.ts'),
  ].join('\n');
  assert.doesNotMatch(sources, /console\.|retry|setTimeout|while\s*\(/i);
  assert.equal((sources.match(/\.rpc\('record_assistant_analytics_event'/g) ?? []).length, 1);
  assert.match(read('lib', 'server', 'assistant-analytics', 'supabase-sink.ts'), /^import 'server-only';/);
});

test('query contract rejects invalid windows and normalizes the closed empty shape', () => {
  assert.throws(() => normalizeAssistantAnalyticsPeriod({ from: 'bad', to: '2026-09-02' }));
  assert.throws(() => normalizeAssistantAnalyticsPeriod({ from: '2026-09-02', to: '2026-09-02' }));
  assert.throws(() => normalizeAssistantAnalyticsPeriod({ from: '2025-09-01', to: '2026-09-03' }));
  assert.deepEqual(normalizeAssistantAnalyticsPeriod({
    from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z',
  }), { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' });
  assert.deepEqual(normalizeAssistantAnalyticsSummary(emptySummary()), emptySummary());
  assert.equal(normalizeAssistantAnalyticsSummary({ ...emptySummary(), arbitrary: 1 }), null);
  assert.equal(normalizeAssistantAnalyticsSummary({ ...emptySummary(), fullAiDeflectionRate: Number.NaN }), null);
  assert.deepEqual(normalizeAssistantAnalyticsSummary({
    ...emptySummary(), aiEligibleMessages: 1, totalUpstreamCalls: 2,
    upstreamCallsAvoidedVsAllMaya: -1, upstreamCallReductionRate: -1,
  })?.upstreamCallsAvoidedVsAllMaya, -1);
});

test('TypeScript aggregation preserves SQL metric semantics and percentile_disc parity', () => {
  const events = [
    resolvedEvent({ totalLatencyMs: 1, classifierLatencyMs: 0, fullAiLatencyMs: 1 }),
    resolvedEvent({
      resolutionPath: 'classifier_to_ai', classifierIntent: 'general_chat',
      classifierConfidenceBand: 'medium', totalLatencyMs: 2,
    }),
  ];
  const summary = summarizeAssistantAnalytics(events);
  assert.equal(summary.totalHandledMessages, 2);
  assert.equal(summary.totalUpstreamCalls, 4);
  assert.equal(summary.upstreamCallsAvoidedVsAllMaya, -2);
  assert.equal(summary.classifierFailuresToAi, 1);
  assert.equal(summary.assistantFailures, 0);
  assert.equal(summary.p95LatencyMs, 2);
  assert.equal(summary.tourismSources.general_ai, 2);
});

test('migration closes storage, authorization, aggregation and retention contracts', () => {
  const migration = read('supabase', 'migrations', '202609020001_ai_assistant_analytics_persistence.sql');
  assert.match(migration, /create table public\.assistant_analytics_events/);
  assert.match(migration, /enable row level security[\s\S]*force row level security/i);
  assert.match(migration, /revoke all on table public\.assistant_analytics_events from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.record_assistant_analytics_event[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.get_hotel_assistant_analytics_summary[\s\S]*to authenticated/i);
  assert.match(migration, /analytics\.basic/);
  assert.match(migration, /pu\.role = 'platform_admin' and pu\.is_active/);
  assert.match(migration, /percentile_disc\(0\.95\)/);
  assert.match(migration, /p_retention_days integer default 180/);
  assert.match(migration, /p_retention_days < 30 or p_retention_days > 730/);
  assert.doesNotMatch(migration, /classifier_failed'|jsonb\s+(?:not null|null)|message\s+text|answer\s+text|context_id|room_token|hotel_slug|remote_chat_id/i);
});

test('ships the 31-control behavioral matrix as a rollback-only local artifact', () => {
  const matrix = read('supabase', 'tests', 'assistant_analytics_persistence_behavioral_matrix.sql');
  assert.match(matrix, /^-- Local\/disposable database only[\s\S]*\nbegin;/);
  assert.match(matrix, /RLS and FORCE RLS are enabled/);
  assert.match(matrix, /Browser roles cannot read\/write raw rows/);
  assert.match(matrix, /service_role can execute exactly the narrow RPC/);
  assert.match(matrix, /Closed catalogs, call totals, resolution mappings and latency coherence/);
  assert.match(matrix, /Viewer gets only an aggregate summary/);
  assert.match(matrix, /Cross-hotel summary is denied/);
  assert.match(matrix, /Active Platform admin can query global and filtered aggregates/);
  assert.match(matrix, /percentile_disc\(\.95\)=19/);
  assert.match(matrix, /old is removed; 30 recent is preserved/);
  assert.match(matrix, /-- 31\.[\s\S]*rollback;\s*$/);
  assert.match(matrix, /create function pg_temp\.assistant_analytics_summary_is_closed/);
  assert.match(matrix, /cardinality\(top_level_keys\)/);
  assert.match(matrix, /not \(key = any\(top_level_keys\)\)/);
  assert.match(matrix, /jsonb_typeof\(entry\.value\) not in \('number', 'null'\)/);
  assert.match(matrix, /result \|\| jsonb_build_object\('id', 'synthetic-event-id', 'occurred_at', now\(\)\)/);
  assert.doesNotMatch(matrix, /result::text ~\* 'occurred_at\|hotel_id\|message/);

  const recordCalls = matrix.match(
    /(?:perform|select) public\.record_assistant_analytics_event\([\s\S]*?\n\s*\);/g
  ) ?? [];
  assert.equal(recordCalls.length, 9);
  for (const call of recordCalls) {
    assert.equal((call.match(/\bp_[a-z_]+\s*=>/g) ?? []).length, 19);
    assert.match(call, /p_schema_version\s*=>\s*\d+::smallint/);
    assert.match(call, /p_hotel_id\s*=>\s*'[^']+'::uuid/);
    assert.match(call, /p_classifier_calls\s*=>\s*\d+::smallint/);
    assert.match(call, /p_full_ai_calls\s*=>\s*\d+::smallint/);
    assert.match(call, /p_total_upstream_calls\s*=>\s*\d+::smallint/);
    assert.match(call, /p_total_latency_ms\s*=>\s*\d+::integer/);
    assert.match(call, /null::text/);
    assert.match(call, /null::integer/);
  }
});

test('no client surface contains the service credential or raw assistant analytics access', () => {
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const query = read('lib', 'server', 'assistant-analytics', 'queries.ts');
  const sink = read('lib', 'server', 'assistant-analytics', 'supabase-sink.ts');
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|assistant_analytics_events|record_assistant_analytics_event/);
  assert.doesNotMatch(query, /\.from\('assistant_analytics_events'\)/);
  assert.match(query, /^import 'server-only';/);
  assert.match(sink, /^import 'server-only';/);
});
