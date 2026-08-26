import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { getPublicFlightCenterCopy } from '../../lib/public-flight-center-copy.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '202608250005_51_public_flight_home_card.sql');
const matrix = read('supabase', 'tests', '51_public_flight_home_card_behavioral_matrix.sql');
const data = read('lib', 'public-hotel-data.ts');
const card = read('components', 'public', 'public-flight-home-card.tsx');
const genericHome = read('components', 'public', 'hotel-public-page-content.tsx');
const grandMercureHome = read('components', 'public', 'grand-mercure', 'grand-mercure-public-home.tsx');
const mercureHome = read('components', 'public', 'mercure', 'mercure-public-home.tsx');
const novotelHome = read('components', 'public', 'novotel', 'novotel-public-home.tsx');

test('exposes the home card only for an entitled, enabled and operational Flight Center', () => {
  assert.match(migration, /join public\.hotel_flight_settings s on s\.hotel_id=h\.id/);
  assert.match(migration, /and s\.home_card_enabled/);
  assert.match(migration, /is_hotel_module_enabled\(h\.id,'travel\.flights'\)/);
  assert.match(migration, /exists\([\s\S]*?hotel_airports ha[\s\S]*?airports a[\s\S]*?a\.is_active[\s\S]*?ha\.is_active/);
  assert.match(migration, /from public\.public_hotels h/);
  assert.doesNotMatch(migration, /grant select[\s\S]{0,100}(?:hotel_flight_settings|hotel_airports|airports)/i);
});

test('loads one narrow server-decided card and renders nothing when the RPC returns no row', () => {
  assert.match(data, /rpc\('get_public_hotel_flight_home_card'/);
  assert.match(data, /flightHomeCardRow \? \{/);
  assert.match(data, /\} : null/);
  for (const home of [genericHome, grandMercureHome, mercureHome, novotelHome]) {
    assert.match(home, /flightHomeCard \?/);
  }
});

test('places the card after the approved themed grid and before Highlights', () => {
  for (const home of [grandMercureHome, mercureHome, novotelHome]) {
    const grid = home.lastIndexOf('{cardGridSection}');
    const flight = home.lastIndexOf('{flightCard}');
    const highlights = home.lastIndexOf('{highlights}');
    assert.ok(grid >= 0 && grid < flight && flight < highlights);
  }
  assert.ok(genericHome.indexOf('<PublicFlightHomeCard') < genericHome.indexOf("highlightsState !== 'hidden'"));
});

test('uses the official route helper for slug, subdomain and language preservation', () => {
  assert.match(card, /buildPublicHotelFlightCenterHref\(\{/);
  assert.match(card, /slug: hotelSlug/);
  assert.match(card, /language,/);
  assert.match(card, /domainContext,/);
  assert.match(card, /preferSubdomainRoot,/);
  assert.doesNotMatch(card, /\/hotel\/\$\{|\/explorar\/voos/);
});

test('centralizes localized fallback copy while preserving configured public text', () => {
  assert.equal(getPublicFlightCenterCopy('pt').homeCardTitle, 'Acompanhe seu voo');
  assert.equal(getPublicFlightCenterCopy('pt').homeCardDescription, 'Consulte seu voo e organize sua saída do hotel.');
  assert.equal(getPublicFlightCenterCopy('pt').homeCardCta, 'Abrir Central de Voos');
  for (const language of ['en', 'es'] as const) {
    const copy = getPublicFlightCenterCopy(language);
    assert.ok(copy.homeCardTitle && copy.homeCardDescription && copy.homeCardCta);
  }
  assert.match(card, /card\.title\?\.trim\(\) \|\| copy\.homeCardTitle/);
  assert.match(card, /card\.description\?\.trim\(\) \|\| copy\.homeCardDescription/);
});

test('keeps one accessible responsive component with a themed variant for every Home', () => {
  assert.match(card, /<a[\s\S]*?href=\{href\}/);
  assert.match(card, /aria-label=/);
  assert.match(card, /focus-visible:ring-2/);
  assert.match(card, /min-w-0/);
  assert.match(grandMercureHome, /variant="grand-mercure"/);
  assert.match(mercureHome, /variant="mercure"/);
  assert.match(novotelHome, /variant="novotel"/);
  assert.match(genericHome, /variant="default"/);
});

test('adds no dock item, preserves the Carioca section and introduces no flight-status state', () => {
  for (const dock of [
    read('components', 'public', 'grand-mercure', 'grand-mercure-mobile-navigation.tsx'),
    read('components', 'public', 'mercure', 'mercure-bottom-dock.tsx'),
    read('components', 'public', 'novotel', 'novotel-mobile-navigation.tsx'),
  ]) assert.doesNotMatch(dock, /flight|voos|plane/i);
  assert.match(grandMercureHome, /GrandMercureBrazilianPillars/);
  assert.match(grandMercureHome, /showRioCopacabanaEditorial/);
  assert.doesNotMatch(card, /localStorage|flight status|countdown|atras|airport|aeroporto|terminal|gate|portão/i);
});

test('does not change the established adaptive grid contracts', () => {
  assert.match(grandMercureHome, /getThemedCardGridLayout\(cards\.length, 2\)/);
  assert.match(mercureHome, /getThemedCardGridLayout\(cards\.length, 2, 'md'\)/);
  assert.match(novotelHome, /getThemedCardGridLayout\(cards\.length, 2, 'xl'\)/);
});

test('ships a rollback-only behavioral matrix for every visibility branch', () => {
  assert.match(matrix, /(?:^|\n)begin;/i);
  assert.match(matrix, /configured card missing/i);
  assert.match(matrix, /disabled card leaked/i);
  assert.match(matrix, /hotel without entitlement leaked/i);
  assert.match(matrix, /non-operational center leaked/i);
  assert.match(matrix, /anon read hotel_flight_settings/i);
  assert.match(matrix, /rollback;\s*$/i);
});
