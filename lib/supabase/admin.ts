import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getRequiredEnvVar } from '@/lib/env';
import type { Database } from '@/types/database';

export function createAdminClient() {
  return createClient<Database>(
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
