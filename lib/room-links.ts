import crypto from 'node:crypto';
import type { Database } from '@/types/database';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyProductHostname, PRODUCT_ROOT_DOMAIN } from '@/lib/product-domain';

export type HotelRoomLink = Database['public']['Tables']['hotel_room_links']['Row'];
type PublicHotel = Database['public']['Tables']['hotels']['Row'];

export function generateRoomToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function buildRoomPublicUrl(hotel: Pick<PublicHotel, 'slug' | 'subdomain'>, roomToken: string) {
  if (hotel.subdomain) {
    return `https://${hotel.subdomain}.${PRODUCT_ROOT_DOMAIN}/r/${roomToken}`;
  }

  return `https://${PRODUCT_ROOT_DOMAIN}/r/${roomToken}`;
}

export function buildHotelPublicEntryUrl(
  hotel: Pick<PublicHotel, 'slug' | 'subdomain'>,
  requestUrl?: URL
) {
  if (
    hotel.subdomain &&
    requestUrl &&
    classifyProductHostname(requestUrl.hostname, PRODUCT_ROOT_DOMAIN).kind !==
      'external-or-unknown'
  ) {
    return `https://${hotel.subdomain}.${PRODUCT_ROOT_DOMAIN}/`;
  }

  if (hotel.subdomain && !requestUrl) {
    return `https://${hotel.subdomain}.${PRODUCT_ROOT_DOMAIN}/`;
  }

  if (requestUrl) {
    return new URL(`/hotel/${hotel.slug}`, requestUrl).toString();
  }

  return `https://${PRODUCT_ROOT_DOMAIN}/hotel/${hotel.slug}`;
}

export async function findActiveRoomLinkByToken(roomToken: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hotel_room_links')
    .select('id, hotel_id, room_number, label, room_token, restaurant_menu_url, is_active')
    .eq('room_token', roomToken)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[room-links] findActiveRoomLinkByToken failed', {
      operation: 'load active room link by token',
      message: error.message,
    });
    return null;
  }

  return data;
}

export async function findHotelById(hotelId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('id', hotelId)
    .maybeSingle();

  if (error) {
    console.error('[room-links] findHotelById failed', {
      operation: 'load hotel for room link',
      hotelId,
      message: error.message,
    });
    return null;
  }

  return data;
}

export async function resolveRoomRestaurantMenuUrl(params: {
  hotelId: string;
  roomToken: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hotel_room_links')
    .select('hotel_id, room_number, restaurant_menu_url, is_active')
    .eq('hotel_id', params.hotelId)
    .eq('room_token', params.roomToken)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[room-links] resolveRoomRestaurantMenuUrl failed', {
      operation: 'resolve room restaurant menu url',
      hotelId: params.hotelId,
      message: error.message,
    });
    return { kind: 'invalid' as const };
  }

  if (!data) {
    return { kind: 'invalid' as const };
  }

  if (!data.restaurant_menu_url) {
    return {
      kind: 'missing-menu' as const,
      roomNumber: data.room_number,
    };
  }

  return {
    kind: 'ready' as const,
    roomNumber: data.room_number,
    url: data.restaurant_menu_url,
  };
}

export async function resolveActiveRoomContextForHotel(params: {
  hotelId: string;
  roomToken: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hotel_room_links')
    .select('room_number, label, is_active')
    .eq('hotel_id', params.hotelId)
    .eq('room_token', params.roomToken)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[room-links] resolveActiveRoomContextForHotel failed', {
      operation: 'resolve active room context for hotel',
      hotelId: params.hotelId,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    roomNumber: data.room_number,
    label: data.label,
  };
}
