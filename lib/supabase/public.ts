import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getRequiredEnvVar } from '@/lib/env';
import type { Database } from '@/types/database';

export function createPublicClient() {
  return createClient<Database>(
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
