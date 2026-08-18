import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { Json } from '../../types/database.ts';
import {
  ANALYTICS_ACTION_LABELS,
  ANALYTICS_PERIOD_DAYS,
  ANALYTICS_PERIODS,
  buildAnalyticsComparison,
  buildAnalyticsInsights,
  normalizeAnalyticsPeriod,
  normalizeHotelAnalytics,
} from '../../lib/analytics-pro.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root,...parts),'utf8');

const response: Json = {
  period: '7d', current_start: '2026-08-11T00:00:00Z', current_end: '2026-08-18T00:00:00Z',
  previous_start: '2026-08-04T00:00:00Z', previous_end: '2026-08-11T00:00:00Z',
  metrics: {
    page_views: { current: 10, previous: 5 }, engagements: { current: 6, previous: 2 },
    whatsapp_clicks: { current: 3, previous: 1 }, booking_website_clicks: { current: 2, previous: 0 },
    language_changes: { current: 1, previous: 0 },
  },
  journey: { views: 10, interactions: 6, external_clicks: 5 },
  timeseries: Array.from({ length: 7 },(_,index) => ({
    date: `2026-08-${String(11+index).padStart(2,'0')}`,
    page_views: index === 6 ? 10 : 0,
    engagements: index === 6 ? 6 : 0,
    external_clicks: index === 6 ? 5 : 0,
  })),
  actions: [{ event_type: 'whatsapp_click', count: 3, share: 60 }],
  services: [{ id: '49030000-0000-4000-8000-000000000001', name: 'Spa', count: 4 }],
  departments: [{ id: '49040000-0000-4000-8000-000000000001', name: 'Recepção', count: 2 }],
  languages: [{ language: 'pt', count: 8 },{ language: 'en', count: 2 }],
};

test('defines four bounded periods and normalizes unknown input', () => {
  assert.deepEqual(ANALYTICS_PERIODS,['today','7d','30d','90d']);
  assert.deepEqual(ANALYTICS_PERIOD_DAYS,{ today:1,'7d':7,'30d':30,'90d':90 });
  assert.equal(normalizeAnalyticsPeriod('90d'),'90d');
  assert.equal(normalizeAnalyticsPeriod('365d'),'7d');
});

test('compares metrics without NaN or percentage over a zero baseline', () => {
  assert.deepEqual(buildAnalyticsComparison(4,0),{ current:4,previous:0,delta:4,percentage:null,state:'new_period' });
  assert.deepEqual(buildAnalyticsComparison(0,0),{ current:0,previous:0,delta:0,percentage:null,state:'no_baseline' });
  assert.equal(buildAnalyticsComparison(15,10).percentage,50);
  assert.equal(buildAnalyticsComparison(5,10).state,'down');
});

test('normalizes bounded rankings, language shares and deterministic insights', () => {
  const analytics = normalizeHotelAnalytics(response);
  assert.ok(analytics);
  assert.equal(analytics.languages[0].share,80);
  assert.equal(analytics.services[0].name,'Spa');
  assert.deepEqual(Object.keys(ANALYTICS_ACTION_LABELS).sort(),[
    'booking_click','department_click','service_view','website_click','whatsapp_click',
  ]);
  assert.deepEqual(buildAnalyticsInsights(analytics),[
    'O WhatsApp concentrou 60% das ações externas no período.',
    'Serviços foi a área mais consultada no período.',
    'O uso cresceu em relação ao período anterior.',
  ]);
});

test('uses one hotel-scoped aggregate RPC and closes browser raw reads', () => {
  const migration = read('supabase','migrations','202608170003_49_analytics_pro.sql');
  const query = read('lib','analytics-queries.ts');
  const legacyQueries = read('lib','queries.ts');
  assert.match(migration,/create function public\.get_current_hotel_analytics\(p_period text\)/i);
  assert.match(migration,/security definer[\s\S]*set search_path=''/i);
  assert.match(migration,/drop policy "45b_hotel_read_analytics"/);
  assert.match(migration,/revoke select on table public\.hotel_analytics_events from authenticated/);
  assert.match(migration,/analytics\.basic/);
  assert.match(query,/rpc\('get_current_hotel_analytics'/);
  assert.doesNotMatch(legacyQueries,/from\('hotel_analytics_events'\)/);
});

test('preserves historical events and adds only service_view to the closed catalog', () => {
  const migration = read('supabase','migrations','202608170003_49_analytics_pro.sql');
  const analytics = read('lib','analytics.ts');
  assert.match(migration,/add column service_id uuid null/);
  assert.match(migration,/foreign key\(service_id,hotel_id\)[\s\S]*on delete set null\(service_id\)/i);
  assert.match(migration,/unique\(id,hotel_id\)/i);
  assert.doesNotMatch(migration,/delete from public\.hotel_analytics_events|update public\.hotel_analytics_events/i);
  for (const event of ['page_view','language_selected','whatsapp_click','website_click','booking_click','department_click','service_view']) {
    assert.match(analytics,new RegExp(`'${event}'`));
  }
  assert.doesNotMatch(analytics,/targetUrl|metadataKeys|AnalyticsMetadata/);
});

test('uses exact non-overlapping calendar-day windows', () => {
  const migration = read('supabase','migrations','202608170003_49_analytics_pro.sql');
  const behavioral = read('supabase','tests','49_analytics_pro_behavioral_matrix.sql');
  assert.match(migration,/current_end := pg_catalog\.date_trunc\('day',now\(\)\)\+interval '1 day'/i);
  assert.match(migration,/previous_end := current_start[\s\S]*previous_start := previous_end-period_days\*interval '1 day'/i);
  assert.match(migration,/current_start,current_end-interval '1 day',interval '1 day'/i);
  assert.match(behavioral,/\('today',1\),\('7d',7\),\('30d',30\),\('90d',90\)/);
});

test('enforces service ownership in the database as well as the ingestion route', () => {
  const migration = read('supabase','migrations','202608170003_49_analytics_pro.sql');
  const behavioral = read('supabase','tests','49_analytics_pro_behavioral_matrix.sql');
  assert.match(migration,/hotel_sections_id_hotel_id_key unique\(id,hotel_id\)/i);
  assert.match(migration,/foreign key\(service_id,hotel_id\) references public\.hotel_sections\(id,hotel_id\)/i);
  assert.match(behavioral,/cross-hotel service association accepted/);
  assert.match(behavioral,/same-hotel service association rejected/);
});

test('guards the dedicated route and sidebar with analytics.basic only', () => {
  const navigation = read('lib','admin-navigation.ts');
  const page = read('app','admin','analytics','page.tsx');
  const layout = read('app','admin','analytics','layout.tsx');
  const catalog = read('lib','modules','catalog.ts');
  assert.match(navigation,/href: '\/admin\/analytics'.*moduleKey: 'analytics\.basic'/);
  assert.match(layout,/requireHotelModule\('analytics\.basic'\)/);
  assert.match(page,/getCurrentHotelAnalytics/);
  assert.match(catalog,/key: 'analytics\.advanced'.*availability: 'coming_soon'/);
  assert.doesNotMatch(page,/analytics\.advanced|service.role/i);
});

test('keeps ingestion private, explicit and hotel-isolated', () => {
  const route = read('app','api','analytics','route.ts');
  const client = read('components','public','public-analytics.tsx');
  assert.match(route,/from\('public_hotels'\)[\s\S]*\.eq\('slug', payload\.hotelSlug\)/);
  assert.match(route,/\.eq\('hotel_id', hotel\.id\)/);
  assert.match(route,/target_url: null/);
  assert.match(route,/metadata: \{\}/);
  assert.match(route,/session_id: null/);
  assert.doesNotMatch(client,/sessionId:|getSessionId|randomUUID|targetUrl:|metadata:/);
});

test('renders the complete responsive management view without a chart dependency', () => {
  const page = read('app','admin','analytics','page.tsx');
  for (const title of ['Analytics da experiência','Jornada de engajamento','Serviços mais consultados','Departamentos mais consultados','Idiomas mais utilizados','Leitura gerencial do período']) assert.match(page,new RegExp(title));
  assert.match(page,/viewBox="0 0 100 80"/);
  assert.doesNotMatch(page,/recharts|chart\.js|d3/i);
});
