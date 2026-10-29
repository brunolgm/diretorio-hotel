import {publicEditorialHref} from './public-editorial-link.ts';
import {getPublicEssentials} from './public-essentials.ts';
import type { PublicHotelPageData } from './public-hotel-data';
import type { DomainContext } from './domain-context';
import type { SupportedPublicLanguage } from './public-language';
import { buildPublicHotelAreaHref, buildPublicHotelFlightCenterHref } from './public-routes.ts';

import type { PublicPresentation } from './public-presentation';

export function publicExperienceVersion(presentation?: PublicPresentation | null) {
  return presentation?.experienceVersion === 'v4' ? 'v4' : 'v3';
}

/** Pure composition of canonical, already tenant/module-filtered public data. No identity/PMS/provider. */
export function getUniversalMobileHome(data: PublicHotelPageData, language: SupportedPublicLanguage, domainContext: DomainContext, preferSubdomainRoot: boolean) {
  const enabled = (key: string) => data.layout.some(b => b.blockKey === key && b.isEnabled);
  const sections = data.sections.filter(s => s.hotel_id === data.hotel.id && s.enabled);
  const {wifi,breakfast,checkin,checkout}=getPublicEssentials(data,language);
  const route = { slug: data.hotel.slug, language, domainContext, preferSubdomainRoot };
  const restaurant = enabled('services') ? (data.experienceMedia ?? []).find(m => m.hotel_id === data.hotel.id && m.slot === 'restaurant' && m.is_published) : null;
  let dining = publicEditorialHref({url:restaurant?.cta_url,hotel:data.hotel,sections,language,domainContext,preferSubdomainRoot});
  if (!dining && enabled('services') && sections.some(s => s.service_action_type === 'room_restaurant_menu')) dining = buildPublicHotelAreaHref({...route,area:'cardapio'});
  const actions: { key: 'services'|'dining'|'flights'|'contact'; href: string }[] = [
    ...(enabled('services') && sections.length ? [{key:'services' as const,href:buildPublicHotelAreaHref({...route,area:'servicos'})}] : []),
    ...(dining ? [{key:'dining' as const,href:dining}] : []),
    ...(data.flightHomeCard ? [{key:'flights' as const,href:buildPublicHotelFlightCenterHref(route)}] : []),
    ...(enabled('contact') && (data.hotel.website_url || data.hotel.booking_url || data.hotel.whatsapp_number || data.departments.some(d => d.hotel_id === data.hotel.id && d.enabled)) ? [{key:'contact' as const,href:buildPublicHotelAreaHref({...route,area:'contato'})}] : []),
  ];
  return { wifi, breakfast, checkin, checkout, actions };
}
