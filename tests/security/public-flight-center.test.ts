import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getLocalDevelopmentSubdomain, splitHostAndPort } from '../../lib/domain-host.ts';
import { getPublicFlightCenterActionGridLayout } from '../../lib/public-flight-center-layout.ts';
import { getPublicFlightCenterCopy, normalizePublicFlightCenterTab } from '../../lib/public-flight-center-copy.ts';
import {
  getCanonicalPublicNavigationKeys,
  getPublicNavigationAvailability,
} from '../../lib/public-navigation.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '202608250004_51_public_flight_center.sql');
const matrix = read('supabase', 'tests', '51_public_flight_center_behavioral_matrix.sql');
const data = read('lib', 'public-hotel-data.ts');
const component = read('components', 'public', 'hotel-public-flight-center.tsx');
const slugRoute = read('app', 'hotel', '[slug]', 'explorar', 'voos', 'page.tsx');
const subdomainRoute = read('app', 'explorar', 'voos', 'page.tsx');
const domainContext = read('lib', 'domain-context.ts');

test('creates both dynamic public route variants with the established hotel resolution', () => {
  assert.match(slugRoute, /getPublicFlightCenterDataBySlug\(slug\)/);
  assert.match(slugRoute, /if \(!data\) notFound\(\)/);
  assert.match(subdomainRoute, /isHotelSubdomainContext/);
  assert.match(subdomainRoute, /getPublicFlightCenterDataBySubdomain\(domainContext\.subdomain\)/);
  assert.match(subdomainRoute, /if \(!data\) return <HotelExperienceUnavailable/);
  assert.match(slugRoute, /dynamic = 'force-dynamic'/);
});

test('recognizes the generic local subdomain contract without confusing unknown domains', () => {
  assert.deepEqual(splitHostAndPort('grandmercurecopacabana.localhost:3000'), {
    hostname: 'grandmercurecopacabana.localhost',
    port: '3000',
  });
  assert.equal(getLocalDevelopmentSubdomain('grandmercurecopacabana.localhost'), 'grandmercurecopacabana');
  assert.equal(getLocalDevelopmentSubdomain('hotel.example.com'), null);
  assert.equal(getLocalDevelopmentSubdomain('unknown.example.localhost'), null);
  assert.match(domainContext, /matchedProductRootDomain: 'localhost'/);
  assert.match(domainContext, /validateHotelSubdomain\(localSubdomain\)/);
});

test('exposes one minimal RPC gated by public hotel, entitlement and operational configuration', () => {
  assert.match(migration, /create function public\.get_public_hotel_flight_center\(p_hotel_id uuid\)/);
  assert.match(migration, /from public\.public_hotels h/);
  assert.match(migration, /join public\.hotel_flight_settings s/);
  assert.match(migration, /is_hotel_module_enabled\(h\.id,'travel\.flights'\)/);
  assert.match(migration, /join public\.hotel_airports ha on ha\.hotel_id=h\.id and ha\.is_active/);
  assert.match(migration, /join public\.airports a on a\.id=ha\.airport_id and a\.is_active/);
  const projection = migration.match(/returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] || '';
  assert.doesNotMatch(projection, /(?:hotel_id|airport_id|timezone|latitude|longitude)/i);
});

test('keeps administrative tables private while allowing only the narrow RPC to anon', () => {
  assert.match(migration, /revoke all on function public\.get_public_hotel_flight_center\(uuid\)[\s\S]*from public,anon,authenticated,service_role/);
  assert.match(migration, /grant execute on function public\.get_public_hotel_flight_center\(uuid\) to anon,authenticated/);
  assert.doesNotMatch(migration, /grant select[\s\S]{0,120}(?:airports|hotel_airports|hotel_flight_settings)/i);
  assert.match(migration, /has_table_privilege\('anon','public\.hotel_flight_settings','SELECT'\)/);
  assert.match(data, /rpc\('get_public_hotel_flight_center'/);
  assert.doesNotMatch(data.match(/async function getPublicFlightCenterDataForHotel[\s\S]*?\n}/)?.[0] || '', /\.from\('(?:airports|hotel_airports|hotel_flight_settings)'\)/);
});

test('projects only active linked airports and respects public flags and URL visibility', () => {
  assert.match(migration, /case when s\.official_links_enabled then a\.official_departures_url else null end/);
  assert.match(migration, /case when s\.departure_planning_enabled then ha\.estimated_transfer_minutes else null end/);
  assert.match(component, /settings\.transferEnabled \?/);
  assert.match(component, /settings\.wakeUpEnabled \?/);
  assert.match(component, /settings\.breakfastBoxEnabled \?/);
  assert.match(component, /settings\.receptionEnabled \?/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /<iframe|dangerouslySetInnerHTML/);
});

test('renders no invented flight status and clearly attributes external sources', () => {
  for (const forbidden of ['Em tempo real', 'No horário', 'Atrasado', 'Cancelado', 'terminal', 'portão']) {
    assert.doesNotMatch(component, new RegExp(forbidden, 'i'));
  }
  for (const language of ['pt', 'en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    assert.ok(copy.officialSource.length > 0);
    assert.ok(copy.tabs['meu-voo'] && copy.tabs.partidas && copy.tabs.chegadas);
  }
  assert.equal(normalizePublicFlightCenterTab('unknown'), 'meu-voo');
});

test('delegates My flight to isolated device storage without future integrations', () => {
  assert.match(component, /<GuestFlightManager hotelId=\{hotel\.id\} hotelSlug=\{hotel\.slug\} language=\{language\} airportOptions=\{flightAirportOptions\} \/>/);
  assert.doesNotMatch(`${component}\n${slugRoute}\n${subdomainRoute}`, /sessionStorage|FlightAware|flight status api|roomToken/i);
});

test('does not add flights to any mobile dock or touch room identity', () => {
  for (const dock of [
    read('components', 'public', 'novotel', 'novotel-mobile-navigation.tsx'),
    read('components', 'public', 'grand-mercure', 'grand-mercure-mobile-navigation.tsx'),
    read('components', 'public', 'mercure', 'mercure-bottom-dock.tsx'),
  ]) assert.doesNotMatch(dock, /flight|voos|plane/i);
  assert.doesNotMatch(`${component}\n${data}\n${slugRoute}\n${subdomainRoute}`, /roomToken|room_links|room-context|cookie/i);
});

test('uses the canonical filtered mobile navigation without adding a flight item', () => {
  const available = getPublicNavigationAvailability({
    layout: [
      { blockKey: 'services', isEnabled: true },
      { blockKey: 'quick_info', isEnabled: true },
      { blockKey: 'contact', isEnabled: true },
    ],
    servicesModuleEnabled: true,
    servicesContentCount: 2,
    menuModuleEnabled: false,
    menuContentCount: 1,
  });
  assert.deepEqual(getCanonicalPublicNavigationKeys(available), [
    'home', 'services', 'information', 'contact',
  ]);

  const unavailable = getPublicNavigationAvailability({
    layout: [
      { blockKey: 'services', isEnabled: false },
      { blockKey: 'quick_info', isEnabled: false },
      { blockKey: 'contact', isEnabled: false },
    ],
    servicesModuleEnabled: true,
    servicesContentCount: 2,
    menuModuleEnabled: true,
    menuContentCount: 0,
  });
  assert.deepEqual(getCanonicalPublicNavigationKeys(unavailable), ['home']);
  assert.doesNotMatch(component, /key: ['"](?:flights|voos|tourism|turismo)['"]/i);
  assert.match(component, /getCanonicalPublicNavigationKeys\(navigationAvailability\)/);
  assert.match(data, /p_module_key: 'fb\.menu'/);
  assert.match(data, /service_action_type', 'room_restaurant_menu'/);
  assert.match(data, /get_public_hotel_experience_layout/);
  assert.match(data, /getPublicNavigationAvailability/);
});

test('lays out zero to four filtered hotel actions without fillers', () => {
  assert.equal(getPublicFlightCenterActionGridLayout(0), null);

  const one = getPublicFlightCenterActionGridLayout(1);
  assert.match(one?.containerClassName || '', /grid-cols-1/);
  assert.match(one?.containerClassName || '', /mx-auto max-w-sm/);

  const two = getPublicFlightCenterActionGridLayout(2);
  assert.match(two?.containerClassName || '', /grid-cols-2/);

  const three = getPublicFlightCenterActionGridLayout(3);
  assert.match(three?.containerClassName || '', /grid-cols-4/);
  assert.match(three?.containerClassName || '', /md:grid-cols-3/);
  assert.match(three?.itemClassNames[2] || '', /col-start-2/);
  assert.match(three?.itemClassNames[2] || '', /md:col-start-auto/);

  const four = getPublicFlightCenterActionGridLayout(4);
  assert.match(four?.containerClassName || '', /grid-cols-2/);
  assert.match(four?.containerClassName || '', /md:grid-cols-4/);

  for (const count of [1, 2, 3, 4]) {
    assert.equal(getPublicFlightCenterActionGridLayout(count)?.itemClassNames.length, count);
  }
});

test('keeps Sprint 50 homes outside the Stage 4 change set', () => {
  for (const home of [
    'components/public/grand-mercure/grand-mercure-public-home.tsx',
    'components/public/mercure/mercure-public-home.tsx',
    'components/public/novotel/novotel-public-home.tsx',
  ]) {
    const source = read(...home.split('/'));
    assert.match(source, /enabled\('quick_info'\)/);
    assert.match(source, /enabled\('contact'\)/);
    assert.doesNotMatch(source, /flight center|central de voos|explorar\/voos/i);
  }
});

test('ships a rollback-only behavioral matrix for isolation and anonymous grants', () => {
  assert.match(matrix, /(?:^|\n)begin;/i);
  assert.match(matrix, /inactive, unlinked or foreign airport leaked/i);
  assert.match(matrix, /hotel without travel\.flights accessed center/i);
  assert.match(matrix, /anon read hotel_flight_settings/i);
  assert.match(matrix, /rollback;\s*$/i);
});
