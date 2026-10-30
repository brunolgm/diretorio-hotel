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

/** Association is the persisted own-hotel service destination, never title/icon guessing. */
export function serviceEditorialMedia(input:{media:import("./public-experience-media").ExperienceMedia[];hotel:PublicHotel;section:PublicHotelSection;productRootDomain:string}){
 if(input.section.hotel_id!==input.hotel.id||!input.section.enabled||input.section.service_action_type!=="standard")return null;
 return input.media.find(row=>{if(row.hotel_id!==input.hotel.id||!row.is_published)return false;const href=experienceHttpsUrl(row.cta_url);if(!href)return false;const u=new URL(href);if(![input.productRootDomain,input.hotel.subdomain+"."+input.productRootDomain].includes(u.hostname))return false;return ["/servicos/"+input.section.id,"/hotel/"+input.hotel.slug+"/servicos/"+input.section.id].includes(u.pathname.replace(/\/$/,""));})??null;
}
