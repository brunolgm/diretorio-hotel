import { createAirLabsCoordinator } from '@/lib/flights/airlabs-coordinator.server';
import { airlabsStore } from '@/lib/flights/airlabs-store.server';
import { createFlightStatusHandler } from '@/lib/flights/flight-status-handler.server';
import { isHotelModuleEnabled } from '@/lib/server-entitlements';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'nodejs';

export const POST = createFlightStatusHandler({
  async authorize(hotelSlug, departureAirport) {
    const supabase = createPublicClient();
    const { data: hotel, error } = await supabase.from('public_hotels').select('id').eq('slug', hotelSlug).maybeSingle();
    if (error) throw new Error('hotel_lookup_failed');
    if (!hotel || !await isHotelModuleEnabled(hotel.id, 'travel.flights')) return false;
    const { data: airports, error: centerError } = await supabase.rpc('get_public_hotel_flight_center', { p_hotel_id: hotel.id });
    if (centerError) throw new Error('flight_center_lookup_failed');
    return airports?.some((airport) => airport.airport_iata_code === departureAirport) ? { hotelId: hotel.id } : false;
  },
  lookup: (query, includeLive, hotelId) => createAirLabsCoordinator({
    store: airlabsStore,
    accountScope: process.env.AIRLABS_ACCOUNT_SCOPE,
    async authorize(id, airport) {
      if (!await isHotelModuleEnabled(id, 'travel.flights')) return false;
      const { data, error } = await createPublicClient().rpc('get_public_hotel_flight_center', { p_hotel_id: id });
      if (error) throw new Error('flight_center_lookup_failed');
      return Boolean(data?.some(row => row.airport_iata_code === airport));
    },
  }).lookup(query, includeLive, hotelId),
});
