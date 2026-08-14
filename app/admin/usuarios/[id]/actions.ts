'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  getRoleLabel,
  normalizeAppRole,
  requireAdminAccess,
} from '@/lib/auth';
import { readCheckboxBoolean, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateProfileThenAuth } from '@/lib/security/user-consistency';
import { isUuid } from '@/lib/security/identifiers';
import { createClient } from '@/lib/supabase/server';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function updateHotelUserAction(id: string, formData: FormData) {
  const { user } = await requireAdminAccess('administrador');
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();
  const supabase = await createClient();

  const fullName = readTrimmedString(formData, 'full_name');
  const email = readTrimmedString(formData, 'email').toLowerCase();
  const password = readTrimmedString(formData, 'password');
  const role = normalizeAppRole(readTrimmedString(formData, 'role'));
  const isActive = readCheckboxBoolean(formData, 'is_active');

  if (!isUuid(id)) {
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Usuário inválido.' }));
  }

  if (!fullName) {
    redirect(buildFeedbackRedirect(`/admin/usuarios/${id}`, { error: 'Nome é obrigatório.' }));
  }

  if (!isValidEmail(email)) {
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, { error: 'Informe um e-mail válido.' })
    );
  }

  if (password && password.length < 6) {
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, {
        error: 'A nova senha deve ter pelo menos 6 caracteres.',
      })
    );
  }

  if (!role) {
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, {
        error: 'Selecione um papel válido.',
      })
    );
  }

  const { data: currentProfile, error: currentProfileError } = await adminClient
    .from('profiles')
    .select('id, email, full_name, role, is_active, hotel_id')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (currentProfileError || !currentProfile) {
    logOperationalError({
      module: 'users',
      action: 'updateHotelUserAction',
      operation: 'load user for edit',
      hotelId: hotel.id,
      targetId: id,
      error: currentProfileError || 'User profile not found for edit',
    });
    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error: 'Usuário não encontrado para edição.',
      })
    );
  }

  if (currentProfile.id === user.id) {
    if (!isActive) {
      redirect(
        buildFeedbackRedirect(`/admin/usuarios/${id}`, {
          error: 'Você não pode desativar o próprio acesso.',
        })
      );
    }

    if (role !== 'administrador') {
      redirect(
        buildFeedbackRedirect(`/admin/usuarios/${id}`, {
          error: 'Você não pode remover seu próprio papel de administrador.',
        })
      );
    }
  }

  const authUpdates: {
    email?: string;
    password?: string;
    user_metadata?: { full_name: string };
  } = {
    email,
    user_metadata: {
      full_name: fullName,
    },
  };

  if (password) {
    authUpdates.password = password;
  }

  const coordinatedUpdate = await updateProfileThenAuth({
    updateProfile: async () => {
      const { data, error } = await supabase.rpc('admin_update_hotel_user', {
        p_target_user_id: id,
        p_full_name: fullName,
        p_email: email,
        p_role: role,
        p_is_active: isActive,
      });
      return error || !data?.[0]
        ? { ok: false as const, error: error || 'Profile was not updated' }
        : { ok: true as const, value: undefined };
    },
    updateAuth: async () => {
      const { error } = await adminClient.auth.admin.updateUserById(id, authUpdates);
      return error ? { ok: false as const, error } : { ok: true as const, value: undefined };
    },
    restoreProfile: async () => {
      const previousRole = normalizeAppRole(currentProfile.role);
      if (!previousRole || !currentProfile.full_name || !currentProfile.email) {
        return { ok: false as const, error: 'Previous profile is invalid' };
      }
      const { data, error } = await supabase.rpc('admin_update_hotel_user', {
        p_target_user_id: id,
        p_full_name: currentProfile.full_name,
        p_email: currentProfile.email,
        p_role: previousRole,
        p_is_active: currentProfile.is_active,
      });
      return error || !data?.[0]
        ? { ok: false as const, error: error || 'Profile rollback failed' }
        : { ok: true as const, value: undefined };
    },
  });

  if (!coordinatedUpdate.ok) {
    logOperationalError({
      module: 'users',
      action: 'updateHotelUserAction',
      operation: coordinatedUpdate.stage === 'profile' ? 'update user profile' : 'update auth user',
      hotelId: hotel.id,
      targetId: id,
      error: coordinatedUpdate.error,
    });
    if (coordinatedUpdate.stage === 'auth' && !coordinatedUpdate.compensated) {
      logOperationalError({
        module: 'users',
        action: 'updateHotelUserAction',
        operation: 'rollback profile after auth failure',
        hotelId: hotel.id,
        targetId: id,
        error: coordinatedUpdate.compensationError || 'Profile rollback failed',
      });
    }
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, {
        error: buildOperationalErrorMessage(
          'o acesso do usuário',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${id}`);

  redirect(
    buildFeedbackRedirect(`/admin/usuarios/${id}`, {
      success: `Usuário atualizado com papel ${getRoleLabel(role)}.`,
    })
  );
}

