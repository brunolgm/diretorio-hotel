import 'server-only';
import { isJsonContentType, readUtf8BodyWithLimit } from '../security/http.ts';
import { normalizeLive, normalizeSchedule, object, scheduleWindowError, validateFlightQuery, type FlightError, type FlightQuery, type FlightResult, type NormalizedFlight } from './flight-status.ts';

const ENDPOINTS = { schedules: 'https://airlabs.co/api/v9/schedules', live: 'https://airlabs.co/api/v9/flights' } as const;
const TIMEOUT_MS = 4000;
const RESPONSE_BYTES = 256 * 1024;

function providerError(code: unknown): FlightError {
  if (code === 'not_found') return 'not_found';
  if (code === 'unknown_api_key' || code === 'expired_api_key') return 'provider_auth';
  if (code === 'minute_limit_exceeded' || code === 'hour_limit_exceeded' || code === 'month_limit_exceeded') return 'quota_exceeded';
  return 'provider_error';
}

// Production transport requires an explicit, single-use coordinator permission.
// There is deliberately no default permission or default factory argument.
export function createAirLabsClient({ consumePermit, fetchImpl = fetch, now = () => new Date() }: {
  consumePermit: (kind: 'schedule' | 'live', query: FlightQuery) => boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}) {
  async function request(endpoint: keyof typeof ENDPOINTS, input: FlightQuery): Promise<FlightResult<unknown[]>> {
    const query = validateFlightQuery(input);
    if (!query) return { ok: false, error: 'invalid_input' };
    const key = process.env.AIRLABS_API_KEY?.trim();
    if (!key) return { ok: false, error: 'key_missing' };
    if (!consumePermit(endpoint === 'schedules' ? 'schedule' : 'live', query)) return { ok: false, error: 'coordinator_unavailable' };
    const url = new URL(ENDPOINTS[endpoint]);
    url.searchParams.set('api_key', key);
    url.searchParams.set('flight_iata', query.flight_iata);
    url.searchParams.set('dep_iata', query.departureAirport);
    url.searchParams.set('arr_iata', query.arrivalAirport);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        return { ok: false, error: response.status === 404 ? 'not_found' : response.status === 429 ? 'quota_exceeded'
          : response.status === 401 || response.status === 403 ? 'provider_auth' : 'provider_error' };
      }
      if (!isJsonContentType(response.headers.get('content-type'))) {
        await response.body?.cancel();
        return { ok: false, error: 'invalid_payload' };
      }
      const body = await readUtf8BodyWithLimit(response, RESPONSE_BYTES);
      if (!body.ok) return { ok: false, error: 'invalid_payload' };
      let envelope: Record<string, unknown> | null;
      try { envelope = object(JSON.parse(body.text)); } catch { return { ok: false, error: 'invalid_payload' }; }
      if (!envelope) return { ok: false, error: 'invalid_payload' };
      if (envelope.error) return { ok: false, error: providerError(object(envelope.error)?.code) };
      if (!Array.isArray(envelope.response)) return { ok: false, error: 'invalid_payload' };
      // Do not silently select a match from a truncated collection.
      if (object(envelope.request)?.has_more === true) return { ok: false, error: 'ambiguous' };
      return { ok: true, data: envelope.response };
    } catch {
      return { ok: false, error: controller.signal.aborted ? 'timeout' : 'provider_error' };
    } finally { clearTimeout(timer); }
  }

  async function schedules(query: FlightQuery): Promise<FlightResult<NormalizedFlight>> {
    const valid = validateFlightQuery(query);
    if (!valid) return { ok: false, error: 'invalid_input' };
    const windowError = scheduleWindowError(valid, now());
    if (windowError) return { ok: false, error: windowError };
    const result = await request('schedules', valid);
    return result.ok ? normalizeSchedule(result.data, valid, now()) : result;
  }

  async function live(query: FlightQuery, schedule: NormalizedFlight | null): Promise<FlightResult<NormalizedFlight>> {
    const valid = validateFlightQuery(query);
    if (!valid) return { ok: false, error: 'invalid_input' };
    if (!schedule) return { ok: false, error: 'occurrence_unverified' };
    const result = await request('live', valid);
    return result.ok ? normalizeLive(result.data, valid, schedule, now()) : result;
  }

  async function lookup(query: FlightQuery, includeLive = false): Promise<FlightResult<NormalizedFlight>> {
    const result = await schedules(query);
    if (!result.ok || !includeLive) return result;
    // Live is useful only for a temporally anchored, non-final schedule.
    const flight = result.data;
    const anchor = flight.actualDeparture?.utc || flight.estimatedDeparture?.utc || flight.scheduledDeparture?.utc;
    const elapsed = anchor ? now().getTime() - Date.parse(anchor) : Infinity;
    if (!anchor || elapsed < -2 * 3600000 || elapsed > 18 * 3600000
      || flight.scheduleStatus === 'landed' || flight.scheduleStatus === 'cancelled') {
      return { ok: true, data: { ...flight, provenance: { ...flight.provenance, live: 'occurrence_unverified' } } };
    }
    const enrichment = await live(query, flight);
    return enrichment.ok ? enrichment : { ok: true, data: {
      ...flight, provenance: { ...flight.provenance, live: enrichment.error },
    } };
  }
  return { schedules, live, lookup };
}
