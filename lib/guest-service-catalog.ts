import type { PublicHotelPageData } from './public-hotel-data';
import type { DomainContext } from './domain-context';
import type { SupportedPublicLanguage } from './public-language';
import { buildPublicHotelServiceHref } from './public-routes.ts';
import { getServiceDestination } from './service-destinations.ts';
import { eligibleFbGraph } from './fb/public.ts';
import { roomServiceAccess } from './fb/room-service-access.ts';
import { guestServiceGroup, guestServiceText, normalizeGuestSearch, parseGuestServicePresentation } from './guest-service-presentation.ts';

export type GuestServiceItem = {
  id: string; title: string; content: string | null; summary: string | null;
  category: string; icon: string | null; hours: string | null; location: string | null;
  conditions: string | null; href: string | null; isExternal: boolean; cta: string | null;
  interaction: 'inline' | 'detail' | 'page'; area: string;
};

/** Projection only: no mutations, cross-tenant fallback or operational admission. */
export function getGuestServiceCatalog(data: PublicHotelPageData, language: SupportedPublicLanguage, domainContext: DomainContext, preferSubdomainRoot: boolean): GuestServiceItem[] {
  const own = data.sections.filter(s => s.hotel_id === data.hotel.id && s.enabled);
  const native = roomServiceAccess(data, language, domainContext, preferSubdomainRoot);
  const graph = eligibleFbGraph(data.fb, data.hotel.id);
  const nativeOutlet = native && graph?.outlets.find(o => o.type === 'room_service' && o.action_type !== 'external_url' && graph.outlet_menus.some(l => l.outlet_id === o.id && graph.categories.some(c => c.menu_id === l.menu_id && graph.items.some(i => i.category_id === c.id))));
  const linkedIds = new Set(nativeOutlet ? data.fb?.service_links.filter(l => l.hotel_id === data.hotel.id && l.outlet_id === nativeOutlet.id).map(l => l.service_id) : []);
  let roomAdded = false;
  const result: GuestServiceItem[] = [];
  for (const section of own) {
    const config = parseGuestServicePresentation(section.guest_presentation);
    const title = normalizeGuestSearch(section.title);
    const isRoom = linkedIds.has(section.id) || /^room service(?:\s*[—–-].*)?$/.test(title);
    // Deduplicate only when a real canonical native destination is available.
    if (native && isRoom && roomAdded) continue;
    const guide = data.serviceGuides?.some(g => g.serviceId === section.id);
    let area = config.area || 'services';
    if (!config.area && !guide) {
      if (section.icon === 'Wifi') area = 'information';
      else if (/^(conheca o hotel|about the hotel|discover the hotel|get to know the hotel|conozca el hotel|acomodacoes|accommodations|accommodation|alojamiento)$/.test(title)) area = 'hotel';
      else if (/^(seguranca|security|seguridad)$/.test(title)) area = 'information';
      // Existing F&B graph is the dining source; do not guess links to a restaurant.
      else if (section.icon === 'UtensilsCrossed' && !isRoom && (!data.fb || graph?.service_links.some(l => l.service_id === section.id && graph.outlets.some(o => o.id === l.outlet_id && o.type !== 'room_service')))) area = 'dining';
    }
    const destination = guide ? { href: buildPublicHotelServiceHref({ slug: data.hotel.slug, serviceId: section.id, language, domainContext, preferSubdomainRoot }), isExternal: false } : getServiceDestination(section, data.hotel.slug, language, domainContext, { preferSubdomainRoot });
    const summary = guestServiceText(config, 'summary', language);
    const hours = guestServiceText(config, 'hours', language), location = guestServiceText(config, 'location', language);
    const conditions = guestServiceText(config, 'conditions', language);
    const shortContent = (section.content?.length || 0) <= 110 && !conditions;
    const dedicated = guide || section.service_action_type === 'room_restaurant_menu' || (destination?.isExternal && !['detail', 'assistance'].includes(config.interaction || '')) || ['page', 'external', 'guide'].includes(config.interaction || '');
    const interaction = dedicated && destination ? 'page' : config.interaction === 'inline' ? 'inline' : config.interaction === 'detail' || config.interaction === 'assistance' || !shortContent ? 'detail' : 'inline';
    result.push({ id: section.id, title: native && isRoom ? native.label : section.title,
      content: section.content, summary: native && isRoom ? summary || native.cta : summary, hours, location, conditions,
      category: guestServiceGroup(isRoom ? { ...section, category: 'Room service' } : section, language), icon: isRoom ? 'ConciergeBell' : section.icon,
      href: native && isRoom ? native.href : destination?.href || null,
      isExternal: native && isRoom ? false : destination?.isExternal || false,
      cta: native && isRoom ? native.cta : section.cta,
      interaction: native && isRoom ? 'page' : interaction, area: native && isRoom ? 'services' : area });
    if (native && isRoom) roomAdded = true;
  }
  if (native && !roomAdded) result.unshift({ id: 'native-room-service', title: native.label, summary: native.cta, content: null, hours: null, location: null, conditions: null, category: guestServiceGroup({ category: 'Room service', icon: 'ConciergeBell' }, language), icon: 'ConciergeBell', href: native.href, isExternal: false, cta: native.cta, interaction: 'page', area: 'services' });
  return result;
}
