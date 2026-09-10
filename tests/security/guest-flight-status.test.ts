import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { airportDepartureInstant, createGuestStatusController, guestStatusQuery, parseFlightDisplay, showManualFlightNotice } from '../../lib/guest-flight-status.ts';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG } from '../../lib/modules/catalog.ts';
import { resolveHotelTheme } from '../../lib/hotel-theme.ts';
import { getPublicFlightCenterCopy } from '../../lib/public-flight-center-copy.ts';
import type { SavedGuestFlight } from '../../lib/guest-flight-storage.ts';

const now = Date.parse('2026-09-07T10:00:00Z');
const flight: SavedGuestFlight = { version: 1, hotelId: '50200000-0000-4000-8000-000000000001', airlineCode: 'LA', airlineName: null, flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX', departureDate: '2026-09-07', scheduledDepartureTime: '07:55', scheduledDepartureAt: '2026-09-07T07:55:00', timeBasis: 'departure_airport_local_unverified', source: 'guest', savedAt: '2026-09-07T09:00:00Z', expiresAt: '2026-09-07T19:55:00' };

test('manual summary leaves status to its controller presentation and avoids duplicate route cells', () => {
  const manager = readFileSync('components/public/guest-flight-manager.tsx', 'utf8');
  const summary = manager.slice(manager.indexOf('manual={'), manager.indexOf('notice={'));
  assert.doesNotMatch(summary, /statusNotVerified|copy.origin|copy.destination|departureAirport|arrivalAirport/);
  assert.match(summary, /copy.localTimeLabel/);
  const status = readFileSync('components/public/guest-flight-status.tsx', 'utf8');
  assert.equal(status.match(/statusNotVerified/g)?.length, 1);
});
const query = guestStatusQuery(flight, 'hotel-test', 'America/Sao_Paulo')!;
function payload(overrides: Record<string, unknown> = {}) {
  return { ok: true, data: { airlineCode: 'LA', flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX', scheduleStatus: 'active',
    scheduledDeparture: { local: '2026-09-07T07:55:00', utc: '2026-09-07T10:55:00Z' }, estimatedDeparture: { local: '2026-09-07T07:56:00' }, actualDeparture: null,
    departureTerminal: '2', departureGate: 'B25', liveStatus: null, liveSourceType: null, updatedAt: { schedule: null, live: null },
    provenance: { provider: 'airlabs', schedule: 'matched', live: 'not_requested', fetchedAt: '2026-09-07T10:00:00Z' }, ...overrides } };
}
test('airport zone resolution preserves manual v1 and rejects ambiguous or missing context', () => {
  const before = JSON.stringify(flight);
  assert.equal(query.scheduledDepartureAt, '2026-09-07T07:55:00-03:00');
  assert.equal(JSON.stringify(flight), before);
  assert.equal(airportDepartureInstant('2026-11-01T01:30:00', 'America/New_York'), null);
  assert.equal(airportDepartureInstant('2026-03-08T02:30:00', 'America/New_York'), null);
  assert.equal(airportDepartureInstant('2026-09-07T07:55:00', null), null);
  assert.equal(airportDepartureInstant('2026-09-07T07:55:00', 'invalid/zone'), null);
  assert.equal(airportDepartureInstant('2026-09-07T07:55:00', 'Asia/Kathmandu'), '2026-09-07T07:55:00+05:45');
  assert.equal(guestStatusQuery({ ...flight, airlineCode: null }, 'hotel', 'America/Sao_Paulo'), null);
  assert.equal(query.flight_iata, 'LA3530');
  for (const forbidden of ['hotelId','roomToken','savedAt','source','airlineName']) assert.ok(!(forbidden in query));
});
test('presentation status never equates active or missing delay with in-flight/on-time', () => {
  for (const status of ['scheduled','active','landed','cancelled','unknown']) assert.equal(parseFlightDisplay(payload({ scheduleStatus: status }), query)?.status, status);
  assert.equal(parseFlightDisplay(payload({ scheduleStatus: 'new-provider-status' }), query)?.status, 'unknown');
  const live = { liveStatus: 'en-route', liveSourceType: 'adsb', updatedAt: { live: '2026-09-07T10:00:00Z' }, provenance: { provider: 'airlabs', schedule: 'matched', live: 'matched', fetchedAt: '2026-09-07T10:00:00Z' } };
  assert.equal(parseFlightDisplay(payload(live), query)?.status, 'inFlight');
  assert.equal(parseFlightDisplay(payload({ ...live, scheduleStatus: 'landed' }), query)?.status, 'unknown');
  assert.equal(parseFlightDisplay(payload({ liveStatus: 'en-route' }), query)?.status, 'active');
});
test('missing fields stay absent; actual and estimated preserve their meaning', () => {
  const d = parseFlightDisplay(payload({ departureTerminal: null, departureGate: null, estimatedDeparture: null }), query)!;
  assert.equal(d.terminal, null); assert.equal(d.gate, null); assert.equal(d.updated, null); assert.equal(d.updatedKind, null);
  assert.equal(parseFlightDisplay(payload(), query)?.updatedKind, 'estimated');
  assert.equal(parseFlightDisplay(payload({ actualDeparture: { local: '2026-09-07T07:57:00' } }), query)?.updatedKind, 'actual');
  assert.equal(parseFlightDisplay(payload({ scheduledDeparture: null }), query), null);
  assert.equal(parseFlightDisplay(payload({ arrivalAirport: 'AEP' }), query), null);
});
test('loading and repeated refresh send one request; errors keep last valid response', async t => {
  let resolve!: (r: Response) => void; let calls = 0; let clock = now;
  const controller = createGuestStatusController(query, async () => { calls++; return new Promise<Response>(r => { resolve = r; }); }, () => clock);
  t.after(() => controller.cancel());
  const first = controller.refresh(); assert.equal(controller.getSnapshot().loading, true);
  await controller.refresh(); assert.equal(calls, 1);
  resolve(Response.json(payload())); await first; assert.equal(controller.getSnapshot().data?.status, 'active');
  await controller.refresh(); assert.equal(calls, 1);
  for (const error of ['outside_provider_window','quota_exhausted','rate_limited','not_found','service_unavailable']) {
    clock += 60001; const attempt = controller.refresh(); resolve(Response.json({ ok: false, error }, { status: 503 })); await attempt;
    assert.equal(controller.getSnapshot().error, error); assert.equal(controller.getSnapshot().data?.status, 'active');
  }
});
test('outside window and unverifiable context never call endpoint', async () => {
  let calls = 0; const fetcher: typeof fetch = async () => { calls++; throw Error(); };
  const future = createGuestStatusController({ ...query, scheduledDepartureAt: '2026-09-07T23:55:00-03:00' }, fetcher, () => now);
  await future.refresh(); assert.equal(future.getSnapshot().error, 'outside_provider_window');
  const unknown = createGuestStatusController(null, fetcher); await unknown.refresh(); assert.equal(calls, 0);
});
test('late response after editing/removal cannot publish into the next occurrence', async () => {
  let resolve!: (r: Response) => void;
  const old = createGuestStatusController(query, async () => new Promise<Response>(r => { resolve = r; }), () => now);
  const attempt = old.refresh(); old.cancel(); resolve(Response.json(payload())); await attempt;
  assert.equal(old.getSnapshot().data, null);
  const next = createGuestStatusController(null); assert.equal(next.getSnapshot().data, null);
});
test('PT EN ES copy, theme tokens, hidden nulls and keyed lifecycle', () => {
  assert.deepEqual(['pt','en','es'].map(l => getPublicFlightCenterCopy(l as 'pt'|'en'|'es').flightData.statuses.inFlight), ['Em voo','In flight','En vuelo']);
  for (const l of ['pt','en','es'] as const) for (const value of Object.values(getPublicFlightCenterCopy(l).flightData)) assert.ok(value);
  const ui = readFileSync('components/public/guest-flight-status.tsx','utf8');
  assert.match(ui, /data\.terminal \?/); assert.match(ui, /data\.gate \?/); assert.match(ui, /grid-cols-2/); assert.match(ui, /var\(--hotel-/);
  assert.match(readFileSync('components/public/guest-flight-manager.tsx','utf8'), /GuestFlightStatus key=/);
  assert.doesNotMatch(ui + readFileSync('lib/guest-flight-status.ts','utf8'), /AIRLABS_API_KEY|supabase|roomToken|setInterval|localStorage/);
});
test('verified data leads, manual reference stays compact and unknown retains notice', () => {
  assert.equal(showManualFlightNotice(null), true);
  for (const status of ['scheduled','active','landed','cancelled','unknown']) {
    assert.equal(showManualFlightNotice(parseFlightDisplay(payload({ scheduleStatus: status }), query)), status === 'unknown');
  }
  assert.equal(showManualFlightNotice({ ...parseFlightDisplay(payload(), query)!, status: 'inFlight' }), false);
  const ui = readFileSync('components/public/guest-flight-status.tsx','utf8');
  assert.ok(ui.indexOf('{!data ? manual : null}') < ui.indexOf('<section'));
  assert.ok(ui.indexOf('{data ? compactManual : null}') > ui.indexOf('</section>'));
  assert.match(ui, /showManualFlightNotice\(data\) \? notice : null/);
  assert.match(ui, /data-flight-operational-status/);
  assert.match(readFileSync('components/public/guest-flight-manager.tsx','utf8'), /data-manual-flight-compact/);
  for (const fields of [{departureTerminal:null},{departureGate:null},{departureTerminal:null,departureGate:null}]) {
    const result=parseFlightDisplay(payload(fields),query)!;
    if ('departureTerminal' in fields) assert.equal(result.terminal,null);
    if ('departureGate' in fields) assert.equal(result.gate,null);
  }
});
test('all themes and future hotels use shared opt-in flight experience and per-hotel services', () => {
  for (const preset of ['grand-mercure','novotel','mercure','midnight-slate']) assert.ok(resolveHotelTheme(preset,null));
  const status=readFileSync('components/public/guest-flight-status.tsx','utf8');
  const manager=readFileSync('components/public/guest-flight-manager.tsx','utf8');
  assert.doesNotMatch(status+manager,/grand-mercure|novotel|mercure|hotelId\s*===|hotelSlug\s*===/);
  const center=readFileSync('components/public/hotel-public-flight-center.tsx','utf8');
  assert.equal((center.match(/<GuestFlightManager /g)??[]).length,1);
  assert.match(center,/settings\.breakfastBoxEnabled \?/);
  assert.equal((BASELINE_MODULE_KEYS as readonly string[]).includes('travel.flights'),false);
  assert.equal(MODULE_CATALOG.find(m=>m.key==='travel.flights')?.availability,'available');
  const configuration=readFileSync('supabase/migrations/202608250002_51_flight_center_configuration.sql','utf8');
  assert.match(configuration,/breakfast_box_enabled boolean not null default false/);
  assert.match(configuration,/onboarding_fn ~\* 'travel/);
  const onboarding=readFileSync('app/platform/hoteis/novo/actions.ts','utf8');
  assert.match(onboarding,/rpc\('create_platform_hotel_onboarding'/);
  assert.doesNotMatch(onboarding,/travel\.flights|hotel_flight_settings/);
  const sql=readFileSync('supabase/migrations/202608180001_50_public_experience_composition.sql','utf8');
  const provision=sql.slice(sql.indexOf('create or replace function public.create_platform_hotel_onboarding'));
  assert.match(provision,/baseline_modules',12/);
  assert.doesNotMatch(provision,/travel\.flights/);
  const admin=readFileSync('app/admin/voos/page.tsx','utf8');
  assert.match(admin,/breakfast_box_enabled: false/);
  assert.match(readFileSync('app/admin/voos/actions.ts','utf8'),/\.insert\(\{ hotel_id: profile.hotel_id, \.\.\.payload \}\)/);
  for (const language of ['pt','en','es'] as const) assert.match(getPublicFlightCenterCopy(language).flightData.source,/AirLabs/);
});
