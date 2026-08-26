export type FlightCalendarInput = {
  airlineCode: string | null;
  airlineName: string | null;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  scheduledDepartureTime: string;
  savedAt: string;
};

export type PublicAirportDestination = {
  iataCode: string;
  name: string;
  city: string;
};

export type FlightCalendarCopy = {
  flightLabel: string;
  informedTime: string;
  statusNotVerified: string;
  officialNotice: string;
};

const IATA_PATTERN = /^[A-Z]{3}$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Z0-9]{1,8}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizeSingleLine(value: string, maxLength: number) {
  const normalized = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatIcsTimestamp(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '19700101T000000Z';
  return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildFlightCalendarFile({
  flight,
  airport,
  copy,
}: {
  flight: FlightCalendarInput;
  airport: PublicAirportDestination | null;
  copy: FlightCalendarCopy;
}) {
  const codeOrName = normalizeSingleLine(flight.airlineCode || flight.airlineName || '', 60);
  const flightNumber = normalizeSingleLine(flight.flightNumber, 8);
  const departure = flight.departureAirport.trim().toUpperCase();
  const arrival = flight.arrivalAirport.trim().toUpperCase();
  if (
    !flightNumber || !SAFE_IDENTIFIER_PATTERN.test(flightNumber.toUpperCase()) ||
    !IATA_PATTERN.test(departure) || !IATA_PATTERN.test(arrival) ||
    !DATE_PATTERN.test(flight.departureDate) || !TIME_PATTERN.test(flight.scheduledDepartureTime)
  ) return null;

  // Floating local time by design: the current public contract has no reliable
  // airport timezone, so DTSTART must not claim UTC or invent a TZID.
  const start = `${flight.departureDate.replace(/-/g, '')}T${flight.scheduledDepartureTime.replace(':', '')}00`;
  const summary = escapeIcsText([copy.flightLabel, codeOrName, flightNumber].filter(Boolean).join(' '));
  const description = [
    `${departure} → ${arrival}`,
    copy.informedTime,
    copy.statusNotVerified,
    copy.officialNotice,
  ].map((line) => escapeIcsText(line)).join('\\n');
  const location = airport && airport.iataCode === departure
    ? escapeIcsText(`${airport.name} (${airport.iataCode}), ${airport.city}`)
    : null;
  const safeFileCode = (flight.airlineCode || 'flight').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'flight';
  const safeFileNumber = flightNumber.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const uid = `flight-${safeFileCode}-${safeFileNumber}-${flight.departureDate.replace(/-/g, '')}@libguest.local`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LibGuest//Flight Center//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsTimestamp(flight.savedAt)}`,
    `DTSTART:${start}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    ...(location ? [`LOCATION:${location}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    content: `${lines.join('\r\n')}\r\n`,
    fileName: `flight-${safeFileCode}-${safeFileNumber}.ics`,
    mimeType: 'text/calendar;charset=utf-8',
  };
}

export function buildAirportRouteUrl(airport: PublicAirportDestination | null) {
  if (!airport) return null;
  const iataCode = airport.iataCode.trim().toUpperCase();
  const name = normalizeSingleLine(airport.name, 120);
  const city = normalizeSingleLine(airport.city, 80);
  if (!IATA_PATTERN.test(iataCode) || !name || !city) return null;

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${name} (${iataCode}), ${city}`);
  return url.toString();
}

export function buildHotelServiceActionDestination({
  whatsappNumber,
  contactHref,
  message,
}: {
  whatsappNumber: string | null;
  contactHref: string;
  message: string;
}) {
  const whatsappDigits = String(whatsappNumber || '').replace(/\D/g, '');
  const normalizedMessage = normalizeSingleLine(message, 240);
  if (/^[1-9]\d{7,14}$/.test(whatsappDigits) && normalizedMessage) {
    const url = new URL(`https://wa.me/${whatsappDigits}`);
    url.searchParams.set('text', normalizedMessage);
    return { href: url.toString(), isExternal: true };
  }
  return { href: contactHref, isExternal: false };
}
