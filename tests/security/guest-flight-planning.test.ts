import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { recommendHotelDeparture, type FlightPlanningAirport } from '../../lib/guest-flight-planning.ts';
import { guestStatusQuery, parseFlightDisplay, type FlightDisplay } from '../../lib/guest-flight-status.ts';
import type { SavedGuestFlight } from '../../lib/guest-flight-storage.ts';
import { getFlightPlanningCopy } from '../../lib/public-flight-center-copy.ts';

const flight: SavedGuestFlight = { version: 1, hotelId: 'fixture', airlineCode: 'LA', airlineName: null, flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX', departureDate: '2026-09-08', scheduledDepartureTime: '00:15', scheduledDepartureAt: '2026-09-08T00:15:00', timeBasis: 'departure_airport_local_unverified', source: 'guest', savedAt: '2026-09-07T10:00:00Z', expiresAt: '2026-09-08T12:15:00' };
const airport: FlightPlanningAirport = { iataCode: 'GIG', timezone: 'America/Sao_Paulo', estimatedTransferMinutes: 40, domesticLeadMinutes: 120, internationalLeadMinutes: 180, safetyMarginMinutes: 30 };
const input = { enabled: true, airport, flight, travelType: 'domestic' as const, data: null, now: Date.parse('2026-09-07T10:00:00Z') };
const data: FlightDisplay = { status: 'scheduled', scheduled: '2026-09-08T01:15:00', scheduledUtc: '2026-09-08T04:15:00Z', updated: null, updatedKind: null, terminal: null, gate: null, live: false, updatedAt: '2026-09-07T10:00:00Z' };

test('domestic exact formula and previous calendar day; manual safe zone fallback preserves storage', () => {
  const before = JSON.stringify(flight); const result = recommendHotelDeparture(input); assert.ok(result.available);
  assert.equal(result.recommendedDepartureAt, '2026-09-08T00:05:00.000Z'); // Sep 7, 21:05 at origin
  assert.equal(result.basis, 'manual'); assert.equal(result.lead, 120); assert.equal(JSON.stringify(flight), before);
});
test('international selects configured lead, never domestic substitute', () => {
  const result = recommendHotelDeparture({ ...input, travelType: 'international' }); assert.ok(result.available);
  assert.equal(result.recommendedDepartureAt, '2026-09-07T23:05:00.000Z'); assert.equal(result.lead, 180);
});
test('different airport zone uses fixed airport authority, independent of browser zone', () => {
  const result = recommendHotelDeparture({ ...input, airport: { ...airport, timezone: 'Asia/Kathmandu' } }); assert.ok(result.available);
  assert.equal(result.recommendedDepartureAt, '2026-09-07T15:20:00.000Z');
});
test('validated AirLabs scheduled takes precedence; estimated and actual cannot postpone', () => {
  const result = recommendHotelDeparture({ ...input, data }); assert.ok(result.available);
  assert.equal(result.basis, 'airlabs'); assert.equal(result.recommendedDepartureAt, '2026-09-08T01:05:00.000Z');
  for (const updatedKind of ['estimated', 'actual'] as const) assert.deepEqual(recommendHotelDeparture({ ...input, data: { ...data, updatedKind, updated: '2026-09-08T09:00:00' } }), result);
});
for (const field of ['estimatedTransferMinutes', 'domesticLeadMinutes', 'safetyMarginMinutes'] as const) test(`null ${field} never becomes zero`, () => {
  assert.equal(recommendHotelDeparture({ ...input, airport: { ...airport, [field]: null } }).available, false);
});
test('international missing lead fails closed; explicit zero remains legitimate', () => {
  assert.equal(recommendHotelDeparture({ ...input, travelType: 'international', airport: { ...airport, internationalLeadMinutes: null } }).available, false);
  assert.equal(recommendHotelDeparture({ ...input, airport: { ...airport, safetyMarginMinutes: 0 } }).available, true);
});
test('disabled, unknown, unauthorized, unsafe or inconsistent context hides calculation', () => {
  for (const override of [{ enabled: false }, { travelType: 'unknown' as const }, { airport: null }, { airport: { ...airport, iataCode: 'SDU' } },
    { airport: { ...airport, timezone: null } }, { airport: { ...airport, timezone: 'invalid/zone' } },
    { airport: { ...airport, estimatedTransferMinutes: -1 } }, { airport: { ...airport, safetyMarginMinutes: 721 } },
    { airport: { ...airport, domesticLeadMinutes: 1.5 } }, { data: { ...data, scheduledUtc: '2026-09-08T05:15:00Z' } },
    { data: { ...data, scheduled: '2026-09-09T01:15:00' } }, { now: NaN }]) assert.equal(recommendHotelDeparture({ ...input, ...override }).available, false);
});
for (const status of ['inFlight', 'landed', 'cancelled'] as const) test(`${status} suppresses recommendation`, () => {
  assert.equal(recommendHotelDeparture({ ...input, data: { ...data, status } }).available, false);
});
test('past scheduled, expired recommendation, exact expiry and DST ambiguity hide safely', () => {
  assert.equal(recommendHotelDeparture({ ...input, now: Date.parse('2026-09-08T05:00:00Z') }).available, false);
  assert.equal(recommendHotelDeparture({ ...input, now: Date.parse('2026-09-08T00:05:00Z') }).available, false);
  assert.equal(recommendHotelDeparture({ ...input, now: Date.parse('2026-09-08T00:04:59Z') }).available, true);
  assert.equal(recommendHotelDeparture({ ...input, airport: { ...airport, timezone: 'America/New_York' }, flight: { ...flight, departureDate: '2026-11-01', scheduledDepartureTime: '01:30' } }).available, false);
});
test('conflicting final/live evidence remains unknown visually but blocks planning', () => {
  const query = guestStatusQuery(flight, 'hotel', airport.timezone)!;
  const parsed = parseFlightDisplay({ ok: true, data: { airlineCode: 'LA', flightNumber: '3530', departureAirport: 'GIG', arrivalAirport: 'VIX',
    scheduledDeparture: { local: '2026-09-08T01:15:00', utc: '2026-09-08T04:15:00Z' }, scheduleStatus: 'landed', liveStatus: 'en-route', liveSourceType: 'adsb',
    updatedAt: { live: '2026-09-07T10:00:00Z' }, provenance: { provider: 'airlabs', schedule: 'matched', live: 'matched', fetchedAt: '2026-09-07T10:00:00Z' } } }, query);
  assert.equal(parsed?.status, 'unknown'); assert.equal(parsed?.planningBlocked, true);
  assert.equal(recommendHotelDeparture({ ...input, data: parsed }).available, false);
});
test('PT EN ES transparency and shared UI consume status without additional AirLabs calls', () => {
  assert.deepEqual(['pt', 'en', 'es'].map(l => getFlightPlanningCopy(l as 'pt' | 'en' | 'es').title), ['Saída recomendada do hotel', 'Recommended hotel departure', 'Salida recomendada del hotel']);
  for (const l of ['pt', 'en', 'es'] as const) for (const text of Object.values(getFlightPlanningCopy(l))) assert.ok(text.length > 0);
  const ui = readFileSync('components/public/guest-flight-planning.tsx', 'utf8');
  assert.doesNotMatch(ui, /api\/flights\/status|airlabs-coordinator|localStorage|analytics|grand-mercure|novotel|mercure|hotelId|roomToken/);
  assert.match(ui, /data-flight-recommendation/); assert.match(ui, /planning.notice/); assert.match(ui, /if \(!recommendation.available\)/);
  assert.match(ui, /visibilitychange/); assert.match(ui, /controller.abort\(\)/);
  const center = readFileSync('components/public/hotel-public-flight-center.tsx', 'utf8');
  assert.match(center, /tab !== 'meu-voo' \? planningFallback : null/);
  assert.match(center, /settings.breakfastBoxEnabled \?/);
});

test('compact recommendation keeps its basis and notices outside native collapsed calculation details', () => {
  const ui = readFileSync('components/public/guest-flight-planning.tsx', 'utf8');
  const details = ui.slice(ui.indexOf('<details'), ui.indexOf('</details>'));
  const visible = ui.slice(ui.indexOf('return <aside'), ui.indexOf('<details'));
  for (const token of ['copy.title', 'recommendedDepartureAt', 'copy.local', 'copy[recommendation.basis]', 'copy.estimate', 'planning.notice']) assert.ok(visible.includes(token), token);
  for (const token of ['copy.scheduled', 'copy.lead', 'copy.transfer', 'copy.margin', 'copy.official', '<summary', 'focus-visible:ring-2', 'min-h-11']) assert.ok(details.includes(token), token);
  assert.doesNotMatch(details, /\bopen[=\s>]|onToggle|onClick|fetch\(/);
  for (const language of ['pt', 'en', 'es'] as const) assert.ok(getFlightPlanningCopy(language).details.length > 10);
});
