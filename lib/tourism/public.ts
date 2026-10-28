import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { PublicHotel } from '../public-hotel-data';
import type { TourismTranslationFields } from './translations.ts';
import { TOURISM_TRANSLATABLE_FIELDS } from './translations.ts';
import { TOURISM_TYPES } from './catalog.ts';
import { TOURISM_PHONE_PATTERN, isTourismUrl } from './validation.ts';

export type PublicTourismItem = Database['public']['Tables']['hotel_tourism_items']['Row'];
export interface PublicTourismData { hotel: PublicHotel; items: PublicTourismItem[] }
export function tourismFilter(value: unknown) { return TOURISM_TYPES.some((type) => type.key === value) ? value as PublicTourismItem['type'] : null; }
export function tourismHttpsUrl(value: string | null) { return value?.startsWith('https://') && isTourismUrl(value) ? value : null; }
export function tourismPhone(value: string | null) { return value && TOURISM_PHONE_PATTERN.test(value) ? value : null; }
export function translateTourismItem(item: PublicTourismItem, translation?: Partial<TourismTranslationFields> | null): PublicTourismItem {
  const result = { ...item };
  for (const field of TOURISM_TRANSLATABLE_FIELDS) {
    const value = translation?.[field];
    if (typeof value === 'string' && value.trim()) result[field] = value;
  }
  return result;
}

/** Receives a hotel resolved through public_hotels by the canonical anonymous loader. */
export async function loadPublicTourism(client: SupabaseClient<Database>, hotel: PublicHotel, language: 'pt' | 'en' | 'es', itemSlug?: string): Promise<PublicTourismData | null> {
  const { data: enabled, error: gateError } = await client.rpc('is_hotel_module_enabled', { p_hotel_id: hotel.id, p_module_key: 'content.tourism' });
  if (gateError) throw new Error('Não foi possível consultar a disponibilidade do Turismo.');
  if (!enabled) return null;
  let query = client.from('hotel_tourism_items').select('*').eq('hotel_id', hotel.id).eq('is_published', true).order('sort_order').order('id');
  if (itemSlug !== undefined) query = query.eq('slug', itemSlug);
  const { data, error } = await query;
  if (error) throw new Error('Não foi possível carregar o Turismo.');
  const items = (data || []).filter((item) => item.hotel_id === hotel.id && item.is_published && (itemSlug === undefined || item.slug === itemSlug));
  if (language === 'pt' || !items.length) return { hotel, items };
  const { data: translations, error: translationError } = await client.from('hotel_tourism_item_translations').select('item_id,name,short_description,full_description,opening_hours,price_info,duration_info').in('item_id', items.map((item) => item.id)).eq('language', language);
  if (translationError) console.error('Tourism public translation lookup failed; retaining PT fallback');
  const byId = new Map((translationError ? [] : translations || []).map((row) => [row.item_id, row]));
  return { hotel, items: items.map((item) => translateTourismItem(item, byId.get(item.id))) };
}

export async function publicTourismHomeAvailable(client: SupabaseClient<Database>, hotelId: string) {
  const { data: enabled, error: gateError } = await client.rpc('is_hotel_module_enabled', { p_hotel_id: hotelId, p_module_key: 'content.tourism' });
  if (gateError) { console.error('Tourism home entitlement lookup failed'); return false; }
  if (!enabled) return false;
  const { data, error } = await client.from('hotel_tourism_items').select('id').eq('hotel_id', hotelId).eq('is_published', true).limit(1);
  if (error) { console.error('Tourism home published-item lookup failed'); return false; }
  return Boolean(data?.length);
}
