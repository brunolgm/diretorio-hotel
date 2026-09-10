import 'server-only';
import { isJsonContentType, readUtf8BodyWithLimit } from '../security/http.ts';
import { validateFlightStatusRequest, type FlightQuery, type FlightResult, type NormalizedFlight } from './flight-status.ts';

type Dependencies = {
  authorize: (hotelSlug: string, departureAirport: string) => Promise<{ hotelId: string } | false>;
  lookup: (query: FlightQuery, includeLive: boolean, hotelId: string) => Promise<FlightResult<NormalizedFlight>>;
};

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export function createFlightStatusHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    if (!isJsonContentType(request.headers.get('content-type'))) return json({ error: 'invalid_content_type' }, 415);
    let payload;
    try {
      const body = await readUtf8BodyWithLimit(request, 2048);
      if (!body.ok) return json({ error: body.reason === 'too_large' ? 'body_too_large' : 'invalid_input' }, body.reason === 'too_large' ? 413 : 400);
      payload = validateFlightStatusRequest(JSON.parse(body.text));
    } catch { return json({ error: 'invalid_input' }, 400); }
    if (!payload) return json({ error: 'invalid_input' }, 400);
    try {
      const authorization = await dependencies.authorize(payload.hotelSlug, payload.departureAirport);
      if (!authorization) return json({ error: 'flight_center_unavailable' }, 403);
      // Explicit projection: never send hotel context to the provider.
      const result = await dependencies.lookup({ flight_iata: payload.flight_iata, departureDate: payload.departureDate,
        ...(payload.scheduledDepartureAt === undefined ? {} : { scheduledDepartureAt: payload.scheduledDepartureAt }),
        departureAirport: payload.departureAirport, arrivalAirport: payload.arrivalAirport }, payload.includeLive, authorization.hotelId);
      if (result.ok) return json(result, 200);
      const status = result.error === 'not_found' ? 404 : result.error === 'ambiguous' || result.error === 'occurrence_unverified' ? 409
        : result.error === 'outside_provider_window' || result.error === 'provider_window_unverified' ? 422
        : result.error === 'rate_limited' ? 429 : result.error === 'in_progress' ? 409 : result.error === 'forbidden' ? 403
        : ['coordinator_unavailable','budget_unavailable','quota_exhausted'].includes(result.error) ? 503
        : result.error === 'invalid_input' ? 400 : result.error === 'timeout' ? 504
        : result.error === 'key_missing' || result.error === 'quota_exceeded' || result.error === 'provider_auth' ? 503 : 502;
      return json(result, status);
    } catch { return json({ error: 'service_unavailable' }, 503); }
  };
}
