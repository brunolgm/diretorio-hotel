import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import type { CoordinatorStore } from './airlabs-coordinator.server';

// Construct service-role clients lazily, after request authorization.
export const airlabsStore: CoordinatorStore = {
  async admit(account, hotelId, query) {
    const { data, error } = await createAdminClient().rpc('admit_airlabs_query', { p_account_scope: account, p_hotel_id: hotelId, p_query: query });
    if (error) throw new Error('airlabs_admission_failed');
    return data;
  },
  async publish(key, owner, result, ttl) {
    const { data, error } = await createAdminClient().rpc('publish_airlabs_query', { p_canonical_key: key, p_owner_token: owner, p_result: result as Json, p_ttl_seconds: ttl });
    if (error) throw new Error('airlabs_publication_failed');
    return data === true;
  },
  async close(key, owner, errorCode) {
    const { data, error } = await createAdminClient().rpc('close_airlabs_query', { p_canonical_key: key, p_owner_token: owner, p_error: errorCode });
    if (error) throw new Error('airlabs_close_failed');
    return data === true;
  },
};
