import 'server-only';

import { normalizeAnalyticsPeriod, normalizeHotelAnalytics } from '@/lib/analytics-pro';
import { createClient } from '@/lib/supabase/server';

export async function getCurrentHotelAnalytics(period?: string | null) {
  const normalizedPeriod = normalizeAnalyticsPeriod(period);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_current_hotel_analytics', { p_period: normalizedPeriod });
  if (error) throw new Error('Não foi possível carregar os analytics do hotel.');
  const analytics = normalizeHotelAnalytics(data);
  if (!analytics) throw new Error('O contrato de analytics retornou uma resposta inválida.');
  return analytics;
}
