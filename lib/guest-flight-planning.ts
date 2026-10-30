import { airportDepartureInstant, type FlightDisplay } from './guest-flight-status.ts';
import type { SavedGuestFlight } from './guest-flight-storage.ts';
import type { TravelType } from './flights/route-context.ts';

export type FlightPlanningAirport = {
  iataCode: string; timezone?: string | null; countryCode?:string|null;
  estimatedTransferMinutes: number | null; domesticLeadMinutes: number | null;
  internationalLeadMinutes: number | null; safetyMarginMinutes: number | null;
};
export type FlightPlanning = { enabled: boolean; notice: string | null };
type Recommendation = {
  available: true; recommendedDepartureAt: string; scheduledDepartureAt: string;
  basis: 'airlabs' | 'manual'; timezone: string;
  transfer: number; lead: number; margin: number;
} | { available: false };

export function recommendHotelDeparture(input: {
  enabled: boolean; airport: FlightPlanningAirport | null; travelType: TravelType;
  flight: SavedGuestFlight; data: FlightDisplay | null; now: number;
}): Recommendation {
  const { airport, flight, data, travelType, now } = input;
  if (!input.enabled || !airport || airport.iataCode !== flight.departureAirport || !airport.timezone
    || !['domestic', 'international'].includes(travelType) || !Number.isFinite(now)
    || (data && (['inFlight', 'landed', 'cancelled'].includes(data.status) || data.planningBlocked))) return { available: false };
  const transfer = airport.estimatedTransferMinutes;
  const lead = travelType === 'domestic' ? airport.domesticLeadMinutes : airport.internationalLeadMinutes;
  const margin = airport.safetyMarginMinutes;
  const valid = (n: number | null, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
  if (!valid(transfer, 1440) || !valid(lead, 2880) || !valid(margin, 720)) return { available: false };
  // Never substitute estimated/actual time. An inconsistent provider schedule
  // fails closed rather than silently reverting to a different manual schedule.
  const local = data?.scheduled ?? `${flight.departureDate}T${flight.scheduledDepartureTime}:00`;
  if (local.slice(0, 10) !== flight.departureDate) return { available: false };
  const scheduled = airportDepartureInstant(local, airport.timezone);
  if (!scheduled || (data?.scheduledUtc && Date.parse(data.scheduledUtc) !== Date.parse(scheduled))) return { available: false };
  const scheduledMs = Date.parse(scheduled);
  const recommended = scheduledMs - (transfer + lead + margin) * 60000;
  // Also expire a previously displayed recommendation while the page stays open.
  if (scheduledMs <= now || recommended <= now) return { available: false };
  return { available: true, recommendedDepartureAt: new Date(recommended).toISOString(), scheduledDepartureAt: scheduled,
    basis: data ? 'airlabs' : 'manual', timezone: airport.timezone, transfer, lead, margin };
}
