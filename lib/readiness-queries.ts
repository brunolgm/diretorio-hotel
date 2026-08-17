import 'server-only';

import { requirePlatformAccess } from '@/lib/platform-auth';
import { normalizeHotelReadiness } from '@/lib/hotel-readiness';
import { createClient } from '@/lib/supabase/server';

export async function getCurrentHotelReadiness() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_current_hotel_readiness');
  const readiness = normalizeHotelReadiness(data || []);
  if (error || !readiness) throw new Error('Não foi possível calcular a prontidão do hotel.');
  return readiness;
}

export async function getPlatformHotelReadiness(hotelId: string) {
  await requirePlatformAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_platform_hotel_readiness', { p_hotel_id: hotelId });
  const readiness = normalizeHotelReadiness(data || []);
  if (error || !readiness) throw new Error('Não foi possível calcular a prontidão para ativação.');
  return readiness;
}
