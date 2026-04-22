import { headers } from 'next/headers';

export const PRODUCT_ROOT_DOMAIN = 'guestdesk.digital';

export type DomainContextKind =
  | 'localhost'
  | 'product-root'
  | 'product-subdomain'
  | 'other-domain';

export interface DomainContext {
  rawHost: string | null;
  host: string | null;
  hostname: string | null;
  port: string | null;
  kind: DomainContextKind;
  productRootDomain: string;
  subdomain: string | null;
  isProductRoot: boolean;
  isPotentialHotelSubdomain: boolean;
  shouldUseSlugFallback: boolean;
}

function normalizeRawHost(host: string | null | undefined) {
  const normalized = host?.trim().toLowerCase();
  return normalized ? normalized.replace(/\.$/, '') : null;
}

function splitHostAndPort(host: string | null) {
  if (!host) {
    return { hostname: null, port: null };
  }

  const [hostname, port] = host.split(':');
  return {
    hostname: hostname || null,
    port: port || null,
  };
}

function isLocalHostname(hostname: string | null) {
  if (!hostname) {
    return false;
  }

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  );
}

export function resolveDomainContext(
  rawHost: string | null | undefined,
  productRootDomain = PRODUCT_ROOT_DOMAIN
): DomainContext {
  const host = normalizeRawHost(rawHost);
  const { hostname, port } = splitHostAndPort(host);

  if (!hostname) {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'other-domain',
      productRootDomain,
      subdomain: null,
      isProductRoot: false,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
    };
  }

  if (isLocalHostname(hostname)) {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'localhost',
      productRootDomain,
      subdomain: null,
      isProductRoot: false,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
    };
  }

  if (hostname === productRootDomain || hostname === `www.${productRootDomain}`) {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'product-root',
      productRootDomain,
      subdomain: null,
      isProductRoot: true,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
    };
  }

  if (hostname.endsWith(`.${productRootDomain}`)) {
    const subdomain = hostname.slice(0, -1 * (`.${productRootDomain}`.length));
    const isPotentialHotelSubdomain = Boolean(subdomain && subdomain !== 'www');

    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'product-subdomain',
      productRootDomain,
      subdomain: isPotentialHotelSubdomain ? subdomain : null,
      isProductRoot: false,
      isPotentialHotelSubdomain,
      shouldUseSlugFallback: true,
    };
  }

  return {
    rawHost: rawHost ?? null,
    host,
    hostname,
    port,
    kind: 'other-domain',
    productRootDomain,
    subdomain: null,
    isProductRoot: false,
    isPotentialHotelSubdomain: false,
    shouldUseSlugFallback: true,
  };
}

export async function getRequestDomainContext() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost || requestHeaders.get('host');

  return resolveDomainContext(host);
}
