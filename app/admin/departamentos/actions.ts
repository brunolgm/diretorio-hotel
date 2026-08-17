'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import {
  readCheckboxBoolean,
  readNullableString,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncDepartmentTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';

export async function createDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.departments');
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
    logOperationalError({
      module: 'departments',
      action: 'createDepartmentAction',
      operation: 'create department',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: buildOperationalErrorMessage(
          'o departamento',
          'criar',
          'Revise os campos e tente novamente.'
        ),
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
  await requireAdminAccess('operador'); await requireHotelModule('content.departments');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento inválido para exclusão.',
      })
    );
  }

  const { data: deletedDepartment, error } = await supabase
    .from('hotel_departments')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !deletedDepartment) {
    logOperationalError({
      module: 'departments',
      action: 'deleteDepartmentAction',
      operation: 'delete department',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: buildOperationalErrorMessage(
          'o departamento',
          'excluir',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/departamentos', {
      success: 'Departamento excluído com sucesso',
    })
  );
}

export async function toggleDepartmentAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.departments');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento inválido para atualização de status.',
      })
    );
  }

  const { data: updatedDepartment, error } = await supabase
    .from('hotel_departments')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedDepartment) {
    logOperationalError({
      module: 'departments',
      action: 'toggleDepartmentAction',
      operation: 'update department status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: buildOperationalErrorMessage(
          'o status do departamento',
          'atualizar',
          'Tente novamente em instantes.'
        ),
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
  await requireAdminAccess('operador'); await requireHotelModule('content.departments');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Departamento inválido para retradução.',
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
    logOperationalError({
      module: 'departments',
      action: 'retranslateDepartmentAction',
      operation: 'load department for retranslation',
      hotelId: hotel.id,
      targetId: id,
      error: error || 'Department not found for retranslation',
    });
    redirect(
      buildFeedbackRedirect('/admin/departamentos', {
        error: 'Não foi possível preparar o departamento para retradução agora.',
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
      success: 'Retradução do departamento concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

