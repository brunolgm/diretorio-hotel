import { headers } from 'next/headers';
import {
  classifyProductHostname,
  PRIMARY_PRODUCT_ROOT_DOMAIN,
  SUPPORTED_PRODUCT_ROOT_DOMAINS,
} from '@/lib/product-domain';

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
  matchedProductRootDomain: string | null;
  subdomain: string | null;
  isProductRoot: boolean;
  isPotentialHotelSubdomain: boolean;
  shouldUseSlugFallback: boolean;
  isFutureCustomDomainCandidate: boolean;
  isLegacyProductDomain: boolean;
}

export type HotelSubdomainDomainContext = DomainContext & {
  kind: 'product-subdomain';
  subdomain: string;
  isPotentialHotelSubdomain: true;
};

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

export function isHotelSubdomainContext(
  domainContext: DomainContext | null | undefined
): domainContext is HotelSubdomainDomainContext {
  return Boolean(
    domainContext?.kind === 'product-subdomain' &&
      domainContext.isPotentialHotelSubdomain === true &&
      typeof domainContext.subdomain === 'string' &&
      domainContext.subdomain.length > 0
  );
}

export function resolveDomainContext(
  rawHost: string | null | undefined,
  productRootDomains: readonly string[] = SUPPORTED_PRODUCT_ROOT_DOMAINS
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
      productRootDomain: PRIMARY_PRODUCT_ROOT_DOMAIN,
      matchedProductRootDomain: null,
      subdomain: null,
      isProductRoot: false,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
      isFutureCustomDomainCandidate: false,
      isLegacyProductDomain: false,
    };
  }

  if (isLocalHostname(hostname)) {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'localhost',
      productRootDomain: PRIMARY_PRODUCT_ROOT_DOMAIN,
      matchedProductRootDomain: null,
      subdomain: null,
      isProductRoot: false,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
      isFutureCustomDomainCandidate: false,
      isLegacyProductDomain: false,
    };
  }

  const productHostname = classifyProductHostname(hostname, productRootDomains);

  if (productHostname.kind === 'product-root') {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'product-root',
      productRootDomain: PRIMARY_PRODUCT_ROOT_DOMAIN,
      matchedProductRootDomain: productHostname.rootDomain,
      subdomain: null,
      isProductRoot: true,
      isPotentialHotelSubdomain: false,
      shouldUseSlugFallback: true,
      isFutureCustomDomainCandidate: false,
      isLegacyProductDomain: productHostname.isLegacyRootDomain,
    };
  }

  if (productHostname.kind === 'product-subdomain') {
    return {
      rawHost: rawHost ?? null,
      host,
      hostname,
      port,
      kind: 'product-subdomain',
      productRootDomain: PRIMARY_PRODUCT_ROOT_DOMAIN,
      matchedProductRootDomain: productHostname.rootDomain,
      subdomain: productHostname.subdomain,
      isProductRoot: false,
      isPotentialHotelSubdomain: true,
      shouldUseSlugFallback: true,
      isFutureCustomDomainCandidate: false,
      isLegacyProductDomain: productHostname.isLegacyRootDomain,
    };
  }

  return {
    rawHost: rawHost ?? null,
    host,
    hostname,
    port,
    kind: 'other-domain',
    productRootDomain: PRIMARY_PRODUCT_ROOT_DOMAIN,
    matchedProductRootDomain: null,
    subdomain: null,
    isProductRoot: false,
    isPotentialHotelSubdomain: false,
    shouldUseSlugFallback: true,
    isFutureCustomDomainCandidate: true,
    isLegacyProductDomain: false,
  };
}

export async function getRequestDomainContext() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost || requestHeaders.get('host');

  return resolveDomainContext(host);
}
