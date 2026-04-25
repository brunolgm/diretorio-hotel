import { PRODUCT_ROOT_DOMAIN } from '@/lib/product-domain';

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

export function getHotelSubdomainFeedback(value: string | null | undefined) {
  const normalized = normalizeHotelSubdomainInput(value);
  const validation = validateHotelSubdomain(value);

  if (!normalized) {
    return {
      tone: 'neutral' as const,
      title: 'Subdomínio ainda não definido',
      description:
        'Esse campo pode ficar vazio por enquanto. A rota pública por slug continuará funcionando como fallback seguro.',
      previewUrl: null,
    };
  }

  if (!validation.isValid) {
    return {
      tone: isReservedHotelSubdomain(normalized) ? ('warning' as const) : ('danger' as const),
      title: isReservedHotelSubdomain(normalized) ? 'Nome reservado' : 'Subdomínio inválido',
      description:
        validation.error ||
        'Revise o valor informado para usar apenas um subdomínio válido dentro do domínio operacional atual.',
      previewUrl: buildHotelSubdomainPreviewUrl(normalized),
    };
  }

  return {
    tone: 'success' as const,
    title: 'Subdomínio válido',
    description:
      'Esse será o endereço público principal do hotel dentro do domínio operacional atual, mantendo a rota por slug como fallback seguro.',
    previewUrl: buildHotelSubdomainPreviewUrl(validation.normalizedValue),
  };
}

export function buildHotelSubdomainPreviewUrl(
  subdomain: string | null | undefined,
  rootDomain = PRODUCT_ROOT_DOMAIN
) {
  const normalized = normalizeHotelSubdomainInput(subdomain);
  return normalized ? `${normalized}.${rootDomain}` : null;
}
