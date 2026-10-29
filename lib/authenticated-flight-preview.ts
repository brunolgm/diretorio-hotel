import 'server-only';
import {createClient} from '@/lib/supabase/server';
import {requireHotelModule} from '@/lib/admin-entitlements';
import {requireAdminAccess} from '@/lib/auth';
import {getPublicNavigationAvailability} from '@/lib/public-navigation';
import type {PublicHotelPageData,PublicFlightCenterData} from '@/lib/public-hotel-data';
import {experienceHttpsUrl} from '@/lib/public-experience-media';

/** Called only after the shared own-hotel preview guard. Uses its genuine RLS client, no provider. */
export async function getAuthenticatedFlightPreview(data:PublicHotelPageData):Promise<PublicFlightCenterData|null>{
 const {profile}=await requireAdminAccess('administrador');
 if(profile.hotel_id!==data.hotel.id)return null;
 await requireHotelModule('travel.flights');
 const client=await createClient(),hotel=data.hotel;
 const [settingsResult,linksResult]=await Promise.all([
  client.from('hotel_flight_settings').select('*').eq('hotel_id',hotel.id).maybeSingle(),
  client.from('hotel_airports').select('*').eq('hotel_id',hotel.id).eq('is_active',true).order('sort_order'),
 ]);
 if(settingsResult.error||linksResult.error||!settingsResult.data||!linksResult.data?.length)return null;
 const airportsResult=await client.from('airports').select('id,iata_code,name,city,timezone,official_departures_url,official_arrivals_url').in('id',linksResult.data.map(a=>a.airport_id)).eq('is_active',true);
 if(airportsResult.error)return null;
 const s=settingsResult.data;
 const airports=linksResult.data.flatMap(link=>{const a=airportsResult.data?.find(a=>a.id===link.airport_id);return a?[{
  iataCode:a.iata_code,name:a.name,city:a.city,timezone:a.timezone,
  officialDeparturesUrl:s.official_links_enabled?experienceHttpsUrl(a.official_departures_url):null,
  officialArrivalsUrl:s.official_links_enabled?experienceHttpsUrl(a.official_arrivals_url):null,
  estimatedTransferMinutes:link.estimated_transfer_minutes,domesticLeadMinutes:link.domestic_lead_minutes,
  internationalLeadMinutes:link.international_lead_minutes,safetyMarginMinutes:link.safety_margin_minutes,
 }]:[];});
 if(!airports.length)return null;
 return {hotel,airports,navigationAvailability:getPublicNavigationAvailability({layout:data.layout,servicesModuleEnabled:!!data.sections.length,servicesContentCount:data.sections.length,menuModuleEnabled:false,menuContentCount:0}),settings:{
  departurePlanningEnabled:s.departure_planning_enabled,transferEnabled:s.transfer_enabled,wakeUpEnabled:s.wake_up_enabled,
  breakfastBoxEnabled:s.breakfast_box_enabled,receptionEnabled:s.reception_enabled,officialLinksEnabled:s.official_links_enabled,departureNotice:s.departure_notice,
 }};
}
