import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Call only with airport codes already returned by the authorized public RPC.
// No new table grant or public endpoint; project only the timezone, fail closed.
export async function getFlightAirportTimezones(authorizedCodes: string[]): Promise<Record<string, string>> {
  const codes = [...new Set(authorizedCodes)].filter(code => /^[A-Z]{3}$/.test(code));
  if (!codes.length) return {};
  try {
    const { data, error } = await createAdminClient().from('airports').select('iata_code,timezone').in('iata_code', codes).eq('is_active', true);
    if (error) return {};
    return Object.fromEntries((data ?? []).flatMap(row => {
      try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }); return [[row.iata_code, row.timezone]]; }
      catch { return []; }
    }));
  } catch { return {}; }
}
