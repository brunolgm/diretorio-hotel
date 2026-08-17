import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isModuleKey, type ModuleKey } from '@/lib/modules/catalog';

export async function getCurrentHotelEntitlements(): Promise<ReadonlySet<ModuleKey>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_current_hotel_modules');

  if (error) throw new Error('Não foi possível validar os módulos deste hotel.');

  return new Set(
    (data || [])
      .filter((row) => row.is_enabled && isModuleKey(row.module_key))
      .map((row) => row.module_key as ModuleKey)
  );
}

export async function hasHotelModule(moduleKey: ModuleKey) {
  return (await getCurrentHotelEntitlements()).has(moduleKey);
}

export async function requireHotelModule(moduleKey: ModuleKey) {
  if (!(await hasHotelModule(moduleKey))) redirect('/admin/modulo-indisponivel');
}
