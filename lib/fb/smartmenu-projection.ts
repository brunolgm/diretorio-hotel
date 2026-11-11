import {eligibleFbGraph} from './public.ts';
import type {FbGraph} from './types.ts';
import type {NativeOffer, NativeOutlet} from './orders/journey.ts';

/** Restrict both editorial and operational projections to one hotel's linked Room Service. */
export function roomServiceProjection(graph: FbGraph | null | undefined, hotelId: string, offer?: NativeOffer) {
  const eligible = eligibleFbGraph(graph, hotelId);
  const outlet = eligible?.outlets.filter(row => row.type === 'room_service' && row.action_type !== 'external_url')
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))[0];
  if (!eligible || !outlet) return null;
  const menuIds = new Set(eligible.outlet_menus.filter(link => link.outlet_id === outlet.id).map(link => link.menu_id));
  const menus = eligible.menus.filter(menu => menuIds.has(menu.id)).sort((a, b) => a.sort_order - b.sort_order);
  const categories = eligible.categories.filter(category => menuIds.has(category.menu_id)).sort((a, b) => a.sort_order - b.sort_order);
  const native = offer?.outlets.find(row => row.id === outlet.id);
  if (native?.hidden) return null;
  const projected: NativeOutlet = native ? {
    ...native,
    menus: menus.map(menu => ({id: menu.id, name: menu.name, categories: categories.filter(category => category.menu_id === menu.id)})),
    products: native.products.filter(product => menuIds.has(product.menu_id)),
  } : {
    id: outlet.id, name: outlet.name, description: outlet.short_description,
    available: false, hidden: false, pickup: false, room_delivery: false,
    menus: menus.map(menu => ({id: menu.id, name: menu.name, categories: categories.filter(category => category.menu_id === menu.id)})),
    products: eligible.items.filter(item => categories.some(category => category.id === item.category_id)).map(item => ({
      id: item.id, kind: 'item', menu_id: categories.find(category => category.id === item.category_id)!.menu_id,
      category_id: item.category_id, name: item.name, description: item.full_description || item.short_description,
      amount_minor: item.price_on_request ? null : item.price_amount_minor, currency: item.currency,
      available: false, groups: [], allergens: item.allergens_info, dietary: item.dietary_info,
    })),
  };
  return {outlet, native: projected, hasRoomContext: offer?.has_room_context === true};
}
