import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeSchedule, validateFlightQuery } from '../../lib/flights/flight-status.ts';
import { timedScheduleFixture, timedLiveFixture } from './fixtures/airlabs.ts';
import type { CoordinatorStore } from '../../lib/flights/airlabs-coordinator.server.ts';

const hooks = registerHooks({ resolve(s, c, next) { return s === 'server-only' ? { url: 'data:text/javascript,export {}', shortCircuit: true } : next(s, c); } });
const { createAirLabsCoordinator, canonicalKey, canonicalQuery, cacheProjection, cacheTtl } = await import('../../lib/flights/airlabs-coordinator.server.ts');
const { createAirLabsClient } = await import('../../lib/flights/airlabs.server.ts');
hooks.deregister();
const now = new Date('2026-09-07T02:01:00Z');
const query = { flight_iata: 'G37656', departureDate: '2026-09-06', scheduledDepartureAt: '2026-09-06T22:45:00-03:00', departureAirport: 'GIG', arrivalAirport: 'AEP' };
const owner = '51000000-0000-4000-8000-000000000001';
function fixture() { const f = normalizeSchedule([timedScheduleFixture], query, now); assert.ok(f.ok); return f.data; }
function harness(options: { admission?: unknown; allowed?: boolean; fail?: 'admit' | 'publish' | 'close'; rows?: unknown[]; published?: boolean } = {}) {
  const events: string[] = [];
  const published: unknown[] = [];
  const store: CoordinatorStore = {
    async admit(_account, hotel, q) {
      events.push(`admit:${q.query_type}:${hotel}`);
      if (options.fail === 'admit') throw Error('offline');
      return options.admission ?? { status: 'fetch_allowed', canonical_key: canonicalKey(q), owner_token: owner, lease_until: new Date(now.getTime() + 15000).toISOString() };
    },
    async publish(_key, _owner, data, ttl) { events.push('publish'); published.push({ data, ttl }); if (options.fail === 'publish') throw Error('offline'); return options.published ?? true; },
    async close(_key, _owner, error) { events.push(`close:${error}`); if (options.fail === 'close') throw Error('offline'); return true; },
  };
  const coordinator = createAirLabsCoordinator({ store, accountScope: 'test-only', now: () => now,
    authorize: async () => { events.push('authorize'); return options.allowed ?? true; },
    fetchImpl: async url => { const live = String(url).includes('/flights?'); events.push(`fetch:${live ? 'live' : 'schedule'}`); return Response.json({ response: options.rows ?? [live ? timedLiveFixture : timedScheduleFixture] }); },
  });
  return { coordinator, events, published };
}
test('distributed coordinator uses fake HTTP only', async t => {
  const previous = process.env.AIRLABS_API_KEY;
  process.env.AIRLABS_API_KEY = 'synthetic-test-only';
  t.after(() => { if (previous === undefined) delete process.env.AIRLABS_API_KEY; else process.env.AIRLABS_API_KEY = previous; });
  await t.test('authorization, reserve, fetch, publish in order; schedule and live reserve separately', async () => {
    const h = harness(); const result = await h.coordinator.lookup(query, true, 'resolved-hotel'); assert.ok(result.ok);
    assert.deepEqual(h.events, ['authorize','admit:schedule:resolved-hotel','fetch:schedule','publish','admit:live:resolved-hotel','fetch:live','publish']);
    assert.equal(h.published.length, 2);
    const serialized = JSON.stringify(h.published);
    for (const forbidden of ['hotel','api_key','synthetic','http','roomToken']) assert.ok(!serialized.includes(forbidden));
  });
  await t.test('cache hit does not fetch or publish and preserves fetchedAt', async () => {
    const h = harness({ admission: { status: 'cache_hit', data: cacheProjection(fixture(), 'schedule') } });
    const result = await h.coordinator.lookup(query, false, 'hotel-b'); assert.ok(result.ok);
    assert.equal(result.data.provenance.fetchedAt, fixture().provenance.fetchedAt);
    assert.deepEqual(h.events, ['authorize','admit:schedule:hotel-b']);
  });
  await t.test('all denied admissions fail closed; no live fallback', async () => {
    for (const status of ['in_progress','quota_exhausted','budget_unavailable','rate_limited','coordinator_unavailable','forbidden','unexpected']) {
      const h = harness({ admission: { status } }); const result = await h.coordinator.lookup(query, true, 'hotel');
      assert.equal(result.ok, false); assert.ok(!h.events.some(e => e.startsWith('fetch:')));
    }
    const h = harness({ fail: 'admit' }); assert.deepEqual(await h.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'coordinator_unavailable' });
  });
  await t.test('authorization applies even to cache hits', async () => {
    const h = harness({ allowed: false, admission: { status: 'cache_hit', data: cacheProjection(fixture(), 'schedule') } });
    assert.deepEqual(await h.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'forbidden' }); assert.deepEqual(h.events, ['authorize']);
  });
  await t.test('live cache is revalidated against current schedule without HTTP', async () => {
    let calls = 0;
    const store: CoordinatorStore = {
      async admit(_account, _hotel, q) { return { status: 'cache_hit', data: q.query_type === 'schedule' ? cacheProjection(fixture(), 'schedule')
        : { liveStatus: 'en-route', liveSourceType: 'adsb', updatedAt: '2026-09-07T02:00:00.000Z' } }; },
      async publish() { throw Error('unexpected publication'); }, async close() { throw Error('unexpected close'); },
    };
    const coordinator = createAirLabsCoordinator({ store, accountScope: 'test-only', authorize: async () => true, now: () => now,
      fetchImpl: async () => { calls++; throw Error('unexpected HTTP'); } });
    const result = await coordinator.lookup(query, true, 'hotel'); assert.ok(result.ok);
    assert.equal(result.data.liveStatus, 'en-route'); assert.equal(calls, 0);
    assert.equal(result.data.provenance.fetchedAt, fixture().provenance.fetchedAt);
  });
  await t.test('outside window performs neither admission nor schedules nor live', async () => {
    const h = harness(); assert.deepEqual(await h.coordinator.lookup({ ...query, departureDate: '2027-01-01', scheduledDepartureAt: '2027-01-01T12:00:00Z' }, true, 'hotel'), { ok: false, error: 'outside_provider_window' });
    assert.deepEqual(h.events, ['authorize']);
  });
  await t.test('not_found closes negatively without a second fetch', async () => {
    const h = harness({ rows: [] }); assert.deepEqual(await h.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'not_found' });
    assert.deepEqual(h.events, ['authorize','admit:schedule:hotel','fetch:schedule','close:not_found']);
  });
  await t.test('lost owner or publication failure fails closed without retry/refund', async () => {
    for (const options of [{ published: false }, { fail: 'publish' as const }, { fail: 'close' as const, rows: [] }]) {
      const h = harness(options); assert.deepEqual(await h.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'coordinator_unavailable' });
      assert.equal(h.events.filter(e => e.startsWith('fetch:')).length, 1);
    }
  });
  await t.test('expired permission and ungated raw client never fetch', async () => {
    const h = harness({ admission: { status: 'fetch_allowed', canonical_key: canonicalKey(canonicalQuery(query, 'schedule')), owner_token: owner, lease_until: now.toISOString() } });
    assert.equal((await h.coordinator.lookup(query, true, 'hotel')).ok, false); assert.ok(!h.events.includes('fetch:schedule'));
    let calls = 0;
    const raw = createAirLabsClient({ consumePermit: () => false, now: () => now, fetchImpl: async () => { calls++; throw Error(); } });
    assert.deepEqual(await raw.schedules(query), { ok: false, error: 'coordinator_unavailable' }); assert.equal(calls, 0);
  });
});
test('closed canonical identity is shared across hotels and splits query kinds', () => {
  const q = canonicalQuery({ ...query, hotel: 'ignored', roomToken: 'ignored' } as typeof query, 'schedule');
  assert.equal(canonicalKey(q), 'airlabs:1:schedule:G37656:2026-09-06:GIG:AEP');
  assert.notEqual(canonicalKey(q), canonicalKey(canonicalQuery(query, 'live')));
});
test('canonical IATA corpus matches SQL input, table and projection tests', () => {
  for (const code of ['G37656','AD4406','LA3582','3G1','AA0','A11234Z']) {
    assert.ok(validateFlightQuery({ ...query, flight_iata: code }), code);
  }
  for (const code of ['123456','G3/7656','G37656&x=1','','G3','G312345','G31234ZZ','AAA123','A'.repeat(100)]) {
    assert.equal(validateFlightQuery({ ...query, flight_iata: code }), null, code);
    assert.deepEqual(normalizeSchedule([{ ...timedScheduleFixture, flight_iata: code }], query, now), { ok: false, error: 'invalid_payload' });
  }
  for (const departureDate of ['2026-02-30','2026-02-29','2026-13-01','2026-00-01','2026-01-00']) {
    assert.equal(validateFlightQuery({ ...query, scheduledDepartureAt: undefined, departureDate }), null);
  }
  assert.ok(validateFlightQuery({ ...query, scheduledDepartureAt: undefined, departureDate: '2028-02-29' }));
});
test('technical cooldown is explicit, never aviation cache and never a fetch permit', async () => {
  const cooldown = harness({ admission: { status: 'provider_cooldown' } });
  assert.deepEqual(await cooldown.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'provider_error' });
  assert.deepEqual(cooldown.events, ['authorize','admit:schedule:hotel']);
  const contaminated = harness({ admission: { status: 'cache_hit', error: 'provider_error' } });
  assert.deepEqual(await contaminated.coordinator.lookup(query, true, 'hotel'), { ok: false, error: 'coordinator_unavailable' });
  assert.deepEqual(contaminated.events, ['authorize','admit:schedule:hotel']);
});
test('server TTL policy covers exact three-hour boundary and final statuses', () => {
  const f = { ...fixture(), scheduleStatus: 'scheduled' as const };
  assert.equal(cacheTtl('schedule', f, { ...query, scheduledDepartureAt: new Date(now.getTime()+3*3600000).toISOString() }, now), 900);
  assert.equal(cacheTtl('schedule', f, { ...query, scheduledDepartureAt: new Date(now.getTime()+3*3600000+1).toISOString() }, now), 3600);
  assert.equal(cacheTtl('schedule', { ...f, scheduleStatus: 'active' }, query, now), 900);
  assert.equal(cacheTtl('schedule', { ...f, scheduleStatus: 'landed' }, query, now), 21600);
  assert.equal(cacheTtl('schedule', { ...f, scheduleStatus: 'cancelled' }, query, now), 3600);
  assert.equal(cacheTtl('live', f, query, now), 300);
});
test('public route imports coordinator, not raw transport', () => {
  const route = readFileSync(new URL('../../app/api/flights/status/route.ts', import.meta.url), 'utf8');
  assert.match(route, /createAirLabsCoordinator/); assert.doesNotMatch(route, /createAirLabsClient|fetch\(/);
});
