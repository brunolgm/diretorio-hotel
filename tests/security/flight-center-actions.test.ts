import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildAirportRouteUrl,
  buildFlightCalendarFile,
  buildHotelServiceActionDestination,
} from '../../lib/flight-center-actions.ts';
import { getPublicFlightCenterActionGridLayout } from '../../lib/public-flight-center-layout.ts';
import { getPublicFlightCenterCopy } from '../../lib/public-flight-center-copy.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const manager = read('components', 'public', 'guest-flight-manager.tsx');
const center = read('components', 'public', 'hotel-public-flight-center.tsx');
const actions = read('lib', 'flight-center-actions.ts');

const flight = {
  airlineCode: 'LA',
  airlineName: 'LATAM Airlines Brasil',
  flightNumber: '3910',
  departureAirport: 'GIG',
  arrivalAirport: 'REC',
  departureDate: '2026-08-27',
  scheduledDepartureTime: '19:40',
  savedAt: '2026-08-26T15:00:00.000Z',
};
const airport = {
  iataCode: 'GIG',
  name: 'Aeroporto Internacional do Rio de Janeiro',
  city: 'Rio de Janeiro',
};
const calendarCopy = {
  flightLabel: 'Voo',
  informedTime: 'Horário informado pelo hóspede.',
  statusNotVerified: 'Status não verificado.',
  officialNotice: 'Consulte o canal oficial antes de sair.',
};

test('generates a downloadable calendar event with a safe file name and valid structure', () => {
  const calendar = buildFlightCalendarFile({ flight, airport, copy: calendarCopy });
  assert.ok(calendar);
  assert.equal(calendar.fileName, 'flight-la-3910.ics');
  assert.equal(calendar.mimeType, 'text/calendar;charset=utf-8');
  assert.match(calendar.content, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(calendar.content, /\r\nBEGIN:VEVENT\r\n/);
  assert.match(calendar.content, /\r\nSUMMARY:Voo LA 3910\r\n/);
  assert.match(calendar.content, /\r\nLOCATION:Aeroporto Internacional do Rio de Janeiro \(GIG\)\\, Rio de Janeiro\r\n/);
  assert.match(calendar.content, /\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n$/);
});

test('prevents CRLF injection and escapes ICS text fields', () => {
  const calendar = buildFlightCalendarFile({
    flight: { ...flight, airlineCode: null, airlineName: 'Air, Test; Corp\\Group\r\nATTENDEE:evil' },
    airport,
    copy: { ...calendarCopy, officialNotice: 'Canal, oficial; seguro\\ok\r\nATTACH:evil' },
  });
  assert.ok(calendar);
  assert.doesNotMatch(calendar.content, /\r\n(?:ATTENDEE|ATTACH):evil/);
  assert.match(calendar.content, /SUMMARY:Voo Air\\, Test\\; Corp\\\\Group ATTENDEE:evil 3910/);
  assert.match(calendar.content, /Canal\\, oficial\\; seguro\\\\ok ATTACH:evil/);
});

test('preserves the guest-provided date and time as floating local time', () => {
  const calendar = buildFlightCalendarFile({ flight, airport, copy: calendarCopy });
  assert.ok(calendar);
  assert.match(calendar.content, /\r\nDTSTART:20260827T194000\r\n/);
  assert.doesNotMatch(calendar.content, /DTSTART(?:;TZID=[^:]+)?:20260827T194000Z/);
  assert.match(actions, /Floating local time by design/);
});

test('builds only the fixed HTTPS Google Maps route for a configured airport', () => {
  const route = buildAirportRouteUrl(airport);
  assert.ok(route);
  const url = new URL(route);
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('destination'), `${airport.name} (GIG), ${airport.city}`);
  assert.equal([...url.searchParams.keys()].sort().join(','), 'api,destination');
  assert.doesNotMatch(actions, /fetch\(|XMLHttpRequest|api[_-]?key|geocod/i);
});

test('does not create a route for an unknown or malformed airport', () => {
  assert.equal(buildAirportRouteUrl(null), null);
  assert.equal(buildAirportRouteUrl({ ...airport, iataCode: 'UNKNOWN' }), null);
  const sanitized = buildAirportRouteUrl({ ...airport, name: 'Airport\r\n&evil=1' });
  assert.ok(sanitized);
  const url = new URL(sanitized);
  assert.equal(url.searchParams.has('evil'), false);
  assert.equal(url.searchParams.get('destination'), 'Airport &evil=1 (GIG), Rio de Janeiro');
});

test('uses the hotel WhatsApp when available and the existing contact flow as fallback', () => {
  const message = 'Olá! Gostaria de informações sobre transfer para o aeroporto.';
  const whatsapp = buildHotelServiceActionDestination({
    whatsappNumber: '+55 (21) 99999-0000',
    contactHref: '/hotel/example/contato',
    message,
  });
  assert.equal(whatsapp.isExternal, true);
  const url = new URL(whatsapp.href);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/5521999990000');
  assert.equal(url.searchParams.get('text'), message);

  assert.deepEqual(buildHotelServiceActionDestination({
    whatsappNumber: null,
    contactHref: '/hotel/example/contato',
    message,
  }), { href: '/hotel/example/contato', isExternal: false });
});

test('hotel service actions request contact without creating false confirmations', () => {
  for (const language of ['pt', 'en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    assert.ok(copy.transferRequestMessage);
    assert.ok(copy.wakeUpRequestMessage);
    assert.ok(copy.breakfastBoxRequestMessage);
    assert.ok(copy.receptionRequestMessage);
    assert.doesNotMatch(`${copy.wakeUpRequestMessage} ${copy.breakfastBoxRequestMessage}`, /agendado|scheduled|programado|confirmado|confirmed|disponível|available/i);
  }
  assert.match(center, /message: copy\.transferRequestMessage/);
  assert.match(center, /message: copy\.wakeUpRequestMessage/);
  assert.match(center, /message: copy\.breakfastBoxRequestMessage/);
  assert.match(center, /message: copy\.receptionRequestMessage/);
});

test('keeps disabled hotel actions hidden and reuses the adaptive grid without fillers', () => {
  for (const flag of ['transferEnabled', 'wakeUpEnabled', 'breakfastBoxEnabled', 'receptionEnabled']) {
    assert.match(center, new RegExp(`settings\\.${flag} \\?`));
  }
  assert.match(center, /getPublicFlightCenterActionGridLayout\(actionItems\.length\)/);
  for (const count of [1, 2, 3, 4]) {
    assert.equal(getPublicFlightCenterActionGridLayout(count)?.itemClassNames.length, count);
  }
});

test('keeps all utility actions client-side and outside room identity or sensitive analytics', () => {
  const source = `${manager}\n${center}\n${actions}`;
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|supabase|roomToken|room_links|dangerouslySetInnerHTML|<iframe/i);
  assert.match(manager, /new Blob\(\[calendarFile\.content\]/);
  assert.match(manager, /target="_blank"/);
  assert.match(manager, /rel="noreferrer"/);
  assert.match(center, /rel=\{action\.isExternal \? 'noopener noreferrer'/);
});

test('centralizes complete Stage 8 copy in PT, EN and ES', () => {
  for (const language of ['pt', 'en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    for (const key of [
      'addToCalendar', 'calendarDownloaded', 'calendarUnavailable', 'openAirportRoute', 'transfer', 'wakeUp',
      'breakfastBox', 'reception', 'contactHotel', 'checkAvailability',
    ] as const) assert.ok(copy[key].trim());
  }
  assert.equal(getPublicFlightCenterCopy('pt').breakfastBox, 'Café da manhã para viagem');
  assert.equal(getPublicFlightCenterCopy('en').breakfastBox, 'Breakfast to go');
  assert.equal(getPublicFlightCenterCopy('es').breakfastBox, 'Desayuno para llevar');
});

test('does not add Stage 8 actions to the established hotel homes', () => {
  for (const home of [
    'components/public/grand-mercure/grand-mercure-public-home.tsx',
    'components/public/mercure/mercure-public-home.tsx',
    'components/public/novotel/novotel-public-home.tsx',
  ]) {
    const source = read(...home.split('/'));
    assert.doesNotMatch(source, /buildFlightCalendarFile|buildAirportRouteUrl|buildHotelServiceActionDestination|Adicionar ao calend.rio|Open route to the airport/i);
  }
});
