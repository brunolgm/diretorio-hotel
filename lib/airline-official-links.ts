export const AIRLINE_OFFICIAL_LINKS_VERSION = 1 as const;

export type AirlineOfficialLink = {
  code: string;
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
  if (!normalized || !Object.hasOwn(AIRLINE_OFFICIAL_LINKS, normalized)) return null;
  return AIRLINE_OFFICIAL_LINKS[normalized as keyof typeof AIRLINE_OFFICIAL_LINKS];
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
