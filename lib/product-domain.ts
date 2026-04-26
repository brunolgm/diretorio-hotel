export const PRODUCT_ROOT_DOMAIN = 'guestdesk.digital';
export const PRODUCT_ROOT_WWW_HOSTNAME = `www.${PRODUCT_ROOT_DOMAIN}`;

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
