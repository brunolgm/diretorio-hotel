'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';

export async function updateDepartmentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload = {
    name: String(formData.get('name') || ''),
    description: String(formData.get('description') || ''),
    hours: String(formData.get('hours') || ''),
    action: String(formData.get('action') || ''),
    url: String(formData.get('url') || ''),
    enabled: formData.get('enabled') === 'on',
  };

  const { error } = await supabase
    .from('hotel_departments')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    console.error('Erro ao atualizar departamento:', error);
    throw new Error(`Não foi possível atualizar o departamento: ${error.message}`);
  }

  revalidatePath('/admin/departamentos');
  revalidatePath(`/admin/departamentos/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);
}