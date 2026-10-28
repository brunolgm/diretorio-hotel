// Pure orchestration: no credentials, passwords or provider errors leave this boundary.
export const EXISTING_ADMIN_IDENTITY_MESSAGE = 'Já existe uma identidade para este e-mail. Revise o usuário antes de vinculá-lo a outro hotel.';

export type HotelAdminResult = { outcome: 'success' | 'conflict' | 'invalid' | 'reconcile' };

export async function provisionExistingHotelAdmin(io: {
  preflight: () => Promise<'ready' | 'conflict' | 'invalid'>;
  createIdentity: () => Promise<{ userId: string } | 'conflict' | 'invalid' | 'reconcile'>;
  associate: (userId: string) => Promise<boolean>;
}): Promise<HotelAdminResult> {
  try {
    const check = await io.preflight();
    if (check !== 'ready') return { outcome: check };
  } catch {
    return { outcome: 'invalid' }; // Auth has not been called.
  }
  try {
    const identity = await io.createIdentity();
    if (typeof identity === 'string') return { outcome: identity };
    if (await io.associate(identity.userId)) return { outcome: 'success' };
  } catch {
    // A timeout may hide an Auth creation or a committed database transaction.
  }
  // Even a definitive SQL rollback does not prove no concurrent association exists.
  // Never delete Auth here. Server-owned provenance allows human reconciliation.
  return { outcome: 'reconcile' };
}
