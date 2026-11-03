import type { FbGraph, FbOutlet } from './types.ts';
import { OUTLET_TYPES } from './types.ts';
import { safeFbUrl } from './validation.ts';
import { fbCurrencyDigits } from './currencies.ts';
import type { PublicHotel, PublicHotelSection } from '../public-hotel-data';
import type { DomainContext } from '../domain-context';
import type { SupportedPublicLanguage } from '../public-language';
import { getServiceDestination } from '../service-destinations.ts';

/** Defensive second boundary for fixtures/projections. SQL enforces eligibility first. */
export function eligibleFbGraph(raw: FbGraph | null | undefined, hotelId: string): FbGraph | null {
  if (!raw || !['outlets','menus','categories','items','outlet_menus','service_links'].every(k => Array.isArray(raw[k as keyof FbGraph]))) return null;
  const outlets = raw.outlets.filter(o => o.hotel_id === hotelId && o.is_published && OUTLET_TYPES.includes(o.type));
  const ownOutlets = new Set(outlets.map(o => o.id));
  const links = raw.outlet_menus.filter(l => l.hotel_id === hotelId && ownOutlets.has(l.outlet_id));
  const linkedMenus = new Set(links.map(l => l.menu_id));
  const menus = raw.menus.filter(m => m.hotel_id === hotelId && m.is_published && linkedMenus.has(m.id));
  const ownMenus = new Set(menus.map(m => m.id));
  const categories = raw.categories.filter(c => c.hotel_id === hotelId && c.is_published && ownMenus.has(c.menu_id));
  const ownCategories = new Set(categories.map(c => c.id));
  return { outlets, menus, categories, items: raw.items.filter(i => i.hotel_id === hotelId && i.is_published && i.is_available && ownCategories.has(i.category_id)), outlet_menus: links.filter(l => ownMenus.has(l.menu_id)), service_links: raw.service_links.filter(l => l.hotel_id === hotelId && ownOutlets.has(l.outlet_id)) };
}
export function fbOutletDestination(outlet: FbOutlet, graph: FbGraph, hotel: PublicHotel, sections: PublicHotelSection[], language: SupportedPublicLanguage, domainContext: DomainContext, preferSubdomainRoot: boolean) {
  if (outlet.hotel_id !== hotel.id || !outlet.is_published) return null;
  if (outlet.action_type === 'external_url') return outlet.external_url && safeFbUrl(outlet.external_url) ? {kind:'external' as const,href:outlet.external_url} : null;
  if (outlet.action_type !== 'service') return null;
  const link = graph.service_links.find(l => l.hotel_id === hotel.id && l.outlet_id === outlet.id);
  const section = sections.find(s => s.id === link?.service_id && s.hotel_id === hotel.id && s.enabled);
  const destination = section ? getServiceDestination(section, hotel.slug, language, domainContext, {preferSubdomainRoot}) : null;
  if (destination?.kind === 'external' && !safeFbUrl(destination.href.replace(/^http:/i,'https:'))) return null;
  return destination;
}
export function fbPrice(item: {price_amount_minor:number|null;currency:string;price_on_request:boolean}, language: SupportedPublicLanguage) {
  if (item.price_on_request) return {pt:'Sob consulta',en:'On request',es:'Consultar'}[language];
  if (item.price_amount_minor === null || !Number.isSafeInteger(item.price_amount_minor) || item.price_amount_minor < 0) return null;
  try { return new Intl.NumberFormat({pt:'pt-BR',en:'en-US',es:'es-ES'}[language], {style:'currency',currency:item.currency}).format(item.price_amount_minor / 10**fbCurrencyDigits(item.currency)); } catch { return null; }
}
