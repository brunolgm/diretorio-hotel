import { object } from './flight-status.ts';

export type TravelType = 'domestic' | 'international' | 'unknown';
export type RouteContextQuery = { hotelSlug: string; departureAirport: string; arrivalAirport: string };

export function validateRouteContext(value: unknown): RouteContextQuery | null {
  const row = object(value);
  if (!row || Object.keys(row).length !== 3 || Object.keys(row).some(key => !['hotelSlug', 'departureAirport', 'arrivalAirport'].includes(key))
    || typeof row.hotelSlug !== 'string' || row.hotelSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.hotelSlug)
    || typeof row.departureAirport !== 'string' || !/^[A-Z]{3}$/.test(row.departureAirport)
    || typeof row.arrivalAirport !== 'string' || !/^[A-Z]{3}$/.test(row.arrivalAirport)
    || row.departureAirport === row.arrivalAirport) return null;
  return { hotelSlug: row.hotelSlug, departureAirport: row.departureAirport, arrivalAirport: row.arrivalAirport };
}
