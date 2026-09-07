import 'server-only';
import { createAirLabsClient } from './airlabs.server.ts';
import { normalizeLive, object, scheduleWindowError, validateFlightQuery, type FlightError, type FlightQuery, type FlightResult, type NormalizedFlight } from './flight-status.ts';

type Kind = 'schedule' | 'live';
export type CanonicalQuery = { provider: 'airlabs'; contract_version: 1; query_type: Kind; flight_iata: string; departure_date: string; departure_airport: string; arrival_airport: string };
export function canonicalQuery(q: FlightQuery, kind: Kind): CanonicalQuery {
  return { provider: 'airlabs', contract_version: 1, query_type: kind, flight_iata: q.flight_iata, departure_date: q.departureDate, departure_airport: q.departureAirport, arrival_airport: q.arrivalAirport };
}
export function canonicalKey(q: CanonicalQuery) {
  return [q.provider, q.contract_version, q.query_type, q.flight_iata, q.departure_date, q.departure_airport, q.arrival_airport].join(':');
}
type ScheduleProjection = Omit<NormalizedFlight, 'liveStatus' | 'liveSourceType' | 'updatedAt' | 'provenance'> & { updatedAt: string | null; fetchedAt: string };
type LiveProjection = { liveStatus: NormalizedFlight['liveStatus']; liveSourceType: NormalizedFlight['liveSourceType']; updatedAt: string | null };
export function cacheProjection(f: NormalizedFlight, kind: Kind): ScheduleProjection | LiveProjection {
  if (kind === 'live') return { liveStatus: f.liveStatus, liveSourceType: f.liveSourceType, updatedAt: f.updatedAt.live };
  return { flightNumber: f.flightNumber, airlineCode: f.airlineCode, departureAirport: f.departureAirport, arrivalAirport: f.arrivalAirport,
    scheduledDeparture: f.scheduledDeparture, estimatedDeparture: f.estimatedDeparture, actualDeparture: f.actualDeparture,
    scheduledArrival: f.scheduledArrival, estimatedArrival: f.estimatedArrival, actualArrival: f.actualArrival,
    departureTerminal: f.departureTerminal, departureGate: f.departureGate, arrivalTerminal: f.arrivalTerminal, arrivalGate: f.arrivalGate,
    scheduleStatus: f.scheduleStatus, delayedMinutes: f.delayedMinutes, updatedAt: f.updatedAt.schedule, fetchedAt: f.provenance.fetchedAt };
}
export function cacheTtl(kind: Kind, f: NormalizedFlight, q: FlightQuery, now: Date): number {
  if (kind === 'live') return 300;
  if (f.scheduleStatus === 'landed') return 21600;
  if (f.scheduleStatus === 'cancelled') return 3600;
  if (f.scheduleStatus === 'active') return 900;
  return Date.parse(q.scheduledDepartureAt ?? '') - now.getTime() > 3 * 3600000 ? 3600 : 900;
}
export type CoordinatorStore = {
  admit(account: string, hotelId: string, query: CanonicalQuery): Promise<unknown>;
  publish(key: string, owner: string, result: ScheduleProjection | LiveProjection, ttl: number): Promise<boolean>;
  close(key: string, owner: string, error: 'not_found' | 'provider_error'): Promise<boolean>;
};
const unavailable = (): FlightResult<NormalizedFlight> => ({ ok: false, error: 'coordinator_unavailable' });
const admissionErrors: FlightError[] = ['in_progress', 'rate_limited', 'quota_exhausted', 'budget_unavailable', 'coordinator_unavailable', 'forbidden'];
export function createAirLabsCoordinator({ store, accountScope, authorize, now = () => new Date(), fetchImpl = fetch }: {
  store: CoordinatorStore; accountScope: string | undefined; authorize: (hotelId: string, airport: string) => Promise<boolean>;
  now?: () => Date; fetchImpl?: typeof fetch;
}) {
  async function run(kind: Kind, query: FlightQuery, hotelId: string, schedule: NormalizedFlight | null): Promise<FlightResult<NormalizedFlight>> {
    const identity = canonicalQuery(query, kind);
    const key = canonicalKey(identity);
    const admission = object(await store.admit(accountScope!, hotelId, identity));
    if (!admission) return unavailable();
    if (admission.status === 'provider_cooldown') return { ok: false, error: 'provider_error' };
    if (admission.status === 'cache_hit') {
      if (admission.error === 'not_found') return { ok: false, error: 'not_found' };
      if (admission.error != null) return unavailable();
      const cached = object(admission.data);
      if (!cached) return unavailable();
      // The RPC validates a closed projection; live occurrence is checked again on read.
      if (kind === 'live') return normalizeLive([{ flight_iata: query.flight_iata, dep_iata: query.departureAirport, arr_iata: query.arrivalAirport,
        status: cached.liveStatus, type: cached.liveSourceType, updated: Date.parse(String(cached.updatedAt)) / 1000 }], query, schedule, now());
      const f = cached as ScheduleProjection;
      if (f.airlineCode + f.flightNumber !== query.flight_iata || f.departureAirport !== query.departureAirport || f.arrivalAirport !== query.arrivalAirport
        || f.scheduledDeparture?.local?.slice(0, 10) !== query.departureDate || !Number.isFinite(Date.parse(f.fetchedAt))) return unavailable();
      const { fetchedAt, ...fields } = f;
      return { ok: true, data: { ...fields, liveStatus: null, liveSourceType: null, updatedAt: { schedule: f.updatedAt, live: null },
        provenance: { provider: 'airlabs', schedule: 'matched', live: 'not_requested', fetchedAt } } };
    }
    if (admission.status !== 'fetch_allowed') return { ok: false, error: admissionErrors.includes(admission.status as FlightError) ? admission.status as FlightError : 'coordinator_unavailable' };
    if (admission.canonical_key !== key || typeof admission.owner_token !== 'string' || !/^[0-9a-f-]{36}$/i.test(admission.owner_token)
      || typeof admission.lease_until !== 'string') return unavailable();
    const owner = admission.owner_token;
    const expiry = Date.parse(admission.lease_until);
    let consumed = false;
    const client = createAirLabsClient({ now, fetchImpl, consumePermit(requestKind, requestQuery) {
      if (consumed || requestKind !== kind || canonicalKey(canonicalQuery(requestQuery, kind)) !== key || !Number.isFinite(expiry) || now().getTime() >= expiry) return false;
      consumed = true;
      return true;
    } });
    const result = kind === 'schedule' ? await client.schedules(query) : await client.live(query, schedule);
    const published = result.ok
      ? await store.publish(key, owner, cacheProjection(result.data, kind), cacheTtl(kind, result.data, query, now()))
      : await store.close(key, owner, result.error === 'not_found' ? 'not_found' : 'provider_error');
    return published ? result : unavailable();
  }
  return { async lookup(input: FlightQuery, includeLive: boolean, hotelId: string): Promise<FlightResult<NormalizedFlight>> {
    try {
      const query = validateFlightQuery(input);
      if (!query) return { ok: false, error: 'invalid_input' };
      if (!await authorize(hotelId, query.departureAirport)) return { ok: false, error: 'forbidden' };
      const windowError = scheduleWindowError(query, now());
      if (windowError) return { ok: false, error: windowError };
      if (!accountScope || !/^[a-z0-9_-]{1,64}$/.test(accountScope)) return unavailable();
      const result = await run('schedule', query, hotelId, null);
      if (!result.ok || !includeLive) return result;
      const f = result.data;
      const anchor = f.actualDeparture?.utc || f.estimatedDeparture?.utc || f.scheduledDeparture?.utc;
      const elapsed = anchor ? now().getTime() - Date.parse(anchor) : Infinity;
      if (!anchor || elapsed < -2 * 3600000 || elapsed > 18 * 3600000 || f.scheduleStatus === 'landed' || f.scheduleStatus === 'cancelled') {
        return { ok: true, data: { ...f, provenance: { ...f.provenance, live: 'occurrence_unverified' } } };
      }
      const live = await run('live', query, hotelId, f);
      return live.ok ? live : { ok: true, data: { ...f, provenance: { ...f.provenance, live: live.error } } };
    } catch { return unavailable(); }
  } };
}
