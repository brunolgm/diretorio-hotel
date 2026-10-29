import type { DomainContext } from './domain-context';
import type { PublicHotel, PublicHotelSection } from './public-hotel-data';
import type { SupportedPublicLanguage } from './public-language';
import { buildPublicHotelServiceHref } from './public-routes.ts';
import { experienceHttpsUrl } from './public-experience-media.ts';

/** Stored editorial URLs may reference this hotel's published services. Reuse route scope/language. */
export function publicEditorialHref(input: {
  url?: string | null; hotel: PublicHotel; sections: PublicHotelSection[];
  language: SupportedPublicLanguage; domainContext: DomainContext; preferSubdomainRoot: boolean;
}) {
  const href = experienceHttpsUrl(input.url);
  if (!href) return null;
  const url = new URL(href);
  const ownHost = url.hostname === input.domainContext.productRootDomain ||
    url.hostname === `${input.hotel.subdomain}.${input.domainContext.productRootDomain}`;
  const match = ownHost ? url.pathname.match(/^(?:\/hotel\/[^/]+)?\/servicos\/([^/]+)\/?$/) : null;
  if (!match) return href;
  const section = input.sections.find(s => s.id === match[1] && s.hotel_id === input.hotel.id && s.enabled);
  if (!section) return null;
  return buildPublicHotelServiceHref({slug:input.hotel.slug,serviceId:section.id,language:input.language,
    domainContext:input.domainContext,preferSubdomainRoot:input.preferSubdomainRoot});
}
