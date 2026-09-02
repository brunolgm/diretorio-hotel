import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_CHAT_ANALYTICS,
  AssistantChatExecutionError,
  runAssistantChat,
} from '../../lib/assistant-chat.ts';
import {
  ASSISTANT_ANALYTICS_CAPABILITIES,
  ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS,
  ASSISTANT_ANALYTICS_OUTCOMES,
  ASSISTANT_ANALYTICS_RESOLUTION_PATHS,
  ASSISTANT_ANALYTICS_ROUTES,
  ASSISTANT_ANALYTICS_TOURISM_SOURCES,
  type AssistantAnalyticsEvent,
  type AssistantAnalyticsEventInput,
} from '../../lib/server/assistant-analytics/types.ts';
import { NoOpAssistantAnalyticsSink } from '../../lib/server/assistant-analytics/sink.ts';
import { recordAssistantAnalyticsEvent } from '../../lib/server/assistant-analytics/recorder.ts';
import { summarizeAssistantAnalytics } from '../../lib/server/assistant-analytics/summary.ts';
import {
  buildAssistantAnalyticsEvent,
  validateAssistantAnalyticsEvent,
} from '../../lib/server/assistant-analytics/validation.ts';
import { TestAssistantAnalyticsSink } from '../helpers/test-assistant-analytics-sink.ts';

const HOTEL_A = '10000000-0000-4000-8000-000000000001';
const HOTEL_B = '20000000-0000-4000-8000-000000000002';
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const CHAT_PAYLOAD = {
  hotelSlug: 'hotel-teste',
  language: 'pt' as const,
  contextId: 'b187f57c-c435-4605-99b8-4a5a9c3983f6',
  message: 'tem como alguem me ajudar?',
};

function assistantDependencies({
  classifier,
  maya,
}: {
  classifier: 'disabled' | 'fail';
  maya: 'success' | 'fail';
}) {
  let monotonicTime = 0;
  let classifierCalls = 0;
  let fullAiCalls = 0;
  return {
    calls: () => ({ classifierCalls, fullAiCalls }),
    dependencies: {
      monotonicNow() { monotonicTime += 7; return monotonicTime; },
      async getPageDataBySlug() {
        return {
          hotel: {
            id: HOTEL_A, name: 'Hotel Teste', slug: CHAT_PAYLOAD.hotelSlug,
            checkin_time: null, checkout_time: null, breakfast_hours: null,
            wifi_name: null, website_url: null, instagram_url: null,
            booking_url: null, whatsapp_number: null,
          },
          sections: [], departments: [], policies: [], announcements: [], banners: [],
          layout: [], flightHomeCard: null, hasFallbackContent: false,
        } as never;
      },
      ...(classifier === 'fail' ? {
        async classifyMessage() {
          classifierCalls += 1;
          throw new Error('classifier unavailable');
        },
      } : {}),
      createClient() {
        fullAiCalls += 1;
        return {
          async addContext() {},
          async converse() {
            if (maya === 'fail') throw new Error('maya unavailable');
            return 'Resposta valida da Maya';
          },
        };
      },
    },
  };
}

function event(overrides: Partial<AssistantAnalyticsEventInput> = {}): AssistantAnalyticsEvent {
  return buildAssistantAnalyticsEvent({
    occurredAt: '2026-09-02T12:00:00.000Z',
    hotelScope: { kind: 'resolved', hotelId: HOTEL_A },
    language: 'pt',
    assistantRoute: 'deterministic',
    resolutionPath: 'deterministic',
    outcome: 'success',
    capability: null,
    housekeepingRequestType: null,
    actionType: null,
    tourismSource: null,
    classifierIntent: null,
    classifierConfidenceBand: null,
    classifierCalls: 0,
    fullAiCalls: 0,
    totalUpstreamCalls: 0,
    totalLatencyMs: 10,
    classifierLatencyMs: null,
    fullAiLatencyMs: null,
    ...overrides,
  });
}

test('closes schema version, catalogs, event keys and upstream invariants', () => {
  assert.deepEqual(ASSISTANT_ANALYTICS_ROUTES, ['deterministic', 'capability', 'clarification', 'classification', 'ai']);
  assert.equal(ASSISTANT_ANALYTICS_RESOLUTION_PATHS.length, 5);
  assert.equal(ASSISTANT_ANALYTICS_OUTCOMES.length, 6);
  assert.equal((ASSISTANT_ANALYTICS_OUTCOMES as readonly string[]).includes('classifier_failed'), false);
  assert.equal(ASSISTANT_ANALYTICS_CLASSIFIER_INTENTS.length, 11);
  assert.deepEqual(ASSISTANT_ANALYTICS_CAPABILITIES, [
    'human_handoff', 'reception_contact', 'housekeeping_contact', 'housekeeping_request',
  ]);
  assert.equal(event().schemaVersion, 1);
  assert.equal(validateAssistantAnalyticsEvent({ ...event(), schemaVersion: 2 }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...event(), message: 'segredo' }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...event(), totalUpstreamCalls: 1 }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...event(), resolutionPath: 'direct_ai' }), false);
});

test('enforces latency, classifier confidence and field coherence', () => {
  const classified = event({
    assistantRoute: 'capability', resolutionPath: 'classifier_to_capability',
    capability: 'reception_contact', actionType: 'open_url',
    classifierIntent: 'reception_contact', classifierConfidenceBand: 'high',
    classifierCalls: 1, totalUpstreamCalls: 1, classifierLatencyMs: 25,
  });
  assert.equal(validateAssistantAnalyticsEvent(classified), true);
  assert.equal(validateAssistantAnalyticsEvent({ ...classified, classifierLatencyMs: null }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...classified, classifierConfidenceBand: null }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...classified, fullAiLatencyMs: 2 }), false);
  assert.equal(validateAssistantAnalyticsEvent({ ...classified, totalLatencyMs: -1 }), false);
});

test('the event shape cannot carry guest content, identifiers, transport data or secrets', () => {
  const serialized = JSON.stringify(event({
    capability: 'housekeeping_request', housekeepingRequestType: 'towels',
    actionType: 'confirm_request', tourismSource: 'unavailable',
  }));
  for (const forbidden of [
    'message', 'answer', 'prompt', 'contextId', 'sessionStorage', 'user-agent',
    'roomToken', 'room_number', 'reservation', 'email', 'phone', 'Authorization',
    'apiKey', 'stack', 'target_url',
  ]) assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'));
});

test('no-op has no effect, test sink captures one event and sink rejection is contained', async () => {
  const input = event();
  assert.doesNotThrow(() => new NoOpAssistantAnalyticsSink().record(input));
  const sink = new TestAssistantAnalyticsSink();
  await recordAssistantAnalyticsEvent(input, sink);
  assert.equal(sink.events.length, 1);
  let failedSinkRecords = 0;
  await assert.doesNotReject(recordAssistantAnalyticsEvent(input, {
    record() { failedSinkRecords += 1; throw new Error('offline'); },
  }));
  assert.equal(failedSinkRecords, 1);
  await assert.doesNotReject(recordAssistantAnalyticsEvent(input, {
    record() { return Promise.reject(new Error('offline')); },
  }));
});

test('classifier failure followed by a valid Maya response is successful 1/1/2', async () => {
  const tracked = assistantDependencies({ classifier: 'fail', maya: 'success' });
  const result = await runAssistantChat(CHAT_PAYLOAD, tracked.dependencies);
  assert.ok(result);
  assert.deepEqual(tracked.calls(), { classifierCalls: 1, fullAiCalls: 1 });
  assert.deepEqual(result.usageTrace, {
    resolutionPath: 'classifier_failed_to_ai',
    classifierCalls: 1,
    fullAiCalls: 1,
    totalUpstreamCalls: 2,
  });
  const metadata = result[ASSISTANT_CHAT_ANALYTICS];
  assert.ok(metadata);
  assert.equal(metadata.classifierConfidenceBand, 'invalid');
  assert.equal(metadata.classifierLatencyMs, 7);
  assert.equal(metadata.fullAiLatencyMs, 7);
  const completedEvent = event({
    assistantRoute: result.assistantRoute,
    resolutionPath: result.usageTrace.resolutionPath,
    outcome: 'success',
    classifierIntent: metadata.classifierIntent,
    classifierConfidenceBand: metadata.classifierConfidenceBand,
    classifierCalls: result.usageTrace.classifierCalls,
    fullAiCalls: result.usageTrace.fullAiCalls,
    totalUpstreamCalls: result.usageTrace.totalUpstreamCalls,
    classifierLatencyMs: metadata.classifierLatencyMs,
    fullAiLatencyMs: metadata.fullAiLatencyMs,
  });
  const summary = summarizeAssistantAnalytics([completedEvent]);
  assert.equal(summary.classifierFailuresToAi, 1);
  assert.equal(summary.totalUpstreamCalls, 2);
  assert.equal(summary.assistantFailures, 0);

  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  assert.match(route, /outcome: analytics\?\.privacyBlocked[\s\S]*\? 'privacy_blocked'[\s\S]*: 'success'/);
  assert.doesNotMatch(route, /outcome:[\s\S]{0,160}'classifier_failed'/);
});

test('disabled classifier followed by a valid Maya response is direct success 0/1/1', async () => {
  const tracked = assistantDependencies({ classifier: 'disabled', maya: 'success' });
  const result = await runAssistantChat(CHAT_PAYLOAD, tracked.dependencies);
  assert.ok(result);
  assert.deepEqual(tracked.calls(), { classifierCalls: 0, fullAiCalls: 1 });
  assert.deepEqual(result.usageTrace, {
    resolutionPath: 'direct_ai',
    classifierCalls: 0,
    fullAiCalls: 1,
    totalUpstreamCalls: 1,
  });
  const metadata = result[ASSISTANT_CHAT_ANALYTICS];
  assert.ok(metadata);
  assert.equal(metadata.classifierLatencyMs, null);
  assert.equal(metadata.classifierConfidenceBand, null);
  assert.equal(metadata.fullAiLatencyMs, 7);
  assert.equal(validateAssistantAnalyticsEvent(event({
    assistantRoute: result.assistantRoute,
    resolutionPath: result.usageTrace.resolutionPath,
    outcome: 'success',
    classifierCalls: 0,
    fullAiCalls: 1,
    totalUpstreamCalls: 1,
    fullAiLatencyMs: metadata.fullAiLatencyMs,
  })), true);
});

test('classifier failure followed by Maya failure preserves 1/1/2 on the final failure', async () => {
  const tracked = assistantDependencies({ classifier: 'fail', maya: 'fail' });
  await assert.rejects(
    runAssistantChat(CHAT_PAYLOAD, tracked.dependencies),
    (error: unknown) => {
      assert.ok(error instanceof AssistantChatExecutionError);
      assert.deepEqual(error.usageTrace, {
        resolutionPath: 'classifier_failed_to_ai',
        classifierCalls: 1,
        fullAiCalls: 1,
        totalUpstreamCalls: 2,
      });
      assert.equal(error.analytics.classifierLatencyMs, 7);
      assert.equal(error.analytics.fullAiLatencyMs, 7);
      return true;
    }
  );
  assert.deepEqual(tracked.calls(), { classifierCalls: 1, fullAiCalls: 1 });
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  assert.match(route, /kind === 'invalid_response'[\s\S]*\? 'invalid_upstream_response'[\s\S]*: 'assistant_failed'/);
});

test('non-enumerable metadata stays instrumentable but cannot leak through serialization', async () => {
  const tracked = assistantDependencies({ classifier: 'disabled', maya: 'success' });
  const result = await runAssistantChat(CHAT_PAYLOAD, tracked.dependencies);
  assert.ok(result);
  assert.ok(result[ASSISTANT_CHAT_ANALYTICS]);
  assert.equal(Object.getOwnPropertyDescriptor(result, ASSISTANT_CHAT_ANALYTICS)?.enumerable, false);
  assert.doesNotMatch(JSON.stringify(result), /assistantChatAnalytics|hotelId|classifierLatencyMs|fullAiLatencyMs/);

  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const publicResponse = route.slice(route.indexOf('return NextResponse.json({', route.indexOf('const analytics')));
  assert.match(publicResponse, /answer: result\.answer[\s\S]*action: result\.action/);
  assert.doesNotMatch(publicResponse.slice(0, publicResponse.indexOf('});') + 3), /analytics|usageTrace|assistantRoute|hotelId/);
});

test('summarizes empty input without NaN and uses deterministic nearest-rank p95', () => {
  const empty = summarizeAssistantAnalytics([]);
  assert.equal(empty.totalHandledMessages, 0);
  assert.equal(empty.fullAiDeflectionRate, null);
  assert.equal(empty.upstreamCallsAvoidedVsAllMaya, null);
  assert.equal(empty.upstreamCallReductionRate, null);
  assert.equal(empty.averageLatencyMs, null);
  assert.equal(empty.p95LatencyMs, null);
  assert.doesNotMatch(JSON.stringify(empty), /NaN/);
  const latencies = Array.from({ length: 20 }, (_, index) => event({ totalLatencyMs: index + 1 }));
  assert.equal(summarizeAssistantAnalytics(latencies).p95LatencyMs, 19);
});

test('computes the All Maya baseline, deflection and positive avoided calls', () => {
  const events = [
    ...Array.from({ length: 600 }, () => event()),
    ...Array.from({ length: 100 }, () => event({
      assistantRoute: 'capability', resolutionPath: 'classifier_to_capability',
      capability: 'reception_contact', classifierIntent: 'reception_contact',
      classifierConfidenceBand: 'high', classifierCalls: 1,
      totalUpstreamCalls: 1, classifierLatencyMs: 5,
    })),
    ...Array.from({ length: 50 }, () => event({
      assistantRoute: 'ai', resolutionPath: 'classifier_to_ai',
      classifierIntent: 'general_chat', classifierConfidenceBand: 'medium',
      classifierCalls: 1, fullAiCalls: 1, totalUpstreamCalls: 2,
      classifierLatencyMs: 5, fullAiLatencyMs: 20,
    })),
    ...Array.from({ length: 250 }, () => event({
      assistantRoute: 'ai', resolutionPath: 'direct_ai', fullAiCalls: 1,
      totalUpstreamCalls: 1, fullAiLatencyMs: 20,
    })),
  ];
  const summary = summarizeAssistantAnalytics(events);
  assert.equal(summary.aiEligibleMessages, 1_000);
  assert.equal(summary.totalClassifierCalls, 150);
  assert.equal(summary.totalFullAiCalls, 300);
  assert.equal(summary.totalUpstreamCalls, 450);
  assert.equal(summary.upstreamCallsAvoidedVsAllMaya, 550);
  assert.equal(summary.fullAiDeflectionRate, 0.7);
  assert.equal(summary.upstreamCallReductionRate, 0.55);
});

test('preserves zero and negative call reduction when classifier-to-AI uses two calls', () => {
  const oneDirect = event({ assistantRoute: 'ai', resolutionPath: 'direct_ai',
    fullAiCalls: 1, totalUpstreamCalls: 1, fullAiLatencyMs: 10 });
  const twoCalls = event({
    assistantRoute: 'ai', resolutionPath: 'classifier_to_ai',
    classifierIntent: 'general_chat', classifierConfidenceBand: 'low',
    classifierCalls: 1, fullAiCalls: 1, totalUpstreamCalls: 2,
    classifierLatencyMs: 4, fullAiLatencyMs: 10,
  });
  assert.equal(summarizeAssistantAnalytics([oneDirect]).upstreamCallsAvoidedVsAllMaya, 0);
  const negative = summarizeAssistantAnalytics([twoCalls]);
  assert.equal(negative.upstreamCallsAvoidedVsAllMaya, -1);
  assert.equal(negative.upstreamCallReductionRate, -1);
  assert.equal(negative.twoCallMessages, 1);
});

test('filters by server hotel, language, capability and resolution path', () => {
  const events = [
    event({ capability: 'human_handoff', actionType: 'open_url' }),
    event({ hotelScope: { kind: 'resolved', hotelId: HOTEL_B }, language: 'en',
      capability: 'reception_contact', actionType: 'open_url' }),
    event({ hotelScope: { kind: 'unattributed' }, language: null, outcome: 'rate_limited' }),
  ];
  assert.equal(summarizeAssistantAnalytics(events, { hotelId: HOTEL_A }).totalHandledMessages, 1);
  assert.equal(summarizeAssistantAnalytics(events, { language: 'en' }).totalHandledMessages, 1);
  assert.equal(summarizeAssistantAnalytics(events, { capability: 'human_handoff' }).totalHandledMessages, 1);
  assert.equal(summarizeAssistantAnalytics(events, { resolutionPath: 'deterministic' }).totalHandledMessages, 3);
  const unattributedOnly = summarizeAssistantAnalytics([events[2]], { hotelId: HOTEL_A });
  assert.equal(unattributedOnly.totalHandledMessages, 0);
  assert.equal(unattributedOnly.rateLimitedMessages, 0);
});

test('rate limit is unattributed before hotel resolution and carries no AI latency', () => {
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const rateLimitBranch = route.slice(
    route.indexOf('if (!rateLimit.allowed)'),
    route.indexOf('try {', route.indexOf('if (!rateLimit.allowed)'))
  );
  assert.match(rateLimitBranch, /hotelScope: \{ kind: 'unattributed' \}/);
  assert.match(rateLimitBranch, /outcome: 'rate_limited'/);
  assert.match(rateLimitBranch, /classifierCalls: 0[\s\S]*fullAiCalls: 0[\s\S]*totalUpstreamCalls: 0/);
  assert.match(rateLimitBranch, /classifierLatencyMs: null[\s\S]*fullAiLatencyMs: null/);
  assert.ok(route.indexOf('if (!rateLimit.allowed)') < route.indexOf('runAssistantChat(validation.value'));
  assert.doesNotMatch(rateLimitBranch, /hotelId|validation\.value\.hotelSlug[^\n]*hotelScope/);
});

test('the route has mutually exclusive final record sites and the recorder has no retry', () => {
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const recorder = read('lib', 'server', 'assistant-analytics', 'recorder.ts');
  assert.equal((route.match(/recordFinalEvent\(\{/g) ?? []).length, 5);
  assert.match(route, /if \(!rateLimit\.allowed\)[\s\S]*recordFinalEvent\(\{[\s\S]*return NextResponse\.json\(/);
  assert.match(route, /if \(!result\)[\s\S]*recordFinalEvent\(\{[\s\S]*return NextResponse\.json\(SAFE_ERROR, \{ status: 404 \}\)/);
  assert.match(route, /const analytics = result\[ASSISTANT_CHAT_ANALYTICS\][\s\S]*recordFinalEvent\(\{[\s\S]*return NextResponse\.json\(\{/);
  assert.match(route, /if \(caught instanceof AssistantChatExecutionError\)[\s\S]*recordFinalEvent\(\{[\s\S]*return NextResponse\.json/);
  assert.match(route, /return NextResponse\.json\(SAFE_ERROR, \{ status: 500 \}\);[\s\S]*recordFinalEvent\(\{[\s\S]*return NextResponse\.json\(SAFE_ERROR, \{ status: 500 \}\)/);
  assert.doesNotMatch(recorder, /retry|setTimeout|while\s*\(|for\s*\(/i);
  assert.equal((recorder.match(/sink\.record\(/g) ?? []).length, 1);
  assert.doesNotMatch(recorder, /console\./);
});

test('keeps tourism closed and leaves persistence and browser analytics absent', () => {
  assert.deepEqual(ASSISTANT_ANALYTICS_TOURISM_SOURCES, ['libguest_curated', 'general_ai', 'unavailable']);
  for (const tourismSource of ASSISTANT_ANALYTICS_TOURISM_SOURCES) {
    assert.equal(event({ tourismSource }).tourismSource, tourismSource);
  }
  const sources = [
    read('lib', 'server', 'assistant-analytics', 'sink.ts'),
    read('lib', 'server', 'assistant-analytics', 'instrumentation.ts'),
    read('app', 'api', 'assistant', 'chat', 'route.ts'),
  ].join('\n');
  assert.doesNotMatch(sources, /createAdminClient|createPublicClient|supabase|\.from\(|\.insert\(|fetch\(|console\.log/);
  assert.doesNotMatch(sources, /\/api\/analytics/);
});
