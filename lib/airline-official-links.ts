export const AIRLINE_OFFICIAL_LINKS_VERSION = 1 as const;

export type AirlineOfficialLink = {
  code: string;
  icaoCode?: string;
  name: string;
  officialUrl: string;
  supportsFlightNumberInUrl: boolean;
  urlTemplate?: string;
};

const AIRLINE_CODE_PATTERN = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{1,8}$/;

const AIRLINE_OFFICIAL_LINKS = Object.freeze({
  AD: {
    code: 'AD',
    // Confirmed airline identity, not a codeshare substitution.
    // Aena airline directory: ICAO AZU / IATA AD.
    icaoCode: 'AZU',
    name: 'Azul Linhas Aéreas',
    officialUrl: 'https://apps.voeazul.com.br/FlightStatus/aspx/Main.aspx',
    supportsFlightNumberInUrl: false,
  },
  LA: {
    code: 'LA',
    name: 'LATAM Airlines Brasil',
    officialUrl: 'https://www.latamairlines.com/br/pt/flight-status',
    supportsFlightNumberInUrl: false,
  },
  G3: {
    code: 'G3',
    name: 'GOL Linhas Aéreas',
    officialUrl: 'https://b2c.voegol.com.br/status-de-voo/',
    supportsFlightNumberInUrl: false,
  },
} satisfies Record<string, AirlineOfficialLink>);

export function normalizeAirlineCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || '';
  return AIRLINE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function sanitizeOfficialFlightNumber(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, '').toUpperCase() || '';
  return FLIGHT_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

export function resolveAirlineOfficialLink(code: string | null | undefined): AirlineOfficialLink | null {
  const normalized = normalizeAirlineCode(code);
  if(!normalized)return null;
  if(!Object.hasOwn(AIRLINE_OFFICIAL_LINKS,normalized))return Object.values(AIRLINE_OFFICIAL_LINKS).find(row=>'icaoCode' in row&&row.icaoCode===normalized)??null;
  return AIRLINE_OFFICIAL_LINKS[normalized as keyof typeof AIRLINE_OFFICIAL_LINKS];
}

/** Build a provider reference without rewriting the manual v1 object or dropping zeros. */
export function flightIataReference(code:string|null,number:string):string|null{
 const airline=normalizeAirlineCode(code);
 const canonical=airline?(resolveAirlineOfficialLink(airline)?.code??(airline.length===2?airline:null)):null;
 if(airline&&!canonical)return null;
 const raw=number.replace(/\s+/g,'').toUpperCase();
 if(/^\d{1,4}[A-Z]?$/.test(raw))return canonical?canonical+raw:null;
 const parts=raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);if(!parts)return null;
 const prefix=resolveAirlineOfficialLink(parts[1])?.code??(parts[1].length===2?parts[1]:null);
 if(!prefix||(canonical&&canonical!==prefix))return null;
 return prefix+parts[2];
}

export function getOfficialFlightReference(code: string | null | undefined, flightNumber: string | null | undefined) {
  const airlineCode = normalizeAirlineCode(code);
  const sanitizedFlightNumber = sanitizeOfficialFlightNumber(flightNumber);
  return airlineCode && sanitizedFlightNumber ? `${airlineCode}${sanitizedFlightNumber}` : null;
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
