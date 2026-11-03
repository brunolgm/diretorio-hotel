export const FB_KINDS = ['outlet', 'menu', 'category', 'item'] as const;
export type FbKind = typeof FB_KINDS[number];
export const FB_LIMITS={outlet:50,menu:100,category:500,item:5000} as const;
export const OUTLET_TYPES = ['restaurant', 'bar', 'room_service', 'breakfast', 'cafe', 'other'] as const;
export type OutletType = typeof OUTLET_TYPES[number];
export interface FbBase { id: string; hotel_id: string; name: string; is_published: boolean; sort_order: number; revision: number; source_revision: number; created_at?: string; updated_at?: string }
export interface FbOutlet extends FbBase { type: OutletType; short_description: string | null; full_description: string | null; opening_hours: string | null; location_info: string | null; main_image_path: string | null; is_featured: boolean; action_type: 'none' | 'service' | 'external_url'; external_url: string | null }
export interface FbMenu extends FbBase { short_description: string | null }
export interface FbCategory extends FbBase { menu_id: string; description: string | null }
export interface FbItem extends FbBase { category_id: string; short_description: string | null; full_description: string | null; price_amount_minor: number | null; currency: string; price_on_request: boolean; allergens_info: string | null; dietary_info: string | null; is_available: boolean; main_image_path: string | null }
export interface FbEntities { outlet: FbOutlet; menu: FbMenu; category: FbCategory; item: FbItem }
export type FbRecord = FbOutlet | FbMenu | FbCategory | FbItem;
export interface FbOutletMenu { hotel_id: string; outlet_id: string; menu_id: string; sort_order: number }
export interface FbServiceLink { hotel_id: string; outlet_id: string; service_id: string }
export interface FbTranslation { hotel_id: string; entity_id: string; language: string; source_revision: number; fields: Record<string, string | null>; updated_at?: string }
export interface FbGraph { outlets: FbOutlet[]; menus: FbMenu[]; categories: FbCategory[]; items: FbItem[]; outlet_menus: FbOutletMenu[]; service_links: FbServiceLink[] }
export const FB_TABLES = { outlet: 'hotel_fb_outlets', menu: 'hotel_fb_menus', category: 'hotel_fb_categories', item: 'hotel_fb_items' } as const;
export const FB_TRANSLATION_TABLES = { outlet:'hotel_fb_outlets_translations',menu:'hotel_fb_menus_translations',category:'hotel_fb_categories_translations',item:'hotel_fb_items_translations' } as const;
export function isFbKind(value: unknown): value is FbKind { return FB_KINDS.includes(value as FbKind); }
