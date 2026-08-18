import 'server-only';

import { normalizeExperienceLayout } from '@/lib/experience-layout';
import { createClient } from '@/lib/supabase/server';

export async function getCurrentHotelExperienceLayout() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_current_hotel_experience_layout');
  if (error) throw new Error('Não foi possível carregar a composição da experiência.');
  return normalizeExperienceLayout(data);
}
