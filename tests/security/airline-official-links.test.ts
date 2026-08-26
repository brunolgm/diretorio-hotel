import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildAirlineOfficialFlightUrl,
  copyOfficialFlightReference,
  getOfficialFlightReference,
  resolveAirlineOfficialLink,
  sanitizeOfficialFlightNumber,
} from '../../lib/airline-official-links.ts';
import { parseSavedGuestFlight } from '../../lib/guest-flight-storage.ts';
import { getPublicFlightCenterCopy } from '../../lib/public-flight-center-copy.ts';

const HOTEL_ID = '50200000-0000-4000-8000-000000000001';

test('resolves the three initial airline codes to canonical names', () => {
  assert.equal(resolveAirlineOfficialLink('ad')?.name, 'Azul Linhas Aéreas');
  assert.equal(resolveAirlineOfficialLink('LA')?.name, 'LATAM Airlines Brasil');
  assert.equal(resolveAirlineOfficialLink('g3')?.name, 'GOL Linhas Aéreas');
});

test('does not invent an airline for unknown or malformed codes', () => {
  assert.equal(resolveAirlineOfficialLink('XX'), null);
  assert.equal(resolveAirlineOfficialLink('<LA>'), null);
  assert.equal(resolveAirlineOfficialLink(null), null);
});

test('returns only allowlisted HTTPS official domains', () => {
  const allowedOrigins = new Set([
    'https://apps.voeazul.com.br',
    'https://www.latamairlines.com',
    'https://b2c.voegol.com.br',
  ]);
  for (const code of ['AD', 'LA', 'G3']) {
    const url = buildAirlineOfficialFlightUrl(code, ' 3910 ');
    assert.ok(url);
    assert.equal(new URL(url).protocol, 'https:');
    assert.equal(allowedOrigins.has(new URL(url).origin), true);
  }
  assert.equal(buildAirlineOfficialFlightUrl('XX', '3910'), null);
  assert.equal(buildAirlineOfficialFlightUrl('LA', '3910<script>'), null);
});

test('sanitizes the flight reference before clipboard or URL use', () => {
  assert.equal(sanitizeOfficialFlightNumber(' 39 10 '), '3910');
  assert.equal(getOfficialFlightReference('la', ' 39 10 '), 'LA3910');
  assert.equal(sanitizeOfficialFlightNumber('123456789'), null);
  assert.equal(sanitizeOfficialFlightNumber('<3910>'), null);
});

test('clipboard unavailability or failure resolves safely without throwing', async () => {
  assert.equal(await copyOfficialFlightReference(undefined, 'LA', '3910'), false);
  assert.equal(await copyOfficialFlightReference({ writeText: async () => { throw new Error('denied'); } }, 'LA', '3910'), false);
  let copied = '';
  assert.equal(await copyOfficialFlightReference({ writeText: async (value) => { copied = value; } }, 'LA', '3910'), true);
  assert.equal(copied, 'LA3910');
});

test('keeps the airport fallback as a safe external anchor and creates no network client', () => {
  const root = process.cwd();
  const catalog = readFileSync(join(root, 'lib', 'airline-official-links.ts'), 'utf8');
  const manager = readFileSync(join(root, 'components', 'public', 'guest-flight-manager.tsx'), 'utf8');
  const center = readFileSync(join(root, 'components', 'public', 'hotel-public-flight-center.tsx'), 'utf8');
  const source = `${catalog}\n${manager}\n${center}`;
  assert.ok(manager.includes('airportOfficialLinks.find((item) => item.iataCode === flight.departureAirport)'));
  assert.match(manager, /target="_blank"/);
  assert.match(manager, /rel="noreferrer"/);
  assert.match(center, /airport\.officialDeparturesUrl \|\| airport\.officialArrivalsUrl/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|iframe|supabase|roomToken|data-analytics/i);
});

test('centralizes official-channel feedback copy in PT, EN and ES', () => {
  for (const language of ['pt', 'en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    assert.ok(copy.officialAirlineAction && copy.officialAirportAction);
    assert.ok(copy.flightNumberCopied && copy.clipboardUnavailable);
  }
});

test('keeps the original version-one localStorage schema readable unchanged', () => {
  const legacyV1 = {
    version: 1,
    hotelId: HOTEL_ID,
    airlineCode: 'LA',
    airlineName: null,
    flightNumber: '3910',
    departureAirport: 'GIG',
    arrivalAirport: 'REC',
    departureDate: '2026-08-26',
    scheduledDepartureTime: '19:40',
    scheduledDepartureAt: '2026-08-26T19:40:00',
    timeBasis: 'departure_airport_local_unverified',
    source: 'guest',
    savedAt: '2026-08-25T15:00:00.000Z',
    expiresAt: '2026-08-27T07:40:00',
  };
  assert.deepEqual(parseSavedGuestFlight(JSON.stringify(legacyV1), HOTEL_ID), legacyV1);
  assert.equal(Object.hasOwn(legacyV1, 'officialUrl'), false);
});
