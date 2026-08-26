import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { sendPublicAnalyticsEvent } from '../../lib/public-analytics-client.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const analytics = read('lib', 'analytics.ts');
const client = read('lib', 'public-analytics-client.ts');
const publicAnalytics = read('components', 'public', 'public-analytics.tsx');
const center = read('components', 'public', 'hotel-public-flight-center.tsx');
const manager = read('components', 'public', 'guest-flight-manager.tsx');
const api = read('app', 'api', 'analytics', 'route.ts');
const migration = read('supabase', 'migrations', '202608260001_51_flight_center_analytics.sql');
const publicMigration = read('supabase', 'migrations', '202608250004_51_public_flight_center.sql');
const homeMigration = read('supabase', 'migrations', '202608250005_51_public_flight_home_card.sql');

test('wires every approved Flight Center event without itinerary metadata', () => {
  for (const event of [
    'flight_center_view', 'flight_saved', 'flight_removed', 'flight_official_link_click',
    'flight_calendar_download', 'flight_route_open', 'flight_service_action',
  ]) assert.match(`${analytics}\n${center}\n${manager}`, new RegExp(`['"]${event}['"]`));

  assert.match(center, /pageEventType="flight_center_view"/);
  assert.match(manager, /sendPublicAnalyticsEvent\(\{ hotelSlug, eventType: 'flight_saved', language \}\)/);
  assert.match(manager, /sendPublicAnalyticsEvent\(\{ hotelSlug, eventType: 'flight_removed', language \}\)/);
  assert.match(manager, /sendPublicAnalyticsEvent\(\{ hotelSlug, eventType: 'flight_calendar_download', language \}\)/);
});

test('keeps the analytics payload minimal and server-resolves the hotel from its slug', () => {
  assert.match(api, /from\('public_hotels'\)[\s\S]*\.eq\('slug', payload\.hotelSlug\)/);
  assert.match(api, /hotel_id: hotel\.id/);
  assert.match(api, /metadata: payload\.action \? \{ action: payload\.action \} : \{\}/);
  assert.doesNotMatch(`${client}\n${publicAnalytics}\n${center}\n${manager}`, /analytics[^\n]*(?:flightNumber|airlineCode|airlineName|departureAirport|arrivalAirport|departureDate|scheduledDepartureTime|roomToken)/i);
  assert.doesNotMatch(api, /payload\.(?:flight|number|airline|airport|departure|arrival|room|guest)/i);
});

test('analytics transport failure never throws or blocks the guest action', () => {
  assert.doesNotThrow(() => sendPublicAnalyticsEvent(
    { hotelSlug: 'hotel-a', eventType: 'flight_saved', language: 'pt' },
    {
      sendBeacon: () => { throw new Error('offline'); },
      fetch: () => { throw new Error('offline'); },
    },
  ));
  assert.match(client, /Analytics is best-effort and must never interrupt the guest action/);
  assert.doesNotMatch(`${center}\n${manager}`, /await sendPublicAnalyticsEvent/);
});

test('deduplicates the center view and validates service actions from a closed enum', () => {
  assert.match(publicAnalytics, /shouldTrackEvent\(pageViewKey, PAGE_VIEW_COOLDOWN_MS\)/);
  assert.match(publicAnalytics, /pageEventType = 'page_view'/);
  assert.match(publicAnalytics, /isFlightServiceAnalyticsAction\(analyticsAction\)/);
  for (const action of ['transfer', 'wake_up', 'breakfast_box', 'reception']) {
    assert.match(center, new RegExp(`action: '${action}' as const`));
    assert.match(migration, new RegExp(`'${action}'`));
  }
});

test('extends only the closed event constraint and leaves browser table access closed', () => {
  assert.match(migration, /drop constraint hotel_analytics_events_event_type_check/);
  assert.match(migration, /hotel_analytics_events_flight_metadata_check/);
  assert.doesNotMatch(migration, /jsonb_object_length/);
  assert.match(migration, /jsonb_typeof\(metadata\)='object'/);
  assert.match(migration, /metadata \? 'action'/);
  assert.match(migration, /\(metadata-'action'\)='\{\}'::jsonb/);
  assert.match(migration, /metadata->>'action' in\('transfer','wake_up','breakfast_box','reception'\)/);
  assert.match(migration, /event_type<>'flight_service_action' and metadata='\{\}'::jsonb/);
  assert.doesNotMatch(migration, /grant|create policy|disable row level security|service_role/i);
  assert.match(api, /createAdminClient\(\)/);
  assert.doesNotMatch(api, /from\('hotel_analytics_events'\)\.select/i);
});

test('preserves multi-hotel public, home-card and entitlement gates', () => {
  assert.match(publicMigration, /where h\.id=p_hotel_id/);
  assert.match(publicMigration, /is_hotel_module_enabled\(h\.id,'travel\.flights'\)/);
  assert.match(publicMigration, /ha\.hotel_id=h\.id and ha\.is_active/);
  assert.match(homeMigration, /where h\.id=p_hotel_id/);
  assert.match(homeMigration, /and s\.home_card_enabled/);
  assert.match(homeMigration, /is_hotel_module_enabled\(h\.id,'travel\.flights'\)/);
  assert.match(center, /whatsappNumber: hotel\.whatsapp_number/);
  assert.match(center, /hotelSlug=\{hotel\.slug\}/);
});

test('keeps navigation, forms and interactive actions accessible and mobile-safe', () => {
  assert.match(center, /<nav aria-label=\{copy\.title\}[^>]*overflow-x-auto/);
  assert.match(center, /aria-current=\{tab === item \? 'page'/);
  assert.match(manager, /<label htmlFor=\{`guest-flight-\$\{field\}`\}/);
  assert.match(manager, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(manager, /aria-describedby=\{error \? errorId/);
  assert.match(manager, /role="status" aria-live="polite"/);
  assert.match(manager, /min-h-12/);
  assert.match(center, /grid gap-4 lg:grid-cols-2/);
  assert.doesNotMatch(`${center}\n${manager}`, /dangerouslySetInnerHTML|<iframe/i);
});

test('does not touch room identity, Sprint 50 homes or mobile docks', () => {
  const protectedSources = [
    'components/public/grand-mercure/grand-mercure-public-home.tsx',
    'components/public/mercure/mercure-public-home.tsx',
    'components/public/novotel/novotel-public-home.tsx',
    'components/public/grand-mercure/grand-mercure-mobile-navigation.tsx',
    'components/public/mercure/mercure-bottom-dock.tsx',
    'components/public/novotel/novotel-mobile-navigation.tsx',
  ].map((path) => read(...path.split('/'))).join('\n');
  assert.doesNotMatch(protectedSources, /flight_(?:saved|removed|calendar|route|service)|data-analytics-action/i);
  assert.doesNotMatch(`${analytics}\n${client}\n${publicAnalytics}\n${center}\n${manager}`, /roomToken|room_links/i);
});
