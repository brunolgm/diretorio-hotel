import { PRODUCT_ROOT_DOMAIN } from '@/lib/domain-context';

export const HOTEL_SUBDOMAIN_RESERVED_NAMES = [
  'admin',
  'api',
  'app',
  'guestdesk',
  'www',
] as const;

const HOTEL_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function normalizeHotelSubdomainInput(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function isReservedHotelSubdomain(value: string) {
  return HOTEL_SUBDOMAIN_RESERVED_NAMES.includes(
    value as (typeof HOTEL_SUBDOMAIN_RESERVED_NAMES)[number]
  );
}

export function validateHotelSubdomain(value: string | null | undefined) {
  const normalized = normalizeHotelSubdomainInput(value);

  if (!normalized) {
    return {
      isValid: true,
      normalizedValue: null,
      error: null,
    } as const;
  }

  if (!HOTEL_SUBDOMAIN_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalizedValue: null,
      error:
        'Use apenas letras minúsculas, números e hífen, sem começar ou terminar com hífen.',
    } as const;
  }

  if (isReservedHotelSubdomain(normalized)) {
    return {
      isValid: false,
      normalizedValue: null,
      error: 'Este subdomínio é reservado e não pode ser usado.',
    } as const;
  }

  return {
    isValid: true,
    normalizedValue: normalized,
    error: null,
  } as const;
}

export function buildHotelSubdomainPreviewUrl(
  subdomain: string | null | undefined,
  rootDomain = PRODUCT_ROOT_DOMAIN
) {
  const normalized = normalizeHotelSubdomainInput(subdomain);
  return normalized ? `${normalized}.${rootDomain}` : null;
}
