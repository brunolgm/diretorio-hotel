import 'server-only';
import { getPublicHotelPageDataForHotel } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
/** Private preview: genuine cookie session, own tenant, existing RLS and published content only. */
export async function getAuthenticatedHotelPreviewData(language: SupportedPublicLanguage) {
  const { requireAdminAccess } = await import('@/lib/auth');
  const { requireHotelModule, getCurrentHotelEntitlements } = await import('@/lib/admin-entitlements');
  const { createClient } = await import('@/lib/supabase/server');
  const { getRenderableExperienceLayout } = await import('@/lib/experience-layout');
  const { profile } = await requireAdminAccess('administrador');
  await requireHotelModule('experience.preview');
  await requireHotelModule('core.directory');
  const client = await createClient();
  // Exactly the existing public projection, never the entire private hotels row.
  const result = await client.from('hotels').select('id,name,slug,subdomain,city,booking_url,website_url,instagram_url,whatsapp_number,wifi_name,wifi_password,breakfast_hours,checkin_time,checkout_time,logo_url,hero_image_url,brand_code,theme_preset,theme_primary_color').eq('id',profile.hotel_id).single();
  if (result.error || !result.data) throw new Error('Prévia indisponível.');
  const modules = await getCurrentHotelEntitlements();
  const data = await getPublicHotelPageDataForHotel(client, result.data, language, true);
  data.layout = getRenderableExperienceLayout(data.layout, modules);
  if (!modules.has('content.services')) data.sections = [];
  if (!modules.has('content.departments')) data.departments = [];
  if (!modules.has('content.policies')) data.policies = [];
  if (!modules.has('content.banners')) data.banners = [];
  if (!modules.has('content.announcements')) data.announcements = [];
  if (!modules.has('experience.appearance')) { data.experienceMedia = []; data.presentation = null; }
  else if (!modules.has('content.services')) data.experienceMedia = data.experienceMedia.filter(m=>m.slot!=='restaurant');
  const airports = modules.has('travel.flights') ? await client.from('hotel_airports').select('airport_id').eq('hotel_id',profile.hotel_id).eq('is_active',true) : null;
  const activeAirports = airports?.data?.length ? await client.from('airports').select('id').in('id',airports.data.map(a=>a.airport_id)).eq('is_active',true) : null;
  if (!activeAirports?.data?.length) data.flightHomeCard = null;
  return data;
}
