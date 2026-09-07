export type FlightQuery = {
  flight_iata: string;
  departureDate: string;
  scheduledDepartureAt?: string;
  departureAirport: string;
  arrivalAirport: string;
};

export type FlightStatusRequest = FlightQuery & { hotelSlug: string; includeLive: boolean };
export type ScheduleStatus = 'scheduled' | 'active' | 'landed' | 'cancelled' | 'unknown';
export type LiveStatus = 'scheduled' | 'en-route' | 'unknown';
export type FlightError = 'invalid_input' | 'key_missing' | 'timeout' | 'provider_error'
  | 'provider_auth' | 'quota_exceeded' | 'not_found' | 'invalid_payload' | 'ambiguous'
  | 'occurrence_unverified' | 'outside_provider_window' | 'provider_window_unverified'
  | 'coordinator_unavailable' | 'budget_unavailable' | 'quota_exhausted' | 'rate_limited' | 'in_progress' | 'forbidden';
export type FlightResult<T> = { ok: true; data: T } | { ok: false; error: FlightError };

// Local airport time and an independently supplied UTC instant must never be conflated.
export type FlightTime = { local: string | null; utc: string | null };
export type NormalizedFlight = {
  flightNumber: string;
  airlineCode: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDeparture: FlightTime | null;
  estimatedDeparture: FlightTime | null;
  actualDeparture: FlightTime | null;
  scheduledArrival: FlightTime | null;
  estimatedArrival: FlightTime | null;
  actualArrival: FlightTime | null;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  scheduleStatus: ScheduleStatus;
  liveStatus: LiveStatus | null;
  liveSourceType: 'adsb' | 'unknown' | null;
  delayedMinutes: { departure: number | null; arrival: number | null };
  updatedAt: { schedule: string | null; live: string | null };
  provenance: {
    provider: 'airlabs';
    schedule: 'matched';
    live: 'not_requested' | 'matched' | FlightError;
    fetchedAt: string;
  };
};

export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function localTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null;
  const normalized = value.replace(' ', 'T').padEnd(19, ':00');
  const date = new Date(`${normalized}Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === normalized ? normalized : null;
}

export function validateFlightQuery(value: unknown): FlightQuery | null {
  const row = object(value);
  if (!row || typeof row.flight_iata !== 'string' || typeof row.departureDate !== 'string'
    || typeof row.departureAirport !== 'string' || typeof row.arrivalAirport !== 'string') return null;
  const flight_iata = row.flight_iata.trim().toUpperCase();
  const departureAirport = row.departureAirport.trim().toUpperCase();
  const arrivalAirport = row.arrivalAirport.trim().toUpperCase();
  // IATA designator (two characters, at least one letter), number and optional suffix.
  if (!/^(?=[A-Z0-9]{0,1}[A-Z])[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flight_iata)
    || !/^[A-Z]{3}$/.test(departureAirport) || !/^[A-Z]{3}$/.test(arrivalAirport)
    || departureAirport === arrivalAirport || !/^\d{4}-\d{2}-\d{2}$/.test(row.departureDate)
    || !localTime(`${row.departureDate}T00:00:00`)) return null;
  if (row.scheduledDepartureAt !== undefined && (
    typeof row.scheduledDepartureAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(row.scheduledDepartureAt)
    || !localTime(row.scheduledDepartureAt.slice(0, 19))
    || row.scheduledDepartureAt.slice(0, 10) !== row.departureDate
    || !Number.isFinite(Date.parse(row.scheduledDepartureAt))
  )) return null;
  return { flight_iata, departureAirport, arrivalAirport, departureDate: row.departureDate,
    ...(row.scheduledDepartureAt === undefined ? {} : { scheduledDepartureAt: row.scheduledDepartureAt as string }) };
}

// https://airlabs.co/docs/schedules: at most 10 hours ahead. This is a future
// query horizon, not a guarantee of coverage or a documented historical cutoff.
export const SCHEDULES_FUTURE_WINDOW_MS = 10 * 60 * 60 * 1000;

export function scheduleWindowError(query: FlightQuery, now: Date): 'outside_provider_window' | 'provider_window_unverified' | null {
  const horizon = now.getTime() + SCHEDULES_FUTURE_WINDOW_MS;
  if (!Number.isFinite(horizon)) return 'provider_window_unverified';
  if (query.scheduledDepartureAt) {
    const departure = Date.parse(query.scheduledDepartureAt);
    if (!Number.isFinite(departure)) return 'provider_window_unverified';
    return departure > horizon ? 'outside_provider_window' : null;
  }
  // A date alone is not midnight UTC. UTC+14 gives the earliest possible
  // instant for that civil date; use it only to prove the entire date is future.
  // An overlapping date is indeterminate, never evidence for not_found.
  const earliestPossible = Date.parse(`${query.departureDate}T00:00:00+14:00`);
  return earliestPossible > horizon ? 'outside_provider_window' : 'provider_window_unverified';
}

export function validateFlightStatusRequest(value: unknown): FlightStatusRequest | null {
  const row = object(value);
  const allowed = ['hotelSlug', 'flight_iata', 'departureDate', 'scheduledDepartureAt', 'departureAirport', 'arrivalAirport', 'includeLive'];
  if (!row || Object.keys(row).some((key) => !allowed.includes(key)) || typeof row.hotelSlug !== 'string'
    || (row.includeLive !== undefined && typeof row.includeLive !== 'boolean')) return null;
  const hotelSlug = row.hotelSlug.trim().toLowerCase();
  const flight = validateFlightQuery(row);
  if (!flight || hotelSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hotelSlug)) return null;
  return { ...flight, hotelSlug, includeLive: row.includeLive === true };
}

export function normalizeScheduleStatus(value: unknown): ScheduleStatus {
  return value === 'scheduled' || value === 'active' || value === 'landed' || value === 'cancelled' ? value : 'unknown';
}

export function normalizeLiveStatus(value: unknown): LiveStatus {
  return value === 'scheduled' || value === 'en-route' ? value : 'unknown';
}

export function timestamp(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 946684800 || value > 4102444800) return null;
  return new Date(value * 1000).toISOString();
}

function time(row: Record<string, unknown>, field: string): FlightTime | null {
  const local = localTime(row[field]);
  const utcLocal = localTime(row[`${field}_utc`]);
  const utc = timestamp(row[`${field}_ts`]) || (utcLocal ? `${utcLocal}Z` : null);
  return local || utc ? { local, utc } : null;
}

function location(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  return /^[A-Za-z0-9][A-Za-z0-9 .\/-]{0,19}$/.test(text) ? text : null;
}

function minutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2880 ? value : null;
}

export function matchesRoute(row: Record<string, unknown>, query: FlightQuery) {
  return row.flight_iata === query.flight_iata && row.dep_iata === query.departureAirport && row.arr_iata === query.arrivalAirport;
}

function hasIdentity(value: unknown): value is Record<string, unknown> {
  const row = object(value);
  return Boolean(row && typeof row.flight_iata === 'string' && /^(?=[A-Z0-9]{0,1}[A-Z])[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(row.flight_iata)
    && typeof row.dep_iata === 'string' && /^[A-Z]{3}$/.test(row.dep_iata)
    && typeof row.arr_iata === 'string' && /^[A-Z]{3}$/.test(row.arr_iata));
}

export function normalizeSchedule(rows: unknown[], query: FlightQuery, now: Date): FlightResult<NormalizedFlight> {
  if (rows.some((row) => !hasIdentity(row) || !localTime(row.dep_time))) return { ok: false, error: 'invalid_payload' };
  const candidates = rows.map(object).filter((row) => row && matchesRoute(row, query));
  const matches = candidates.filter((row) => localTime(row!.dep_time)?.slice(0, 10) === query.departureDate);
  if (matches.length > 1) return { ok: false, error: 'ambiguous' };
  if (!matches.length) return { ok: false, error: 'not_found' };
  const row = matches[0]!;
  return { ok: true, data: {
    flightNumber: query.flight_iata.slice(2), airlineCode: query.flight_iata.slice(0, 2),
    departureAirport: query.departureAirport, arrivalAirport: query.arrivalAirport,
    scheduledDeparture: time(row, 'dep_time'), estimatedDeparture: time(row, 'dep_estimated'), actualDeparture: time(row, 'dep_actual'),
    scheduledArrival: time(row, 'arr_time'), estimatedArrival: time(row, 'arr_estimated'), actualArrival: time(row, 'arr_actual'),
    departureTerminal: location(row.dep_terminal), departureGate: location(row.dep_gate),
    arrivalTerminal: location(row.arr_terminal), arrivalGate: location(row.arr_gate),
    scheduleStatus: normalizeScheduleStatus(row.status), liveStatus: null, liveSourceType: null,
    delayedMinutes: { departure: minutes(row.dep_delayed), arrival: minutes(row.arr_delayed) },
    updatedAt: { schedule: timestamp(row.updated), live: null },
    provenance: { provider: 'airlabs', schedule: 'matched', live: 'not_requested', fetchedAt: now.toISOString() },
  } };
}

// A live route/number alone does not identify a daily flight occurrence.
export function normalizeLive(rows: unknown[], query: FlightQuery, schedule: NormalizedFlight | null, now: Date): FlightResult<NormalizedFlight> {
  if (!schedule || schedule.airlineCode + schedule.flightNumber !== query.flight_iata
    || schedule.departureAirport !== query.departureAirport || schedule.arrivalAirport !== query.arrivalAirport
    || schedule.scheduledDeparture?.local?.slice(0, 10) !== query.departureDate) return { ok: false, error: 'occurrence_unverified' };
  if (rows.some((row) => !hasIdentity(row))) return { ok: false, error: 'invalid_payload' };
  const matches = rows.map(object).filter((row) => row && matchesRoute(row, query));
  if (matches.length > 1) return { ok: false, error: 'ambiguous' };
  if (!matches.length) return { ok: false, error: 'not_found' };
  const row = matches[0]!;
  const updated = timestamp(row.updated);
  const departure = schedule.actualDeparture?.utc || schedule.estimatedDeparture?.utc || schedule.scheduledDeparture?.utc;
  const age = updated ? now.getTime() - Date.parse(updated) : Infinity;
  const elapsed = departure && updated ? Date.parse(updated) - Date.parse(departure) : Infinity;
  if (!updated || age < -60000 || age > 15 * 60000 || elapsed < -2 * 3600000 || elapsed > 18 * 3600000
    || schedule.scheduleStatus === 'landed' || schedule.scheduleStatus === 'cancelled') return { ok: false, error: 'occurrence_unverified' };
  return { ok: true, data: {
    ...schedule, liveStatus: normalizeLiveStatus(row.status), liveSourceType: row.type === 'adsb' ? 'adsb' : 'unknown',
    updatedAt: { ...schedule.updatedAt, live: updated },
    provenance: { ...schedule.provenance, live: 'matched' },
  } };
}
