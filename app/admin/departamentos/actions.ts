'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import {
  readCheckboxBoolean,
  readNullableString,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncDepartmentTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

export async function createDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const name = readTrimmedString(formData, 'name');
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!name) {
    redirect('/admin/departamentos?error=Nome%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (urlInput && !url) {
    redirect('/admin/departamentos?error=Informe%20uma%20URL%20v%C3%A1lida');
  }

  const payload = {
    hotel_id: hotel.id,
    name,
    description: readNullableString(formData, 'description'),
    hours: readNullableString(formData, 'hours'),
    action: readNullableString(formData, 'action'),
    url,
    enabled: readCheckboxBoolean(formData, 'enabled'),
  };

  const { data: department, error } = await supabase
    .from('hotel_departments')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: `NÃ£o foi possÃ­vel criar o departamento: ${error.message}`,
      })
    );
  }

  const translationResult = await syncDepartmentTranslations({
    supabase,
    departmentId: department.id,
    fields: {
      name: payload.name,
      description: payload.description,
      action: payload.action,
    },
  });

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/departamentos', {
      success: 'Departamento criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deleteDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento invÃ¡lido para exclusÃ£o.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_departments')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: `NÃ£o foi possÃ­vel excluir o departamento: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/departamentos', {
      success: 'Departamento excluÃ­do com sucesso',
    })
  );
}

export async function toggleDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento invÃ¡lido para atualizaÃ§Ã£o de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_departments')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: `NÃ£o foi possÃ­vel atualizar o status do departamento: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/departamentos', {
      success: enabled ? 'Departamento ativado com sucesso' : 'Departamento desativado com sucesso',
    })
  );
}

export async function retranslateDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento invÃ¡lido para retraduÃ§Ã£o.',
      })
    );
  }

  const { data: department, error } = await supabase
    .from('hotel_departments')
    .select('id, name, description, action')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !department) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'NÃ£o foi possÃ­vel carregar o departamento para retraduÃ§Ã£o.',
      })
    );
  }

  const translationResult = await syncDepartmentTranslations({
    supabase,
    departmentId: department.id,
    fields: {
      name: department.name,
      description: department.description,
      action: department.action,
    },
  });

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/departamentos', {
      success: 'RetraduÃ§Ã£o do departamento concluÃ­da',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

