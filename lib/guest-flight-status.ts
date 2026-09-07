import { localTime, object, scheduleWindowError, validateFlightQuery, type FlightQuery, type FlightStatusRequest } from './flights/flight-status.ts';
import type { SavedGuestFlight } from './guest-flight-storage.ts';

// Resolve a wall clock in the configured airport zone, never the device zone.
// Reject DST gaps and folds instead of guessing which instant the guest meant.
export function airportDepartureInstant(local: string, zone: string | null | undefined): string | null {
  if (!zone || !localTime(local)) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const wall = (instant: number) => {
      const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    };
    const nominal = Date.parse(`${local}Z`);
    const offsets = new Set<number>();
    for (let hour = -36; hour <= 36; hour++) {
      const instant = nominal + hour * 3600000;
      offsets.add(Date.parse(`${wall(instant)}Z`) - instant);
    }
    const matches = [...offsets].filter(offset => Math.abs(offset) <= 14 * 3600000 && offset % 60000 === 0 && wall(nominal - offset) === local);
    if (matches.length !== 1) return null;
    const minutes = matches[0] / 60000;
    return `${local}${minutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
  } catch { return null; }
}

export function guestStatusQuery(flight: SavedGuestFlight, hotelSlug: string, zone: string | null | undefined): FlightStatusRequest | null {
  const full = flight.flightNumber;
  const flight_iata = /^\d{1,4}[A-Z]?$/.test(full) ? (flight.airlineCode ?? '') + full : full;
  if (flight.airlineCode && flight_iata.slice(0, 2) !== flight.airlineCode) return null;
  const scheduledDepartureAt = airportDepartureInstant(`${flight.departureDate}T${flight.scheduledDepartureTime}:00`, zone);
  if (!scheduledDepartureAt) return null;
  const q = validateFlightQuery({ flight_iata, departureDate: flight.departureDate, scheduledDepartureAt,
    departureAirport: flight.departureAirport, arrivalAirport: flight.arrivalAirport });
  return q ? { ...q, hotelSlug, includeLive: true } : null; // Backend requires compatible schedule before live.
}

export type FlightDisplay = {
  status: 'inFlight' | 'landed' | 'cancelled' | 'scheduled' | 'active' | 'unknown';
  scheduled: string; updated: string | null; updatedKind: 'actual' | 'estimated' | null;
  terminal: string | null; gate: string | null; live: boolean; updatedAt: string;
};
function instant(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}
function time(value: unknown): string | null { return localTime(object(value)?.local); }
function location(value: unknown): string | null { return typeof value === 'string' && /^[A-Za-z0-9 ./-]{1,20}$/.test(value) ? value : null; }
export function parseFlightDisplay(payload: unknown, query: FlightQuery): FlightDisplay | null {
  const envelope = object(payload); const d = object(envelope?.data); const p = object(d?.provenance); const updated = object(d?.updatedAt);
  if (envelope?.ok !== true || !d || p?.provider !== 'airlabs' || p.schedule !== 'matched'
    || String(d.airlineCode) + String(d.flightNumber) !== query.flight_iata || d.departureAirport !== query.departureAirport || d.arrivalAirport !== query.arrivalAirport) return null;
  const scheduled = time(d.scheduledDeparture); const fetched = instant(p.fetchedAt);
  if (!scheduled || scheduled.slice(0, 10) !== query.departureDate || !fetched) return null;
  const actual = time(d.actualDeparture); const estimated = time(d.estimatedDeparture);
  const liveTime = instant(updated?.live);
  const compatibleLive = p.live === 'matched' && liveTime !== null && ['adsb','unknown'].includes(String(d.liveSourceType));
  const final = d.scheduleStatus === 'landed' || d.scheduleStatus === 'cancelled';
  const conflict = final && compatibleLive && d.liveStatus === 'en-route';
  const live = compatibleLive && !final;
  const status: FlightDisplay['status'] = conflict ? 'unknown' : live && d.liveStatus === 'en-route' ? 'inFlight'
    : ['landed','cancelled','scheduled','active'].includes(String(d.scheduleStatus)) ? d.scheduleStatus as FlightDisplay['status'] : 'unknown';
  return { status, scheduled, updated: actual ?? estimated, updatedKind: actual ? 'actual' : estimated ? 'estimated' : null,
    terminal: location(d.departureTerminal), gate: location(d.departureGate), live, updatedAt: live ? liveTime! : instant(updated?.schedule) ?? fetched };
}

export type GuestStatusState = { loading: boolean; data: FlightDisplay | null; error: string | null; waiting: boolean };
// A known normalized state takes precedence over the manual wall-clock warning.
// Unknown/conflicting or absent external data retains the existing fallback.
export function showManualFlightNotice(data: FlightDisplay | null): boolean {
  return !data || data.status === 'unknown';
}
// One controller per mounted saved occurrence. No persistence, polling or retries.
export function createGuestStatusController(query: FlightStatusRequest | null, fetchImpl: typeof fetch = fetch, clock = Date.now) {
  let state: GuestStatusState = { loading: false, data: null, error: query ? null : 'unverifiable', waiting: false };
  let version = 0; let controller: AbortController | null = null; let nextAttempt = 0;
  let unlock: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: GuestStatusState) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel() { version++; controller?.abort(); controller = null; clearTimeout(unlock); state = { ...state, loading: false, waiting: false }; },
    async refresh() {
      if (!query || state.loading || clock() < nextAttempt) return;
      const windowError = scheduleWindowError(query, new Date(clock()));
      if (windowError) { emit({ ...state, error: windowError }); return; }
      const attempt = ++version;
      controller = new AbortController();
      const signal = controller.signal;
      nextAttempt = clock() + 60000;
      emit({ ...state, loading: true, error: null, waiting: true });
      clearTimeout(unlock);
      unlock = setTimeout(() => { if (attempt === version) emit({ ...state, waiting: false }); }, 60000);
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetchImpl('/api/flights/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), cache: 'no-store', signal });
        const payload: unknown = await response.json();
        if (attempt !== version) return;
        const data = response.ok ? parseFlightDisplay(payload, query) : null;
        const error = object(payload)?.error;
        emit({ ...state, loading: false, data: data ?? state.data, error: data ? null : typeof error === 'string' ? error : 'unavailable' });
      } catch { if (attempt === version) emit({ ...state, loading: false, error: 'unavailable' }); }
      finally { clearTimeout(timeout); if (attempt === version) controller = null; }
    },
  };
}
