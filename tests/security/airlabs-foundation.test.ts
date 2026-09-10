import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { normalizeLive, normalizeLiveStatus, normalizeSchedule, normalizeScheduleStatus, validateFlightStatusRequest } from '../../lib/flights/flight-status.ts';
import { scheduleFixture, liveFixture, timedScheduleFixture, timedLiveFixture } from './fixtures/airlabs.ts';

// Next supplies this build-time poison pill; native node:test has no Next resolver.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { createAirLabsClient } = await import('../../lib/flights/airlabs.server.ts');
const { createFlightStatusHandler } = await import('../../lib/flights/flight-status-handler.server.ts');
hooks.deregister();

const query = { flight_iata: 'G37656', departureDate: '2026-09-06', scheduledDepartureAt: '2026-09-06T22:45:00-03:00', departureAirport: 'GIG', arrivalAirport: 'AEP' };
const now = new Date('2026-09-07T02:01:00Z');
const input = { ...query, hotelSlug: 'hotel-a' };
function normalized() {
  const result = normalizeSchedule([timedScheduleFixture], query, now);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('fixture');
  return result.data;
}
function request(body: unknown = input) {
  return new Request('https://libguest.test/api/flights/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
function clientFor(payload: unknown, status = 200) {
  return createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async () => Response.json(payload, { status }) });
}

test('normalizes the manual schedule without conflating planned, estimated and actual times', () => {
  const result = normalizeSchedule([scheduleFixture], query, now);
  assert.ok(result.ok);
  assert.equal(result.data.scheduleStatus, 'active');
  assert.equal(result.data.liveStatus, null);
  assert.deepEqual(result.data.scheduledDeparture, { local: '2026-09-06T22:45:00', utc: null });
  assert.equal(result.data.estimatedDeparture?.local, '2026-09-06T22:35:00');
  assert.equal(result.data.actualDeparture?.local, '2026-09-06T22:35:00');
  assert.equal(result.data.departureTerminal, '2');
  assert.equal(result.data.departureGate, 'C46');
  assert.equal(result.data.scheduledArrival, null);
});

test('keeps endpoint status vocabularies separate, including unknown values', () => {
  assert.equal(normalizeScheduleStatus('active'), 'active');
  assert.equal(normalizeLiveStatus('active'), 'unknown');
  assert.equal(normalizeScheduleStatus('en-route'), 'unknown');
  assert.equal(normalizeLiveStatus('en-route'), 'en-route');
  assert.equal(normalizeScheduleStatus('secret arbitrary status'), 'unknown');
  assert.equal(normalizeLiveStatus('landed'), 'unknown');
});

test('matches live only with a compatible schedule and fresh temporal evidence', () => {
  const result = normalizeLive([timedLiveFixture], query, normalized(), now);
  assert.ok(result.ok);
  assert.equal(result.data.liveStatus, 'en-route');
  assert.equal(result.data.scheduleStatus, 'active');
  assert.equal(result.data.liveSourceType, 'adsb');
  assert.equal(result.data.provenance.live, 'matched');
  assert.deepEqual(normalizeLive([liveFixture], query, normalized(), now), { ok: false, error: 'occurrence_unverified' });
});

test('live without schedule or stale/future evidence never verifies a flight', () => {
  assert.deepEqual(normalizeLive([timedLiveFixture], query, null, now), { ok: false, error: 'occurrence_unverified' });
  for (const updated of [0, timedLiveFixture.updated - 3600, timedLiveFixture.updated + 3600]) {
    assert.deepEqual(normalizeLive([{ ...timedLiveFixture, updated }], query, normalized(), now), { ok: false, error: 'occurrence_unverified' });
  }
  assert.deepEqual(normalizeLive([timedLiveFixture], { ...query, departureDate: '2026-09-05' }, normalized(), now), { ok: false, error: 'occurrence_unverified' });
});

test('partial fields are nullable and arbitrary provider properties never enter the contract', () => {
  const result = normalizeSchedule([{ ...scheduleFixture, dep_gate: '<script>', api_key: 'DO_NOT_RETURN', passenger: 'DO_NOT_RETURN',
    status: 'DO_NOT_RETURN', dep_delayed: 10, arr_delayed: 20, arr_time: '2026-09-07 02:00' }], query, now);
  assert.ok(result.ok);
  assert.equal(result.data.departureGate, null);
  assert.equal(result.data.scheduleStatus, 'unknown');
  assert.deepEqual(result.data.delayedMinutes, { departure: 10, arrival: 20 });
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_RETURN|api_key|passenger/);
});

test('distinguishes not found, invalid identity time, date mismatch and ambiguity', () => {
  assert.deepEqual(normalizeSchedule([{}], query, now), { ok: false, error: 'invalid_payload' });
  assert.deepEqual(normalizeLive([{}], query, normalized(), now), { ok: false, error: 'invalid_payload' });
  assert.deepEqual(normalizeSchedule([], query, now), { ok: false, error: 'not_found' });
  assert.deepEqual(normalizeSchedule([{ ...scheduleFixture, dep_time: 'invalid' }], query, now), { ok: false, error: 'invalid_payload' });
  assert.deepEqual(normalizeSchedule([scheduleFixture], { ...query, departureDate: '2026-09-05' }, now), { ok: false, error: 'not_found' });
  assert.deepEqual(normalizeSchedule([scheduleFixture, scheduleFixture], query, now), { ok: false, error: 'ambiguous' });
  assert.deepEqual(normalizeLive([timedLiveFixture, timedLiveFixture], query, normalized(), now), { ok: false, error: 'ambiguous' });
});

test('validates bounded IATA references, dates and an exact public input allowlist', () => {
  assert.equal(validateFlightStatusRequest({ ...input, flight_iata: ' g37656 ' })?.flight_iata, 'G37656');
  for (const flight_iata of ['https://evil.test', 'G3/7656', 'G37656&api_key=x', 'G376567', '123456', '']) {
    assert.equal(validateFlightStatusRequest({ ...input, flight_iata }), null);
  }
  for (const extra of [{ hotelId: 'foreign' }, { roomToken: 'private' }, { url: 'https://evil.test' }, { name: 'person' }]) {
    assert.equal(validateFlightStatusRequest({ ...input, ...extra }), null);
  }
  assert.equal(validateFlightStatusRequest({ ...input, departureDate: '2026-02-30' }), null);
  assert.equal(validateFlightStatusRequest({ ...input, includeLive: 'true' }), null);
  for (const scheduledDepartureAt of ['2026-09-06T22:45:00', '2026-09-07T22:45:00Z', '2026-09-06T22:45:00+15:00', '2026-09-06T25:45:00Z']) {
    assert.equal(validateFlightStatusRequest({ ...input, scheduledDepartureAt }), null);
  }
});

test('server transport and orchestration use a fixed origin, secret env, bounded errors and no retries', async (t) => {
  const prior = process.env.AIRLABS_API_KEY;
  t.after(() => { if (prior === undefined) delete process.env.AIRLABS_API_KEY; else process.env.AIRLABS_API_KEY = prior; });
  process.env.AIRLABS_API_KEY = 'synthetic-test-secret';
  await t.test('fixed host and paths; only explicit flight fields are sent; schedule is the default', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async (url, init) => {
      calls++;
      const target = new URL(String(url));
      assert.equal(target.origin, 'https://airlabs.co');
      assert.equal(target.pathname, '/api/v9/schedules');
      assert.equal(target.searchParams.get('api_key'), 'synthetic-test-secret');
      assert.deepEqual([...target.searchParams.keys()].sort(), ['api_key', 'arr_iata', 'dep_iata', 'flight_iata']);
      assert.equal(init?.redirect, 'error');
      assert.equal(init?.cache, 'no-store');
      return Response.json({ response: [scheduleFixture], request: { key: 'synthetic-test-secret' } });
    } });
    const result = await client.lookup({ ...query, url: 'https://evil.test' } as typeof query);
    assert.ok(result.ok);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-test-secret|evil/);
  });
  await t.test('ten-hour horizon is inclusive, with no schedules or live fetch beyond it', async () => {
    const boundaryNow = new Date('2026-09-06T15:45:00Z');
    for (const [difference, expectedCalls] of [[-1, 0], [0, 1], [1, 1]] as const) {
      let calls = 0;
      const client = createAirLabsClient({ consumePermit: () => true, now: () => new Date(boundaryNow.getTime() + difference), fetchImpl: async () => {
        calls++;
        return Response.json({ response: [] });
      } });
      const result = await client.lookup(query, true);
      assert.equal(calls, expectedCalls);
      assert.deepEqual(result, { ok: false, error: expectedCalls ? 'not_found' : 'outside_provider_window' });
    }
  });
  await t.test('a future date consumes no quota and is not not_found', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async () => { calls++; return Response.json({ response: [] }); } });
    const result = await client.lookup({ ...query, departureDate: '2026-10-01', scheduledDepartureAt: '2026-10-01T10:00:00-03:00' }, true);
    assert.deepEqual(result, { ok: false, error: 'outside_provider_window' });
    assert.equal(calls, 0);
  });
  await t.test('inside-window schedule can be found and a missing occurrence remains not_found', async () => {
    const clock = () => new Date('2026-09-06T22:00:00Z');
    let calls = 0;
    for (const rows of [[scheduleFixture], []]) {
      const client = createAirLabsClient({ consumePermit: () => true, now: clock, fetchImpl: async () => { calls++; return Response.json({ response: rows }); } });
      const result = await client.schedules(query);
      assert.equal(result.ok, rows.length > 0);
      if (!result.ok) assert.equal(result.error, 'not_found');
    }
    assert.equal(calls, 2);
  });
  await t.test('window comparison handles midnight and explicit offsets without server timezone assumptions', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, now: () => new Date('2026-09-06T23:30:00Z'), fetchImpl: async () => { calls++; return Response.json({ response: [] }); } });
    assert.deepEqual(await client.schedules({ ...query, departureDate: '2026-09-07', scheduledDepartureAt: '2026-09-07T06:30:00-03:00' }), { ok: false, error: 'not_found' });
    assert.deepEqual(await client.schedules({ ...query, departureDate: '2026-09-07', scheduledDepartureAt: '2026-09-07T06:30:01-03:00' }), { ok: false, error: 'outside_provider_window' });
    assert.equal(calls, 1);
  });
  await t.test('date-only queries distinguish certainly future dates from an unverifiable window without fetching', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async () => { calls++; return Response.json({ response: [] }); } });
    assert.deepEqual(await client.lookup({ ...query, departureDate: '2026-10-01', scheduledDepartureAt: undefined }, true), { ok: false, error: 'outside_provider_window' });
    assert.deepEqual(await client.lookup({ ...query, scheduledDepartureAt: undefined }, true), { ok: false, error: 'provider_window_unverified' });
    assert.equal(calls, 0);
  });
  await t.test('public handler returns 422 for outside-window input and never reaches provider', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async () => { calls++; return Response.json({ response: [] }); } });
    const handler = createFlightStatusHandler({ authorize: async () => ({ hotelId: 'test-hotel' }), lookup: client.lookup });
    const response = await handler(request({ ...input, departureDate: '2026-10-01', scheduledDepartureAt: '2026-10-01T10:00:00-03:00', includeLive: true }));
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { ok: false, error: 'outside_provider_window' });
    const undetermined = await handler(request({ ...input, scheduledDepartureAt: undefined }));
    assert.equal(undetermined.status, 422);
    assert.deepEqual(await undetermined.json(), { ok: false, error: 'provider_window_unverified' });
    assert.equal(calls, 0);
  });
  await t.test('live is conditional and keeps schedule when live is missing or fails', async () => {
    for (const liveResponse of [Response.json({ response: [] }), Response.json({ error: { code: 'month_limit_exceeded' } })]) {
      let calls = 0;
      const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async (url) => {
        calls++;
        return String(url).includes('/schedules?') ? Response.json({ response: [timedScheduleFixture] }) : liveResponse;
      } });
      const result = await client.lookup(query, true);
      assert.ok(result.ok);
      assert.equal(calls, 2);
      assert.equal(result.data.scheduleStatus, 'active');
      assert.equal(result.data.liveStatus, null);
      assert.ok(['not_found', 'quota_exceeded'].includes(result.data.provenance.live));
    }
  });
  await t.test('schedule and live succeed together without overwriting schedule fields', async () => {
    const client = createAirLabsClient({ consumePermit: () => true, now: () => now, fetchImpl: async (url) => Response.json({ response:
      String(url).includes('/schedules?') ? [timedScheduleFixture] : [timedLiveFixture] }) });
    const result = await client.lookup(query, true);
    assert.ok(result.ok);
    assert.equal(result.data.liveStatus, 'en-route');
    assert.equal(result.data.departureGate, 'C46');
  });
  await t.test('does not spend a live call without a schedule or a UTC anchor', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, fetchImpl: async () => { calls++; return Response.json({ response: [scheduleFixture] }); } });
    assert.deepEqual(await client.live(query, null), { ok: false, error: 'occurrence_unverified' });
    assert.equal(calls, 0);
    await client.lookup(query, true);
    assert.equal(calls, 1);
  });
  await t.test('missing key and invalid input never call fetch', async () => {
    delete process.env.AIRLABS_API_KEY;
    const client = createAirLabsClient({ consumePermit: () => true, fetchImpl: async () => { throw new Error('unexpected'); } });
    assert.deepEqual(await client.schedules(query), { ok: false, error: 'key_missing' });
    assert.deepEqual(await client.schedules({ ...query, flight_iata: 'bad/url' }), { ok: false, error: 'invalid_input' });
    process.env.AIRLABS_API_KEY = 'synthetic-test-secret';
  });
  await t.test('handles provider HTTP and JSON errors without leaking messages', async () => {
    for (const [status, error] of [[404, 'not_found'], [429, 'quota_exceeded'], [500, 'provider_error'], [401, 'provider_auth']] as const) {
      assert.deepEqual(await clientFor({ message: 'synthetic-test-secret' }, status).schedules(query), { ok: false, error });
    }
    for (const [code, error] of [['not_found', 'not_found'], ['month_limit_exceeded', 'quota_exceeded'], ['unknown_api_key', 'provider_auth'], ['internal_error', 'provider_error']] as const) {
      assert.deepEqual(await clientFor({ error: { code, message: 'synthetic-test-secret' } }).schedules(query), { ok: false, error });
    }
    for (const payload of [null, {}, { response: {} }]) assert.deepEqual(await clientFor(payload).schedules(query), { ok: false, error: 'invalid_payload' });
    assert.deepEqual(await clientFor({ response: [scheduleFixture], request: { has_more: true } }).schedules(query), { ok: false, error: 'ambiguous' });
  });
  await t.test('rejects malformed JSON, redirects, oversized bodies and network failures', async () => {
    for (const response of [new Response('{', { headers: { 'Content-Type': 'application/json' } }), new Response('x'.repeat(262145), { headers: { 'Content-Type': 'application/json' } })]) {
      assert.deepEqual(await createAirLabsClient({ consumePermit: () => true, fetchImpl: async () => response }).schedules(query), { ok: false, error: 'invalid_payload' });
    }
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, fetchImpl: async () => { calls++; throw new Error('redirect or network synthetic-test-secret'); } });
    assert.deepEqual(await client.schedules(query), { ok: false, error: 'provider_error' });
    assert.equal(calls, 1);
  });
  await t.test('aborts a stalled provider after four seconds without retry', async () => {
    let calls = 0;
    const client = createAirLabsClient({ consumePermit: () => true, fetchImpl: async (_url, init) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    } });
    assert.deepEqual(await client.schedules(query), { ok: false, error: 'timeout' });
    assert.equal(calls, 1);
  });
});

test('public handler rejects invalid bodies before authorization or supplier access', async () => {
  let calls = 0;
  const handler = createFlightStatusHandler({ authorize: async () => { calls++; return { hotelId: 'test-hotel' }; }, lookup: async () => { throw new Error('unexpected'); } });
  assert.equal((await handler(new Request('https://test', { method: 'POST', body: '{}' }))).status, 415);
  assert.equal((await handler(request({ ...input, extra: 'x'.repeat(2100) }))).status, 413);
  assert.equal((await handler(request({ ...input, hotelId: 'foreign' }))).status, 400);
  assert.equal((await handler(new Request('https://test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal(calls, 0);
});

test('hotel without entitlement cannot reach AirLabs; errors and payload stay bounded', async () => {
  let calls = 0;
  const blocked = createFlightStatusHandler({ authorize: async () => false, lookup: async () => { calls++; return { ok: false, error: 'not_found' }; } });
  assert.equal((await blocked(request())).status, 403);
  assert.equal(calls, 0);
  for (const [error, status] of [['key_missing', 503], ['timeout', 504], ['not_found', 404], ['ambiguous', 409], ['invalid_payload', 502], ['quota_exceeded', 503]] as const) {
    const handler = createFlightStatusHandler({ authorize: async (slug, airport) => slug === 'hotel-a' && airport === 'GIG' ? { hotelId: 'test-hotel' } : false, lookup: async (flight) => {
      assert.deepEqual(flight, query);
      return { ok: false, error };
    } });
    const response = await handler(request());
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: false, error });
  }
});

test('route wiring resolves public hotel server-side and checks entitlement before airport projection', () => {
  const route = readFileSync('app/api/flights/status/route.ts', 'utf8');
  assert.match(route, /from\('public_hotels'\)\.select\('id'\)\.eq\('slug', hotelSlug\)/);
  assert.match(route, /isHotelModuleEnabled\(hotel\.id, 'travel\.flights'\)/);
  assert.match(route, /p_hotel_id: hotel\.id/);
  assert.match(route, /airport\.airport_iata_code === departureAirport/);
  const transport = readFileSync('lib/flights/airlabs.server.ts', 'utf8');
  assert.match(transport, /import 'server-only'/);
  assert.match(transport, /process\.env\.AIRLABS_API_KEY/);
  assert.doesNotMatch(transport, /NEXT_PUBLIC_|console\.|roomToken/);
});
