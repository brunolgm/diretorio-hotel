'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function createDepartmentAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload = {
    hotel_id: hotel.id,
    name: String(formData.get('name') || ''),
    description: String(formData.get('description') || ''),
    hours: String(formData.get('hours') || ''),
    action: String(formData.get('action') || ''),
    url: String(formData.get('url') || ''),
    enabled: formData.get('enabled') === 'on',
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
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('hotel_departments').delete().eq('id', id);

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
  const id = String(formData.get('id') || '');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_departments')
    .update({ enabled })
    .eq('id', id);

  if (error) {
    redirect(`/admin/departamentos?error=${encodeURIComponent(`Não foi possível atualizar o status do departamento: ${error.message}`)}`);
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/departamentos?success=${encodeURIComponent(enabled ? 'Departamento ativado com sucesso' : 'Departamento desativado com sucesso')}`);
}