'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRoleLabel, normalizeAppRole, requireAdminAccess } from '@/lib/auth';
import { readCheckboxBoolean, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionAuthUserWithProfile } from '@/lib/security/user-consistency';
import { isUuid } from '@/lib/security/identifiers';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRole(value: string) {
  return normalizeAppRole(value);
}

async function countOtherActiveAdministrators({
  adminClient,
  hotelId,
  excludeProfileId,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  hotelId: string;
  excludeProfileId: string;
}) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('hotel_id', hotelId)
    .eq('is_active', true);

  if (error) {
    throw new Error('Não foi possível validar os administradores ativos do hotel.');
  }

  return (data || []).filter((profile) => {
    const role = normalizeAppRole(profile.role);
    return profile.id !== excludeProfileId && role === 'administrador';
  }).length;
}

export async function createHotelUserAction(formData: FormData) {
  await requireAdminAccess('administrador');
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();

  const fullName = readTrimmedString(formData, 'full_name');
  const email = readTrimmedString(formData, 'email').toLowerCase();
  const password = readTrimmedString(formData, 'password');
  const role = validateRole(readTrimmedString(formData, 'role'));
  const isActive = readCheckboxBoolean(formData, 'is_active');

  if (!fullName) {
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Nome é obrigatório.' }));
  }

  if (!isValidEmail(email)) {
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Informe um e-mail válido.' }));
  }

  if (password.length < 6) {
    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error: 'A senha inicial deve ter pelo menos 6 caracteres.',
      })
    );
  }

  if (!role) {
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Selecione um papel válido.' }));
  }

  const provisioning = await provisionAuthUserWithProfile({
    createAuthUser: async () => {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      return error || !data.user
        ? { ok: false as const, error: error || 'Auth user was not returned' }
        : { ok: true as const, value: { userId: data.user.id } };
    },
    createProfile: async (userId) => {
      const { error } = await adminClient.from('profiles').upsert(
        { id: userId, email, full_name: fullName, role, hotel_id: hotel.id, is_active: isActive },
        { onConflict: 'id' }
      );
      return error ? { ok: false as const, error } : { ok: true as const, value: undefined };
    },
    deleteAuthUser: async (userId) => {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      return error ? { ok: false as const, error } : { ok: true as const, value: undefined };
    },
  });

  if (!provisioning.ok && provisioning.stage === 'auth') {
    logOperationalError({
      module: 'users',
      action: 'createHotelUserAction',
      operation: 'create auth user',
      hotelId: hotel.id,
      error: provisioning.error,
    });
    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error: buildOperationalErrorMessage(
          'o usuário',
          'criar',
          'Revise os dados informados e tente novamente.'
        ),
      })
    );
  }

  if (!provisioning.ok && provisioning.stage === 'profile') {
    logOperationalError({
      module: 'users',
      action: 'createHotelUserAction',
      operation: 'persist user profile',
      hotelId: hotel.id,
      targetId: provisioning.userId,
      error: provisioning.error,
    });
    if (!provisioning.compensated) {
      logOperationalError({
        module: 'users',
        action: 'createHotelUserAction',
        operation: 'rollback auth user after profile failure',
        hotelId: hotel.id,
        targetId: provisioning.userId,
        error: provisioning.compensationError || 'Auth rollback failed',
      });
    }

    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error:
          'O acesso foi iniciado, mas não foi possível concluir o perfil do usuário. Tente novamente.',
      })
    );
  }

  revalidatePath('/admin/usuarios');

  redirect(
    buildFeedbackRedirect('/admin/usuarios', {
      success: `Usuário ${fullName} criado com papel ${getRoleLabel(role)}.`,
    })
  );
}

export async function toggleHotelUserStatusAction(formData: FormData) {
  const { user } = await requireAdminAccess('administrador');
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();

  const id = readTrimmedString(formData, 'id');
  const nextStatus = String(formData.get('is_active') || '') === 'true';

  if (!isUuid(id)) {
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Usuário inválido.' }));
  }

  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, is_active, hotel_id')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !profile) {
    logOperationalError({
      module: 'users',
      action: 'toggleHotelUserStatusAction',
      operation: 'load user for status update',
      hotelId: hotel.id,
      targetId: id,
      error: error || 'User profile not found for status update',
    });
    redirect(buildFeedbackRedirect('/admin/usuarios', { error: 'Usuário não encontrado.' }));
  }

  if (profile.id === user.id && !nextStatus) {
    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error: 'Você não pode desativar o próprio acesso.',
      })
    );
  }

  if (!nextStatus && normalizeAppRole(profile.role) === 'administrador') {
    const otherActiveAdministrators = await countOtherActiveAdministrators({
      adminClient,
      hotelId: hotel.id,
      excludeProfileId: profile.id,
    });

    if (otherActiveAdministrators === 0) {
      redirect(
        buildFeedbackRedirect('/admin/usuarios', {
          error: 'O hotel precisa manter pelo menos um administrador ativo.',
        })
      );
    }
  }

  const { data: updatedProfile, error: updateError } = await adminClient
    .from('profiles')
    .update({ is_active: nextStatus })
    .eq('id', profile.id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updatedProfile) {
    logOperationalError({
      module: 'users',
      action: 'toggleHotelUserStatusAction',
      operation: 'update user active status',
      hotelId: hotel.id,
      targetId: profile.id,
      error: updateError,
    });
    redirect(
      buildFeedbackRedirect('/admin/usuarios', {
        error: buildOperationalErrorMessage(
          'o status do usuário',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${profile.id}`);

  redirect(
    buildFeedbackRedirect('/admin/usuarios', {
      success: nextStatus
        ? `Usuário ${profile.full_name || profile.email || 'selecionado'} ativado com sucesso.`
        : `Usuário ${profile.full_name || profile.email || 'selecionado'} desativado com sucesso.`,
    })
  );
}

