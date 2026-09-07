import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.ts';
import { isJsonContentType, readUtf8BodyWithLimit } from '../security/http.ts';
import { validateRouteContext, type TravelType } from './route-context.ts';

type Airport = { iata_code: string; country_code: string | null; is_active: boolean };
export function classifyAirportRoute(rows: Airport[], departure: string, arrival: string): TravelType {
  const country = (code: string) => {
    const matches = rows.filter(row => row.iata_code === code);
    return matches.length === 1 && matches[0].is_active && /^[A-Z]{2}$/.test(matches[0].country_code ?? '') ? matches[0].country_code : null;
  };
  const origin = country(departure), destination = country(arrival);
  return !origin || !destination ? 'unknown' : origin === destination ? 'domestic' : 'international';
}

type Dependencies = {
  publicClient: () => SupabaseClient<Database>;
  adminClient: () => SupabaseClient<Database>;
  isEnabled: (hotelId: string) => Promise<boolean>;
};

// Bounded, identity-free protection against automated bulk lookups per process.
// This is independent of AirLabs admission/quota; it is not a distributed limit.
export function createRouteContextAdmission(clock = Date.now) {
  let resetAt = 0, total = 0;
  const hotels = new Map<string, number>();
  return (slug: string) => {
    if (clock() >= resetAt) { resetAt = clock() + 60000; total = 0; hotels.clear(); }
    const used = hotels.get(slug) ?? 0;
    if (total >= 120 || used >= 30) return false;
    total++; hotels.set(slug, used + 1); return true;
  };
}

export function createRouteContextHandler(deps: Dependencies, admit = createRouteContextAdmission()) {
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}),
  } });
  return async function POST(request: Request) {
    if (!isJsonContentType(request.headers.get('content-type'))) return json({ error: 'invalid_content_type' }, 415);
    // No CORS grant; reject cross-site browser requests before database work.
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) return json({ error: 'forbidden' }, 403);
    let query;
    try {
      const body = await readUtf8BodyWithLimit(request, 512);
      if (!body.ok) return json({ error: body.reason === 'too_large' ? 'body_too_large' : 'invalid_input' }, body.reason === 'too_large' ? 413 : 400);
      query = validateRouteContext(JSON.parse(body.text));
    } catch { return json({ error: 'invalid_input' }, 400); }
    if (!query) return json({ error: 'invalid_input' }, 400);
    if (!admit(query.hotelSlug)) return json({ error: 'rate_limited' }, 429);
    try {
      const publicClient = deps.publicClient();
      const { data: hotel, error } = await publicClient.from('public_hotels').select('id').eq('slug', query.hotelSlug).maybeSingle();
      if (error) throw Error('hotel_lookup_failed');
      if (!hotel || !await deps.isEnabled(hotel.id)) return json({ error: 'flight_center_unavailable' }, 403);
      const { data: configured, error: centerError } = await publicClient.rpc('get_public_hotel_flight_center', { p_hotel_id: hotel.id });
      if (centerError) throw Error('center_lookup_failed');
      if (!configured?.some(row => row.airport_iata_code === query.departureAirport)) return json({ error: 'flight_center_unavailable' }, 403);
      // Only after authorization. No caller-provided tables, fields, filters or lists.
      const { data: airports, error: airportError } = await deps.adminClient().from('airports')
        .select('iata_code,country_code,is_active').in('iata_code', [query.departureAirport, query.arrivalAirport]).eq('is_active', true).limit(3);
      if (airportError) throw Error('catalog_lookup_failed');
      return json({ travelType: classifyAirportRoute(airports ?? [], query.departureAirport, query.arrivalAirport) }, 200);
    } catch { return json({ error: 'service_unavailable' }, 503); }
  };
}
