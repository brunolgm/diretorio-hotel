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
import { translateDepartmentFields } from '@/lib/services/translation-service';
import { createClient } from '@/lib/supabase/server';

async function syncDepartmentTranslations({
  supabase,
  departmentId,
  fields,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  departmentId: string;
  fields: {
    name: string;
    description: string | null;
    action: string | null;
  };
}) {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translateDepartmentFields(fields, 'en'),
      translateDepartmentFields(fields, 'es'),
    ]);

    const translations = [
      englishTranslation
        ? {
            department_id: departmentId,
            language: 'en' as const,
            ...englishTranslation,
            updated_at: timestamp,
          }
        : null,
      spanishTranslation
        ? {
            department_id: departmentId,
            language: 'es' as const,
            ...spanishTranslation,
            updated_at: timestamp,
          }
        : null,
    ].filter((translation) => translation !== null);

    if (!translations.length) {
      return;
    }

    const { error } = await supabase
      .from('hotel_department_translations')
      .upsert(translations, { onConflict: 'department_id,language' });

    if (error) {
      console.error('Failed to persist department translations:', error);
    }
  } catch (error) {
    console.error('Failed to sync department translations:', error);
  }
}

export async function createDepartmentAction(formData: FormData) {
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
      `/admin/departamentos?error=${encodeURIComponent(
        `Não foi possível criar o departamento: ${error.message}`
      )}`
    );
  }

  await syncDepartmentTranslations({
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

  redirect('/admin/departamentos?success=Departamento%20criado%20com%20sucesso');
}

export async function deleteDepartmentAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  const { error } = await supabase
    .from('hotel_departments')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      `/admin/departamentos?error=${encodeURIComponent(
        `Não foi possível excluir o departamento: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/departamentos?success=Departamento%20exclu%C3%ADdo%20com%20sucesso');
}

export async function toggleDepartmentAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_departments')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      `/admin/departamentos?error=${encodeURIComponent(
        `Não foi possível atualizar o status do departamento: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    `/admin/departamentos?success=${encodeURIComponent(
      enabled ? 'Departamento ativado com sucesso' : 'Departamento desativado com sucesso'
    )}`
  );
}
