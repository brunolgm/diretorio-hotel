'use server';

import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function createPolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload = {
    hotel_id: hotel.id,
    title: String(formData.get('title') || ''),
    description: String(formData.get('description') || ''),
    enabled: formData.get('enabled') === 'on',
  };

  const { error } = await supabase.from('hotel_policies').insert(payload);

  if (error) {
    throw new Error('Não foi possível criar a política.');
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);
}

export async function deletePolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('hotel_policies').delete().eq('id', id);

  if (error) {
    throw new Error('Não foi possível excluir a política.');
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);
}

export async function togglePolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = String(formData.get('id') || '');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_policies')
    .update({ enabled })
    .eq('id', id);

  if (error) {
    throw new Error('Não foi possível atualizar o status da política.');
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);
}