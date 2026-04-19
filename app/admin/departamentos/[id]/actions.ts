'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
import type { Database } from '@/types/database';

export async function updateDepartmentAction(id: string, formData: FormData) {
  if (!id.trim()) {
    redirect('/admin/departamentos?error=Departamento%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const name = readTrimmedString(formData, 'name');
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!name) {
    redirect(`/admin/departamentos/${id}?error=Nome%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (urlInput && !url) {
    redirect(`/admin/departamentos/${id}?error=Informe%20uma%20URL%20v%C3%A1lida`);
  }

  const payload: Database['public']['Tables']['hotel_departments']['Update'] = {
    name,
    description: readNullableString(formData, 'description'),
    hours: readNullableString(formData, 'hours'),
    action: readNullableString(formData, 'action'),
    url,
    enabled: readCheckboxBoolean(formData, 'enabled'),
  };

  const { error } = await supabase
    .from('hotel_departments')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect(`/admin/departamentos/${id}`, {
        error: `Não foi possível atualizar o departamento: ${error.message}`,
      })
    );
  }

  const translationResult = await syncDepartmentTranslations({
    supabase,
    departmentId: id,
    fields: {
      name: payload.name || '',
      description: payload.description ?? null,
      action: payload.action ?? null,
    },
  });

  revalidatePath('/admin/departamentos');
  revalidatePath(`/admin/departamentos/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/departamentos/${id}`, {
      success: 'Departamento atualizado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
