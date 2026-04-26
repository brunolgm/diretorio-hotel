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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export async function updateHotelUserAction(id: string, formData: FormData) {
  const { user } = await requireAdminAccess('administrador');
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();

  const fullName = readTrimmedString(formData, 'full_name');
  const email = readTrimmedString(formData, 'email').toLowerCase();
  const password = readTrimmedString(formData, 'password');
  const role = normalizeAppRole(readTrimmedString(formData, 'role'));
  const isActive = readCheckboxBoolean(formData, 'is_active');

  if (!id) {
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
    .select('id, role, is_active, hotel_id')
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

  if (
    (normalizeAppRole(currentProfile.role) === 'administrador' && role !== 'administrador') ||
    !isActive
  ) {
    if (normalizeAppRole(currentProfile.role) === 'administrador') {
      const otherActiveAdministrators = await countOtherActiveAdministrators({
        adminClient,
        hotelId: hotel.id,
        excludeProfileId: currentProfile.id,
      });

      if (otherActiveAdministrators === 0 && (!isActive || role !== 'administrador')) {
        redirect(
          buildFeedbackRedirect(`/admin/usuarios/${id}`, {
            error: 'O hotel precisa manter pelo menos um administrador ativo.',
          })
        );
      }
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

  const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdates);

  if (authError) {
    logOperationalError({
      module: 'users',
      action: 'updateHotelUserAction',
      operation: 'update auth user',
      hotelId: hotel.id,
      targetId: id,
      error: authError,
    });
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, {
        error: buildOperationalErrorMessage(
          'o acesso do usuÃ¡rio',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      role,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (profileError) {
    logOperationalError({
      module: 'users',
      action: 'updateHotelUserAction',
      operation: 'update user profile',
      hotelId: hotel.id,
      targetId: id,
      error: profileError,
    });
    redirect(
      buildFeedbackRedirect(`/admin/usuarios/${id}`, {
        error: buildOperationalErrorMessage(
          'o perfil do usuÃ¡rio',
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

