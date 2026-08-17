import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { ModuleKey } from '@/lib/modules/catalog';

export async function isHotelModuleEnabled(hotelId: string, moduleKey: ModuleKey) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('is_hotel_module_enabled', {
    p_hotel_id: hotelId,
    p_module_key: moduleKey,
  });
  return !error && data === true;
}
