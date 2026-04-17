'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import type { Database } from '@/types/database';

export async function updateDepartmentAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload: Database['public']['Tables']['hotel_departments']['Update'] = {
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