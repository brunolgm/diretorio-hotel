'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import {
  readCheckboxBoolean,
  readNullableString,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';

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

  const { error } = await supabase.from('hotel_departments').insert(payload);

  if (error) {
    redirect(`/admin/departamentos?error=${encodeURIComponent(`Não foi possível criar o departamento: ${error.message}`)}`);
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/departamentos?success=Departamento criado com sucesso');
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
    redirect(`/admin/departamentos?error=${encodeURIComponent(`Não foi possível excluir o departamento: ${error.message}`)}`);
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/departamentos?success=Departamento excluído com sucesso');
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
    redirect(`/admin/departamentos?error=${encodeURIComponent(`Não foi possível atualizar o status do departamento: ${error.message}`)}`);
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/departamentos?success=${encodeURIComponent(enabled ? 'Departamento ativado com sucesso' : 'Departamento desativado com sucesso')}`);
}
