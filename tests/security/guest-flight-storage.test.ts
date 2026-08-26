import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSavedGuestFlight,
  getGuestFlightStorageKey,
  hasSavedGuestFlightDeparted,
  loadSavedGuestFlight,
  parseSavedGuestFlight,
  removeGuestFlight,
  saveGuestFlight,
  type GuestFlightDraft,
} from '../../lib/guest-flight-storage.ts';
import { getPublicFlightCenterCopy } from '../../lib/public-flight-center-copy.ts';

const HOTEL_A = '50200000-0000-4000-8000-000000000001';
const HOTEL_B = '50200000-0000-4000-8000-000000000002';
const NOW = new Date(2026, 7, 25, 12, 0, 0);
const VALID_DRAFT: GuestFlightDraft = {
  airline: 'la',
  flightNumber: ' 3910 ',
  departureAirport: 'gig',
  arrivalAirport: 'rec',
  departureDate: '2026-08-26',
  scheduledDepartureTime: '19:40',
};

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function validFlight(draft: GuestFlightDraft = VALID_DRAFT) {
  const result = createSavedGuestFlight(HOTEL_A, draft, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected a valid fixture');
  return result.flight;
}

test('scopes the versioned storage key by hotel without room identity', () => {
  assert.notEqual(getGuestFlightStorageKey(HOTEL_A), getGuestFlightStorageKey(HOTEL_B));
  assert.match(getGuestFlightStorageKey(HOTEL_A), /^libguest:flight:.*:v1$/);
  assert.doesNotMatch(getGuestFlightStorageKey(HOTEL_A), /room|token/i);
});

test('saves and loads a valid normalized flight only for its hotel', () => {
  const storage = new MemoryStorage();
  const flight = validFlight();
  assert.equal(saveGuestFlight(HOTEL_A, flight, storage, NOW), true);
  assert.deepEqual(loadSavedGuestFlight(HOTEL_A, storage, NOW), flight);
  assert.equal(loadSavedGuestFlight(HOTEL_B, storage, NOW), null);
  assert.equal(flight.airlineCode, 'LA');
  assert.equal(flight.flightNumber, '3910');
  assert.equal(flight.departureAirport, 'GIG');
  assert.equal(flight.arrivalAirport, 'REC');
  assert.equal(flight.timeBasis, 'departure_airport_local_unverified');
});

test('removes an expired flight defensively while loading', () => {
  const storage = new MemoryStorage();
  const flight = validFlight();
  saveGuestFlight(HOTEL_A, flight, storage, NOW);
  assert.equal(loadSavedGuestFlight(HOTEL_A, storage, new Date(2026, 7, 27, 8, 0, 0)), null);
  assert.equal(storage.getItem(getGuestFlightStorageKey(HOTEL_A)), null);
});

test('discards malformed JSON, invalid schemas and unexpected properties', () => {
  assert.equal(parseSavedGuestFlight('{broken', HOTEL_A), null);
  assert.equal(parseSavedGuestFlight(JSON.stringify({ version: 1 }), HOTEL_A), null);
  assert.equal(parseSavedGuestFlight(JSON.stringify({ ...validFlight(), roomToken: 'secret' }), HOTEL_A), null);
  assert.equal(parseSavedGuestFlight(JSON.stringify({ ...validFlight(), hotelId: HOTEL_B }), HOTEL_A), null);
});

test('rejects equal airports and unreasonable flight numbers', () => {
  const equalAirports = createSavedGuestFlight(HOTEL_A, { ...VALID_DRAFT, arrivalAirport: 'GIG' }, NOW);
  assert.equal(equalAirports.ok, false);
  if (!equalAirports.ok) assert.equal(equalAirports.errors.arrivalAirport, 'same_airport');

  for (const flightNumber of ['', '<script>', '123456789']) {
    const invalid = createSavedGuestFlight(HOTEL_A, { ...VALID_DRAFT, flightNumber }, NOW);
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.errors.flightNumber, 'invalid_flight_number');
  }
});

test('detects a departed flight inside the twelve-hour retention window', () => {
  const flight = validFlight({ ...VALID_DRAFT, departureDate: '2026-08-25', scheduledDepartureTime: '10:00' });
  assert.equal(hasSavedGuestFlightDeparted(flight, NOW), true);
  assert.equal(getPublicFlightCenterCopy('pt').pastFlightWarning, 'O horário planejado já passou. Verifique a situação atual no canal oficial.');
});

test('removing a flight clears storage and the next UI load state', () => {
  const storage = new MemoryStorage();
  saveGuestFlight(HOTEL_A, validFlight(), storage, NOW);
  assert.equal(removeGuestFlight(HOTEL_A, storage), true);
  assert.equal(loadSavedGuestFlight(HOTEL_A, storage, NOW), null);
});

test('keeps all guest-flight copy centralized in Portuguese, English and Spanish', () => {
  for (const language of ['pt', 'en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    assert.ok(copy.providedByYou && copy.statusNotVerified && copy.editFlight && copy.removeFlight);
    assert.ok(copy.pastFlightWarning && copy.homeSavedTime && copy.homeViewFlight);
  }
});

test('uses isolated client components without backend calls or false operational status', () => {
  const root = process.cwd();
  const storage = readFileSync(join(root, 'lib', 'guest-flight-storage.ts'), 'utf8');
  const manager = readFileSync(join(root, 'components', 'public', 'guest-flight-manager.tsx'), 'utf8');
  const homeCard = readFileSync(join(root, 'components', 'public', 'public-flight-home-card.tsx'), 'utf8');
  const homeCardContent = readFileSync(join(root, 'components', 'public', 'public-flight-home-card-content.tsx'), 'utf8');
  const source = `${storage}\n${manager}\n${homeCard}\n${homeCardContent}`;
  assert.doesNotMatch(source, /fetch\(|supabase|server action|roomToken|room_links|data-analytics/i);
  assert.doesNotMatch(source, /No horário|Atrasado|Cancelado|Embarcando|Terminal|Portão|On time|Delayed|Cancelled|Boarding|Gate/i);
  assert.match(manager, /useSyncExternalStore\(subscribe, getSnapshot, \(\) => null\)/);
  assert.match(homeCardContent, /useSyncExternalStore\(subscribe, getSnapshot, \(\) => null\)/);
  assert.match(homeCard, /card\.title\?\.trim\(\) \|\| copy\.homeCardTitle/);
  assert.match(homeCardContent, /savedFlight\.departureAirport} → \$\{savedFlight\.arrivalAirport/);
});
