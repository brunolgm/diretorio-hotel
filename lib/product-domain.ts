export const PRODUCT_ROOT_DOMAIN = 'guestdesk.digital';
export const PRODUCT_ROOT_WWW_HOSTNAME = `www.${PRODUCT_ROOT_DOMAIN}`;

export type ProductHostnameKind =
  | 'product-root'
  | 'product-subdomain'
  | 'external-or-unknown';

export function isProductRootHostname(
  hostname: string | null | undefined,
  productRootDomain = PRODUCT_ROOT_DOMAIN
) {
  if (!hostname) {
    return false;
  }

  return hostname === productRootDomain || hostname === `www.${productRootDomain}`;
}

export function getProductSubdomainCandidate(
  hostname: string | null | undefined,
  productRootDomain = PRODUCT_ROOT_DOMAIN
) {
  if (!hostname || isProductRootHostname(hostname, productRootDomain)) {
    return null;
  }

  if (!hostname.endsWith(`.${productRootDomain}`)) {
    return null;
  }

  const subdomain = hostname.slice(0, -1 * (`.${productRootDomain}`.length));
  return subdomain && subdomain !== 'www' ? subdomain : null;
}

export function classifyProductHostname(
  hostname: string | null | undefined,
  productRootDomain = PRODUCT_ROOT_DOMAIN
): {
  kind: ProductHostnameKind;
  subdomain: string | null;
} {
  if (isProductRootHostname(hostname, productRootDomain)) {
    return {
      kind: 'product-root',
      subdomain: null,
    };
  }

  const subdomain = getProductSubdomainCandidate(hostname, productRootDomain);

  if (subdomain) {
    return {
      kind: 'product-subdomain',
      subdomain,
    };
  }

  return {
    kind: 'external-or-unknown',
    subdomain: null,
  };
}
