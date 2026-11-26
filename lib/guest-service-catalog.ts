import type { PublicHotelPageData } from './public-hotel-data';
import type { DomainContext } from './domain-context';
import type { SupportedPublicLanguage } from './public-language';
import { buildPublicHotelServiceHref } from './public-routes.ts';
import { getServiceDestination } from './service-destinations.ts';
import { eligibleFbGraph } from './fb/public.ts';
import { roomServiceAccess } from './fb/room-service-access.ts';
import { guestServiceGroup, guestServiceInteraction, isOwnRoomServiceLink, guestServiceText, normalizeGuestSearch, parseGuestServicePresentation } from './guest-service-presentation.ts';

export type GuestServiceItem = {
  id: string; title: string; content: string | null; summary: string | null;
  category: string; icon: string | null; hours: string | null; location: string | null;
  conditions: string | null; href: string | null; isExternal: boolean; cta: string | null;
  interaction: 'inline' | 'detail' | 'page'; area: string;
  sourceIds?: string[];
  relatedContent?: { title: string; content: string }[];
};

export function isLegacyTvGuide(title: string) {
  return /^(canais de tv|diretorio canais - novotel|tv channels|canales de tv)$/.test(normalizeGuestSearch(title));
}

export function guestServiceArea(section: Pick<PublicHotelPageData['sections'][number], 'title' | 'icon' | 'guest_presentation'>, guide = false) {
  const config = parseGuestServicePresentation(section.guest_presentation);
  if (config.area) return config.area;
  if (guide) return isLegacyTvGuide(section.title) ? 'information' : 'services';
  const title = normalizeGuestSearch(section.title);
  if (section.icon === 'Wifi' || section.icon === 'Coffee' || /^(seguranca|security|seguridad|como usar o cofre|como usar o telefone do apartamento)$/.test(title)) return 'information';
  if (/^(conheca o hotel|about the hotel|discover the hotel|get to know the hotel|conozca el hotel|acomodacoes|accommodations|accommodation|alojamiento)$/.test(title)) return 'hotel';
  if (section.icon === 'UtensilsCrossed') return 'dining';
  if (title === 'ramais' || /^(siga-nos no instagram!?|follow us on instagram!?|siguenos en instagram!?)$/.test(title)) return 'contact';
  return 'services';
}


function destinationIdentity(href: string) {
  try {
    const url = new URL(href, 'https://guest.invalid');
    url.searchParams.delete('lang');
    url.searchParams.sort();
    return url.href;
  } catch { return href; }
}

/** Projection only: no mutations, cross-tenant fallback or operational admission. */
export function getGuestServiceCatalog(data: PublicHotelPageData, language: SupportedPublicLanguage, domainContext: DomainContext, preferSubdomainRoot: boolean): GuestServiceItem[] {
  const own = data.sections.filter(s => s.hotel_id === data.hotel.id && s.enabled);
  const native = roomServiceAccess(data, language, domainContext, preferSubdomainRoot);
  const graph = eligibleFbGraph(data.fb, data.hotel.id);
  const nativeOutlet = native && graph?.outlets.find(o => o.type === 'room_service' && o.action_type !== 'external_url' && graph.outlet_menus.some(l => l.outlet_id === o.id && graph.categories.some(c => c.menu_id === l.menu_id && graph.items.some(i => i.category_id === c.id))));
  const linkedIds = new Set(nativeOutlet ? data.fb?.service_links.filter(l => l.hotel_id === data.hotel.id && l.outlet_id === nativeOutlet.id).map(l => l.service_id) : []);
  const experiences = new Map<string, GuestServiceItem>();
  const result: GuestServiceItem[] = [];
  for (const section of own) {
    const config = parseGuestServicePresentation(section.guest_presentation);
    const title = normalizeGuestSearch(section.title);
    const isRoom = linkedIds.has(section.id) || section.icon === 'BellRing' || /^(room service|servicio de habitaciones)(?:\s*[—–-].*)?$/.test(title);
    const canonicalRoom = Boolean(native && (isOwnRoomServiceLink(section.url, data.hotel, domainContext.productRootDomain) || (linkedIds.has(section.id) && !section.url?.trim() && section.service_action_type !== 'room_restaurant_menu')));
    const guide = data.serviceGuides?.some(g => g.serviceId === section.id) || isLegacyTvGuide(section.title);
    const area = guestServiceArea(section, Boolean(guide));
    const destination = guide ? { href: buildPublicHotelServiceHref({ slug: data.hotel.slug, serviceId: section.id, language, domainContext, preferSubdomainRoot }), isExternal: false } : getServiceDestination(section, data.hotel.slug, language, domainContext, { preferSubdomainRoot });
    const summary = guestServiceText(config, 'summary', language);
    const hours = guestServiceText(config, 'hours', language), location = guestServiceText(config, 'location', language);
    const conditions = guestServiceText(config, 'conditions', language);
    const interaction = guestServiceInteraction(config, section, destination, Boolean(guide) || isOwnRoomServiceLink(section.url, data.hotel, domainContext.productRootDomain), conditions);
    const item: GuestServiceItem = { id: section.id, title: canonicalRoom ? native!.label : section.title,
      content: section.content, summary: canonicalRoom ? summary || native!.cta : summary, hours, location, conditions,
      category: guestServiceGroup(isRoom ? { ...section, category: 'Room service' } : section, language), icon: isRoom ? 'ConciergeBell' : section.icon,
      href: canonicalRoom ? native!.href : interaction === 'detail' && !destination?.isExternal && config.interaction !== 'assistance' ? null : destination?.href || null,
      isExternal: canonicalRoom ? false : destination?.isExternal || false,
      cta: canonicalRoom ? native!.cta : section.cta,
      sourceIds: [section.id],
      interaction: canonicalRoom ? 'page' : interaction, area: canonicalRoom ? config.area || 'services' : area };
    if (item.interaction === 'page' && item.content && (item.content.length > 110 || item.summary && item.summary !== item.content)) item.relatedContent = [item.content, item.conditions].filter((v): v is string => Boolean(v)).map(content => ({title:item.title,content}));
    const key = canonicalRoom ? 'native-room-service:' + item.area : isRoom && item.href ? `${section.service_action_type}:${destinationIdentity(item.href)}:${item.interaction}:${item.area}` : null;
    const existing = key ? experiences.get(key) : null;
    if (existing) {
      existing.sourceIds!.push(section.id);
      // Keep complementary editorial text alongside the primary direct access.
      const additions = [existing.content, existing.conditions, item.content, item.conditions, item.hours, item.location].filter((v): v is string => Boolean(v));
      existing.relatedContent = Array.from(new Set([...(existing.relatedContent || []).map(r => r.content), ...additions])).map(content => ({ title: item.title, content }));
    } else {
      result.push(item);
      if (key) experiences.set(key, item);
    }
  }
  if (native && !experiences.has('native-room-service:services')) result.unshift({ id: 'native-room-service', title: native.label, summary: native.cta, content: null, hours: null, location: null, conditions: null, category: guestServiceGroup({ category: 'Room service', icon: 'ConciergeBell' }, language), icon: 'ConciergeBell', href: native.href, isExternal: false, cta: native.cta, interaction: 'page', area: 'services', sourceIds: [] });
  return result;
}
