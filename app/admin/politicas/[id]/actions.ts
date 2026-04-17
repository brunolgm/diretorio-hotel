'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';

export async function updatePolicyAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload = {
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
    console.error('Erro ao atualizar política:', error);
    throw new Error(`Não foi possível atualizar a política: ${error.message}`);
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/admin/politicas/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);
}