'use server';

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
    throw new Error('Não foi possível criar o departamento.');
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);
}

export async function deleteDepartmentAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('hotel_departments').delete().eq('id', id);

  if (error) {
    throw new Error('Não foi possível excluir o departamento.');
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);
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
    throw new Error('Não foi possível atualizar o status do departamento.');
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/hotel/${hotel.slug}`);
}