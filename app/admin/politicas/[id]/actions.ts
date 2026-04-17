'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import type { Database } from '@/types/database';

export async function updatePolicyAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload: Database['public']['Tables']['hotel_policies']['Update'] = {
    title: String(formData.get('title') || ''),
    description: String(formData.get('description') || ''),
    enabled: formData.get('enabled') === 'on',
  };

  const { error } = await supabase
    .from('hotel_policies')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      `/admin/politicas/${id}?error=${encodeURIComponent(
        `Não foi possível atualizar a política: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/admin/politicas/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    `/admin/politicas/${id}?success=${encodeURIComponent('Política atualizada com sucesso')}`
  );
}