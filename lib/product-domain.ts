export const PRIMARY_PRODUCT_ROOT_DOMAIN = 'libguest.digital';
export const LEGACY_PRODUCT_ROOT_DOMAINS = ['guestdesk.digital'] as const;
export const SUPPORTED_PRODUCT_ROOT_DOMAINS = [
  PRIMARY_PRODUCT_ROOT_DOMAIN,
  ...LEGACY_PRODUCT_ROOT_DOMAINS,
] as const;

export const PRODUCT_ROOT_DOMAIN = PRIMARY_PRODUCT_ROOT_DOMAIN;
export const PRODUCT_ROOT_WWW_HOSTNAME = `www.${PRODUCT_ROOT_DOMAIN}`;

export type ProductHostnameKind =
  | 'product-root'
  | 'product-subdomain'
  | 'external-or-unknown';

function normalizeProductRootDomains(
  productRootDomains:
    | string
    | readonly string[]
    | null
    | undefined = SUPPORTED_PRODUCT_ROOT_DOMAINS
) {
  if (!productRootDomains) {
    return [...SUPPORTED_PRODUCT_ROOT_DOMAINS];
  }

  return Array.isArray(productRootDomains)
    ? [...productRootDomains]
    : [productRootDomains];
}

export function isProductRootHostname(
  hostname: string | null | undefined,
  productRootDomains:
    | string
    | readonly string[]
    | null
    | undefined = SUPPORTED_PRODUCT_ROOT_DOMAINS
) {
  if (!hostname) {
    return false;
  }

  return normalizeProductRootDomains(productRootDomains).some(
    (productRootDomain) =>
      hostname === productRootDomain || hostname === `www.${productRootDomain}`
  );
}

export function getMatchedProductRootDomain(
  hostname: string | null | undefined,
  productRootDomains:
    | string
    | readonly string[]
    | null
    | undefined = SUPPORTED_PRODUCT_ROOT_DOMAINS
) {
  if (!hostname) {
    return null;
  }

  return (
    normalizeProductRootDomains(productRootDomains).find(
      (productRootDomain) =>
        hostname === productRootDomain || hostname === `www.${productRootDomain}`
    ) || null
  );
}

export function getProductSubdomainCandidate(
  hostname: string | null | undefined,
  productRootDomains:
    | string
    | readonly string[]
    | null
    | undefined = SUPPORTED_PRODUCT_ROOT_DOMAINS
) {
  if (!hostname || isProductRootHostname(hostname, productRootDomains)) {
    return null;
  }

  for (const productRootDomain of normalizeProductRootDomains(productRootDomains)) {
    if (!hostname.endsWith(`.${productRootDomain}`)) {
      continue;
    }

    const subdomain = hostname.slice(0, -1 * (`.${productRootDomain}`.length));

    if (subdomain && subdomain !== 'www') {
      return {
        subdomain,
        rootDomain: productRootDomain,
      };
    }
  }

  return null;
}

export function classifyProductHostname(
  hostname: string | null | undefined,
  productRootDomains:
    | string
    | readonly string[]
    | null
    | undefined = SUPPORTED_PRODUCT_ROOT_DOMAINS
): {
  kind: ProductHostnameKind;
  subdomain: string | null;
  rootDomain: string | null;
  isPrimaryRootDomain: boolean;
  isLegacyRootDomain: boolean;
} {
  const matchedRootDomain = getMatchedProductRootDomain(hostname, productRootDomains);

  if (matchedRootDomain) {
    return {
      kind: 'product-root',
      subdomain: null,
      rootDomain: matchedRootDomain,
      isPrimaryRootDomain: matchedRootDomain === PRIMARY_PRODUCT_ROOT_DOMAIN,
      isLegacyRootDomain: matchedRootDomain !== PRIMARY_PRODUCT_ROOT_DOMAIN,
    };
  }

  const subdomainMatch = getProductSubdomainCandidate(hostname, productRootDomains);

  if (subdomainMatch) {
    return {
      kind: 'product-subdomain',
      subdomain: subdomainMatch.subdomain,
      rootDomain: subdomainMatch.rootDomain,
      isPrimaryRootDomain: subdomainMatch.rootDomain === PRIMARY_PRODUCT_ROOT_DOMAIN,
      isLegacyRootDomain: subdomainMatch.rootDomain !== PRIMARY_PRODUCT_ROOT_DOMAIN,
    };
  }

  return {
    kind: 'external-or-unknown',
    subdomain: null,
    rootDomain: null,
    isPrimaryRootDomain: false,
    isLegacyRootDomain: false,
  };
}
