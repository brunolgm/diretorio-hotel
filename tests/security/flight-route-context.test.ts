import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { validateRouteContext } from '../../lib/flights/route-context.ts';

const hooks = registerHooks({ resolve(s, c, next) { return s === 'server-only' ? { url: 'data:text/javascript,export {}', shortCircuit: true } : next(s, c); } });
const { createRouteContextHandler, classifyAirportRoute, createRouteContextAdmission } = await import('../../lib/flights/route-context.server.ts');
hooks.deregister();
const query = { hotelSlug: 'hotel-a', departureAirport: 'GIG', arrivalAirport: 'VIX' };
const rows = [{ iata_code: 'GIG', country_code: 'BR', is_active: true }, { iata_code: 'VIX', country_code: 'BR', is_active: true }];
function fixture(options: { hotel?: boolean; enabled?: boolean; origin?: boolean; error?: boolean } = {}) {
  const calls: string[] = [];
  const publicClient = {
    from(table: string) { assert.equal(table, 'public_hotels'); calls.push('hotel'); return {
      select(columns: string) { assert.equal(columns, 'id'); return {
        eq(column: string, value: string) { assert.equal(column, 'slug'); assert.equal(value, query.hotelSlug); return {
          async maybeSingle() { return { data: options.hotel === false ? null : { id: 'trusted-id' }, error: null }; },
        }; },
      }; },
    }; },
    async rpc(name: string, args: unknown) { calls.push('origin'); assert.equal(name, 'get_public_hotel_flight_center'); assert.deepEqual(args, { p_hotel_id: 'trusted-id' }); return { data: options.origin === false ? [] : [{ airport_iata_code: 'GIG' }], error: null }; },
  };
  const adminClient = { from(table: string) { calls.push('catalog'); assert.equal(table, 'airports'); return {
    select(columns: string) { assert.equal(columns, 'iata_code,country_code,is_active'); return {
      in(column: string, values: string[]) { assert.equal(column, 'iata_code'); assert.deepEqual(values, ['GIG', 'VIX']); return {
        eq(column: string, value: boolean) { assert.equal(column, 'is_active'); assert.equal(value, true); return {
          async limit(n: number) { assert.equal(n, 3); return { data: rows, error: options.error ? { message: 'sensitive detail' } : null }; },
        }; },
      }; },
    }; },
  }; } };
  type Deps = Parameters<typeof createRouteContextHandler>[0];
  const handler = createRouteContextHandler({ publicClient: () => publicClient as unknown as ReturnType<Deps['publicClient']>,
    adminClient: () => adminClient as unknown as ReturnType<Deps['adminClient']>,
    async isEnabled(id) { assert.equal(id, 'trusted-id'); calls.push('entitlement'); return options.enabled !== false; },
  });
  return { handler, calls };
}
const request = (value: unknown = query, headers: Record<string, string> = {}) => new Request('https://hotel.test/api/flights/route-context', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value),
});

test('route catalog classifies both countries; unresolved, inactive and ambiguous fail closed', () => {
  assert.equal(classifyAirportRoute(rows, 'GIG', 'VIX'), 'domestic');
  assert.equal(classifyAirportRoute([rows[0], { ...rows[1], country_code: 'AR' }], 'GIG', 'VIX'), 'international');
  for (const absent of [[], [rows[0]], [...rows, rows[1]], [rows[0], { ...rows[1], country_code: null }], [rows[0], { ...rows[1], country_code: 'br' }], [rows[0], { ...rows[1], is_active: false }], [{ ...rows[0], is_active: false }, rows[1]]]) {
    assert.equal(classifyAirportRoute(absent, 'GIG', 'VIX'), 'unknown');
  }
});
test('route authorizes hotel, entitlement and origin before allowlisted catalog query; destination need not be linked', async () => {
  const { handler, calls } = fixture(); const response = await handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { travelType: 'domestic' });
  assert.deepEqual(calls, ['hotel', 'entitlement', 'origin', 'catalog']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
for (const blocked of [{ hotel: false }, { enabled: false }, { origin: false }]) test(`route denies before global query ${JSON.stringify(blocked)}`, async () => {
  const { handler, calls } = fixture(blocked); assert.equal((await handler(request())).status, 403); assert.ok(!calls.includes('catalog'));
});
test('route input is closed, canonical and identity-free', async () => {
  assert.deepEqual(validateRouteContext(query), query);
  for (const bad of [null, [], {}, { ...query, hotelId: 'other' }, { ...query, roomToken: 'private' }, { ...query, country_code: 'BR' },
    { ...query, departureAirport: ['GIG'] }, { ...query, departureAirport: 'gig' }, { ...query, arrivalAirport: 'GIG' },
    { ...query, arrivalAirport: 'VIX&x=1' }, { ...query, hotelSlug: 'Hotel-A' }, { ...query, hotelSlug: 'x'.repeat(81) }]) {
    const { handler, calls } = fixture(); assert.equal((await handler(request(bad))).status, 400); assert.deepEqual(calls, []);
  }
});
test('route rejects oversized, malformed, non-JSON and cross-site bodies before database access', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request({ ...query, excess: 'x'.repeat(513) }))).status, 413);
  assert.equal((await handler(request(query, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handler(request(query, { origin: 'https://other.test' }))).status, 403);
  assert.equal((await handler(new Request('https://hotel.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.deepEqual(calls, []);
});
test('route catalog failure does not expose internals or guess classification', async () => {
  const response = await fixture({ error: true }).handler(request());
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'service_unavailable' });
});
test('route admission bounds bulk requests, resets and returns 429 without extra query', async () => {
  let now = 0; const admit = createRouteContextAdmission(() => now);
  for (let i = 0; i < 30; i++) assert.equal(admit('a'), true);
  assert.equal(admit('a'), false);
  for (let i = 0; i < 90; i++) assert.equal(admit(`other-${i}`), true);
  assert.equal(admit('new'), false); now = 60000; assert.equal(admit('a'), true);
  const { handler, calls } = fixture(); for (let i = 0; i < 30; i++) await handler(request());
  const count = calls.length; const response = await handler(request()); assert.equal(response.status, 429); assert.equal(calls.length, count);
});
test('route metadata remains server-only; browser sends only route and no airport table query', () => {
  const server = readFileSync('lib/flights/route-context.server.ts', 'utf8'); assert.match(server, /import 'server-only'/);
  const client = readFileSync('components/public/guest-flight-planning.tsx', 'utf8');
  assert.match(client, /JSON.stringify\(\{ hotelSlug, departureAirport, arrivalAirport \}\)/);
  assert.doesNotMatch(client, /supabase|country_code|roomToken|hotelId|AIRLABS|localStorage|analytics/);
  assert.doesNotMatch(readFileSync('app/api/flights/route-context/route.ts', 'utf8'), /airlabs|lookup|GET/);
});
