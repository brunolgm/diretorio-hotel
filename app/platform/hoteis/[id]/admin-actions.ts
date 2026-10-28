'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requirePlatformAccess } from '@/lib/platform-auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readTrimmedString } from '@/lib/form-utils';
import { isUuid } from '@/lib/security/identifiers';
import { EXISTING_ADMIN_IDENTITY_MESSAGE, provisionExistingHotelAdmin } from '@/lib/platform-hotel-admin';

export type AddHotelAdminState = { error?: string; success?: string; reconciliationId?: string };

export async function addPlatformHotelAdminAction(
  _state: AddHotelAdminState, formData: FormData
): Promise<AddHotelAdminState> {
  const { user } = await requirePlatformAccess();
  const hotelId = readTrimmedString(formData, 'hotel_id');
  const fullName = readTrimmedString(formData, 'full_name');
  const email = readTrimmedString(formData, 'email').toLowerCase();
  const password = readTrimmedString(formData, 'password');
  if (!isUuid(hotelId) || !fullName || fullName.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Revise o hotel, o nome completo e o e-mail.' };
  }
  // Same policy and trimming as createHotelUserAction. No parallel password policy.
  if (password.length < 6) return { error: 'A senha inicial deve ter pelo menos 6 caracteres.' };
  const operationId = randomUUID();
  const supabase = await createClient();
  const result = await provisionExistingHotelAdmin({
    preflight: async () => {
      const { data, error } = await supabase.rpc('check_platform_hotel_admin_creation', { p_hotel_id: hotelId, p_email: email });
      if (error?.message === 'platform_admin_identity_exists') return 'conflict';
      return error || data !== true ? 'invalid' : 'ready';
    },
    createIdentity: async () => {
      const { data, error } = await createAdminClient().auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { platform_hotel_admin: { operation_id: operationId, hotel_id: hotelId, actor_id: user.id } },
      });
      if (error) {
        if (error.code === 'email_exists' || error.code === 'user_already_exists') return 'conflict';
        if (error.status === 400 || error.status === 422) return 'invalid';
        return 'reconcile';
      }
      return data.user ? { userId: data.user.id } : 'reconcile';
    },
    associate: async (userId) => {
      const { data, error } = await supabase.rpc('add_platform_hotel_admin', {
        p_hotel_id: hotelId, p_user_id: userId, p_email: email,
        p_full_name: fullName, p_operation_id: operationId,
      });
      return !error && data?.[0]?.admin_user_id === userId && data[0].hotel_id === hotelId;
    },
  });
  if (result.outcome === 'conflict') return { error: EXISTING_ADMIN_IDENTITY_MESSAGE };
  if (result.outcome === 'invalid') return { error: 'Não foi possível adicionar o administrador. Revise os dados e a disponibilidade do hotel.' };
  if (result.outcome === 'reconcile') return {
    error: 'A operação precisa ser reconciliada antes de uma nova tentativa.', reconciliationId: operationId,
  };
  revalidatePath(`/platform/hoteis/${hotelId}`);
  return { success: 'Administrador adicionado. Os acessos existentes foram preservados.' };
}
