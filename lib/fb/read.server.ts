import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { FbGraph } from './types';
import { eligibleFbGraph } from './public.ts';
export async function loadPublicFb(client: SupabaseClient<Database>, hotelId: string, language: string): Promise<FbGraph|null> {
  const gate = await client.rpc('is_hotel_module_enabled', {p_hotel_id:hotelId,p_module_key:'fb.menu'});
  if (gate.error || gate.data !== true) return null;
  const result = await client.rpc('get_public_hotel_fb', {p_hotel_id:hotelId,p_language:language});
  if (result.error) throw new Error('Não foi possível carregar Gastronomia.');
  return eligibleFbGraph(result.data as unknown as FbGraph|null, hotelId);
}
