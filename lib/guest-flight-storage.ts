export const GUEST_FLIGHT_STORAGE_VERSION = 1 as const;
export const GUEST_FLIGHT_STORAGE_PREFIX = 'libguest:flight';
export const GUEST_FLIGHT_CHANGED_EVENT = 'libguest:guest-flight-changed';

const FLIGHT_EXPIRATION_HOURS = 12;
const MAX_FUTURE_DAYS = 730;
const HOTEL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AIRLINE_CODE_PATTERN = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{1,8}$/;
const IATA_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:00$/;

export type SavedGuestFlight = {
  version: 1;
  hotelId: string;
  airlineCode: string | null;
  airlineName: string | null;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  scheduledDepartureTime: string;
  scheduledDepartureAt: string;
  timeBasis: 'departure_airport_local_unverified';
  source: 'guest';
  savedAt: string;
  expiresAt: string;
};

export type GuestFlightDraft = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  scheduledDepartureTime: string;
};

export type GuestFlightField = keyof GuestFlightDraft;
export type GuestFlightValidationErrors = Partial<Record<GuestFlightField, string>>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type CreateSavedGuestFlightResult =
  | { ok: true; flight: SavedGuestFlight }
  | { ok: false; errors: GuestFlightValidationErrors };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatUtcWallClock(value: Date) {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:00`;
}

export function formatDeviceWallClock(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
}

function parseWallClock(value: string) {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) return null;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute
  ) return null;
  return parsed;
}

function addWallClockHours(value: string, hours: number) {
  const parsed = parseWallClock(value);
  if (!parsed) return null;
  parsed.setUTCHours(parsed.getUTCHours() + hours);
  return formatUtcWallClock(parsed);
}

function normalizeBoundedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > maxLength || /[<>]/.test(normalized)) return null;
  return normalized;
}

export function getGuestFlightStorageKey(hotelId: string) {
  const normalizedHotelId = hotelId.trim().toLowerCase();
  if (!HOTEL_ID_PATTERN.test(normalizedHotelId)) {
    throw new Error('A valid hotel id is required for guest flight storage.');
  }
  return `${GUEST_FLIGHT_STORAGE_PREFIX}:${normalizedHotelId}:v${GUEST_FLIGHT_STORAGE_VERSION}`;
}

export function isSavedGuestFlightExpired(flight: SavedGuestFlight, now = new Date()) {
  return flight.expiresAt <= formatDeviceWallClock(now);
}

export function hasSavedGuestFlightDeparted(flight: SavedGuestFlight, now = new Date()) {
  return flight.scheduledDepartureAt < formatDeviceWallClock(now);
}

export function createSavedGuestFlight(
  hotelId: string,
  draft: GuestFlightDraft,
  now = new Date(),
): CreateSavedGuestFlightResult {
  let normalizedHotelId: string;
  try {
    normalizedHotelId = getGuestFlightStorageKey(hotelId).split(':')[2];
  } catch {
    return { ok: false, errors: { flightNumber: 'invalid_hotel' } };
  }

  const errors: GuestFlightValidationErrors = {};
  const airline = draft.airline.replace(/\s+/g, ' ').trim();
  const normalizedAirlineCode = airline.toUpperCase();
  const airlineCode = airline && AIRLINE_CODE_PATTERN.test(normalizedAirlineCode) ? normalizedAirlineCode : null;
  const airlineName = airline && !airlineCode ? normalizeBoundedText(airline, 60) : null;
  if (airline && !airlineCode && !airlineName) errors.airline = 'invalid_airline';

  const flightNumber = draft.flightNumber.replace(/\s+/g, '').toUpperCase();
  if (!FLIGHT_NUMBER_PATTERN.test(flightNumber)) errors.flightNumber = 'invalid_flight_number';

  const departureAirport = draft.departureAirport.trim().toUpperCase();
  const arrivalAirport = draft.arrivalAirport.trim().toUpperCase();
  if (!IATA_PATTERN.test(departureAirport)) errors.departureAirport = 'invalid_iata';
  if (!IATA_PATTERN.test(arrivalAirport)) errors.arrivalAirport = 'invalid_iata';
  if (departureAirport && departureAirport === arrivalAirport) errors.arrivalAirport = 'same_airport';

  if (!DATE_PATTERN.test(draft.departureDate)) errors.departureDate = 'invalid_date';
  if (!TIME_PATTERN.test(draft.scheduledDepartureTime)) errors.scheduledDepartureTime = 'invalid_time';

  const scheduledDepartureAt = `${draft.departureDate}T${draft.scheduledDepartureTime}:00`;
  const parsedDeparture = parseWallClock(scheduledDepartureAt);
  const expiresAt = parsedDeparture ? addWallClockHours(scheduledDepartureAt, FLIGHT_EXPIRATION_HOURS) : null;
  const futureLimit = new Date(now.getTime());
  futureLimit.setDate(futureLimit.getDate() + MAX_FUTURE_DAYS);
  if (!parsedDeparture || !expiresAt) errors.departureDate = 'invalid_date';
  else if (expiresAt <= formatDeviceWallClock(now)) errors.departureDate = 'too_old';
  else if (scheduledDepartureAt > formatDeviceWallClock(futureLimit)) errors.departureDate = 'too_far';

  if (Object.keys(errors).length || !expiresAt) return { ok: false, errors };

  return {
    ok: true,
    flight: {
      version: GUEST_FLIGHT_STORAGE_VERSION,
      hotelId: normalizedHotelId,
      airlineCode,
      airlineName,
      flightNumber,
      departureAirport,
      arrivalAirport,
      departureDate: draft.departureDate,
      scheduledDepartureTime: draft.scheduledDepartureTime,
      scheduledDepartureAt,
      timeBasis: 'departure_airport_local_unverified',
      source: 'guest',
      savedAt: now.toISOString(),
      expiresAt,
    },
  };
}

export function parseSavedGuestFlight(value: string, expectedHotelId: string): SavedGuestFlight | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const allowedKeys = new Set([
    'version', 'hotelId', 'airlineCode', 'airlineName', 'flightNumber', 'departureAirport',
    'arrivalAirport', 'departureDate', 'scheduledDepartureTime', 'scheduledDepartureAt',
    'timeBasis', 'source', 'savedAt', 'expiresAt',
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) return null;

  let normalizedHotelId: string;
  try {
    normalizedHotelId = getGuestFlightStorageKey(expectedHotelId).split(':')[2];
  } catch {
    return null;
  }

  if (
    record.version !== GUEST_FLIGHT_STORAGE_VERSION ||
    record.hotelId !== normalizedHotelId ||
    !(record.airlineCode === null || (typeof record.airlineCode === 'string' && AIRLINE_CODE_PATTERN.test(record.airlineCode))) ||
    !(record.airlineName === null || normalizeBoundedText(record.airlineName, 60) === record.airlineName) ||
    typeof record.flightNumber !== 'string' || !FLIGHT_NUMBER_PATTERN.test(record.flightNumber) ||
    typeof record.departureAirport !== 'string' || !IATA_PATTERN.test(record.departureAirport) ||
    typeof record.arrivalAirport !== 'string' || !IATA_PATTERN.test(record.arrivalAirport) ||
    record.departureAirport === record.arrivalAirport ||
    typeof record.departureDate !== 'string' || !DATE_PATTERN.test(record.departureDate) ||
    typeof record.scheduledDepartureTime !== 'string' || !TIME_PATTERN.test(record.scheduledDepartureTime) ||
    record.scheduledDepartureAt !== `${record.departureDate}T${record.scheduledDepartureTime}:00` ||
    !parseWallClock(record.scheduledDepartureAt) ||
    record.timeBasis !== 'departure_airport_local_unverified' ||
    record.source !== 'guest' ||
    typeof record.savedAt !== 'string' || !Number.isFinite(Date.parse(record.savedAt)) ||
    typeof record.expiresAt !== 'string' || !parseWallClock(record.expiresAt) ||
    record.expiresAt !== addWallClockHours(record.scheduledDepartureAt as string, FLIGHT_EXPIRATION_HOURS)
  ) return null;

  return record as SavedGuestFlight;
}

function resolveStorage(storage?: StorageLike) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSavedGuestFlight(hotelId: string, storage?: StorageLike, now = new Date()) {
  const target = resolveStorage(storage);
  if (!target) return null;
  const key = getGuestFlightStorageKey(hotelId);
  let raw: string | null;
  try {
    raw = target.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  const flight = parseSavedGuestFlight(raw, hotelId);
  if (!flight || isSavedGuestFlightExpired(flight, now)) {
    try { target.removeItem(key); } catch { /* Storage can be unavailable or full. */ }
    return null;
  }
  return flight;
}

export function saveGuestFlight(hotelId: string, flight: SavedGuestFlight, storage?: StorageLike, now = new Date()) {
  const target = resolveStorage(storage);
  if (!target || flight.hotelId !== hotelId.trim().toLowerCase()) return false;
  const serialized = JSON.stringify(flight);
  const validatedFlight = parseSavedGuestFlight(serialized, hotelId);
  if (!validatedFlight || isSavedGuestFlightExpired(validatedFlight, now)) return false;
  try {
    target.setItem(getGuestFlightStorageKey(hotelId), serialized);
    if (!storage && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(GUEST_FLIGHT_CHANGED_EVENT, { detail: { hotelId: flight.hotelId } }));
    return true;
  } catch {
    return false;
  }
}

export function removeGuestFlight(hotelId: string, storage?: StorageLike) {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(getGuestFlightStorageKey(hotelId));
    if (!storage && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(GUEST_FLIGHT_CHANGED_EVENT, { detail: { hotelId: hotelId.trim().toLowerCase() } }));
    return true;
  } catch {
    return false;
  }
}

export function getSavedGuestFlightSnapshot(hotelId: string) {
  const flight = loadSavedGuestFlight(hotelId);
  return flight ? JSON.stringify(flight) : null;
}

export function subscribeToGuestFlight(hotelId: string, onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const normalizedHotelId = hotelId.trim().toLowerCase();
  const storageKey = getGuestFlightStorageKey(normalizedHotelId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onStoreChange();
  };
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ hotelId?: string }>).detail;
    if (detail?.hotelId === normalizedHotelId) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(GUEST_FLIGHT_CHANGED_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(GUEST_FLIGHT_CHANGED_EVENT, onCustom);
  };
}
