'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAccess } from '@/lib/platform-auth';
import { resolvePlatformInviteRedirectUrl } from '@/lib/platform-invite-url';
import { provisionHotelOnboarding, validatePlatformOnboardingForm } from '@/lib/platform-onboarding';
import { getRequiredEnvVar } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { OnboardingActionState } from './state';

function isDuplicateAuthUserError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || error);
  return /already|registered|exists|duplicate/i.test(message);
}

export async function createPlatformHotelOnboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  await requirePlatformAccess();
  const validation = validatePlatformOnboardingForm(formData);
  if (!validation.ok) return { error: validation.message };

  const input = validation.value;
  const adminClient = createAdminClient();
  const supabase = await createClient();
  const inviteRedirectTo = resolvePlatformInviteRedirectUrl(
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  );
  const provisioning = await provisionHotelOnboarding({
    inviteAuthUser: async () => {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(input.adminEmail, {
        data: { full_name: input.adminFullName },
        redirectTo: inviteRedirectTo,
      });
      if (error || !data.user) return { ok: false as const, error: error || new Error('Auth invite returned no user') };
      return { ok: true as const, value: { userId: data.user.id } };
    },
    createHotel: async (userId) => {
      const { data, error } = await supabase.rpc('create_platform_hotel_onboarding', {
        p_name: input.name,
        p_city: input.city,
        p_slug: input.slug,
        p_subdomain: input.subdomain,
        p_brand_code: input.brandCode,
        p_theme_preset: input.themePreset,
        p_admin_user_id: userId,
        p_admin_email: input.adminEmail,
        p_admin_full_name: input.adminFullName,
      });
      const hotel = data?.[0];
      return error || !hotel
        ? { ok: false as const, error: error || new Error('Onboarding RPC returned no hotel') }
        : { ok: true as const, value: { hotelId: hotel.hotel_id } };
    },
    deleteAuthUser: async (userId) => {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      return error ? { ok: false as const, error } : { ok: true as const, value: undefined };
    },
  });

  if (!provisioning.ok && provisioning.stage === 'auth') {
    return { error: isDuplicateAuthUserError(provisioning.error) ? 'Já existe um usuário com este e-mail.' : 'Não foi possível enviar o convite ao administrador inicial.' };
  }
  if (!provisioning.ok && provisioning.stage === 'database') {
    if (!provisioning.compensated) {
      console.error('[platform-onboarding] incomplete Auth compensation', { adminUserId: provisioning.adminUserId });
      return { error: 'A criação falhou e o convite não pôde ser revertido. Interrompa novas tentativas e solicite reconciliação administrativa.' };
    }
    const message = String((provisioning.error as { message?: unknown })?.message || provisioning.error);
    if (message.includes('platform_hotel_slug_conflict')) return { error: 'Este slug já está em uso.' };
    if (message.includes('platform_hotel_subdomain_conflict')) return { error: 'Este subdomínio já está em uso.' };
    return { error: 'Não foi possível criar o hotel. O convite foi revertido com segurança.' };
  }

  revalidatePath('/platform');
  revalidatePath('/platform/hoteis');
  redirect(`/platform/hoteis/${provisioning.hotelId}?created=1&success=${encodeURIComponent('Hotel criado em preparação.')}`);
}
