import {findAirlineIdentity,resolveFlightAirline,type AirlineContext,type AirlineIdentity} from './airline-identity.ts';
export const AIRLINE_OFFICIAL_LINKS_VERSION = 1 as const;
export type AirlineOfficialLink = AirlineIdentity & {urlTemplate?:string};
const AIRLINE_CODE_PATTERN = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{1,8}$/;

export function normalizeAirlineCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || '';
  return AIRLINE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function sanitizeOfficialFlightNumber(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, '').toUpperCase() || '';
  return FLIGHT_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

export function resolveAirlineOfficialLink(code:string|null|undefined):AirlineOfficialLink|null{return findAirlineIdentity(code);}

/** Derive only the query reference; never rewrite manual v1 fields. */
export function flightIataReference(code:string|null,number:string,context?:AirlineContext):string|null{return resolveFlightAirline(code,number,context).flightIata;}

export function getOfficialFlightReference(code: string | null | undefined, flightNumber: string | null | undefined) {
  const airlineCode = normalizeAirlineCode(code);
  const sanitizedFlightNumber = sanitizeOfficialFlightNumber(flightNumber);
  return airlineCode && sanitizedFlightNumber ? flightIataReference(airlineCode,sanitizedFlightNumber) : null;
}

export function buildAirlineOfficialFlightUrl(code: string | null | undefined, flightNumber: string | null | undefined) {
  const airline = resolveAirlineOfficialLink(code);
  const reference = getOfficialFlightReference(code, flightNumber);
  if (!airline || !reference) return null;
  if (!airline.supportsFlightNumberInUrl || !airline.urlTemplate) return airline.officialUrl;

  try {
    const officialUrl = new URL(airline.officialUrl);
    const candidate = new URL(airline.urlTemplate.replace('{flightNumber}', encodeURIComponent(reference)));
    return candidate.protocol === 'https:' && candidate.origin === officialUrl.origin
      ? candidate.toString()
      : airline.officialUrl;
  } catch {
    return airline.officialUrl;
  }
}

type ClipboardWriter = { writeText(value: string): Promise<void> };

export async function copyOfficialFlightReference(
  clipboard: ClipboardWriter | null | undefined,
  code: string | null | undefined,
  flightNumber: string | null | undefined,
) {
  const reference = getOfficialFlightReference(code, flightNumber);
  if (!clipboard || !reference) return false;
  try {
    await clipboard.writeText(reference);
    return true;
  } catch {
    return false;
  }
}
