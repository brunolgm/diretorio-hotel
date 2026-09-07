import { createRouteContextHandler } from '@/lib/flights/route-context.server';
import { createPublicClient } from '@/lib/supabase/public';
import { createAdminClient } from '@/lib/supabase/admin';
import { isHotelModuleEnabled } from '@/lib/server-entitlements';

export const runtime = 'nodejs';
export const POST = createRouteContextHandler({
  publicClient: createPublicClient,
  adminClient: createAdminClient,
  isEnabled: hotelId => isHotelModuleEnabled(hotelId, 'travel.flights'),
});
