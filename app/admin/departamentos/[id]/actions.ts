'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import type { Database } from '@/types/database';
import {
  readCheckboxBoolean,
  readNullableString,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';

export async function updateDepartmentAction(id: string, formData: FormData) {
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
      `/admin/departamentos/${id}?error=${encodeURIComponent(
        `Não foi possível atualizar o departamento: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/admin/departamentos/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    `/admin/departamentos/${id}?success=${encodeURIComponent(
      'Departamento atualizado com sucesso'
    )}`
  );
}
