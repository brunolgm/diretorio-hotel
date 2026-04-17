'use server';

import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function createSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload = {
    hotel_id: hotel.id,
    title: String(formData.get('title') || ''),
    icon: String(formData.get('icon') || 'Globe'),
    content: String(formData.get('content') || ''),
    cta: String(formData.get('cta') || ''),
    url: String(formData.get('url') || ''),
    category: String(formData.get('category') || ''),
    enabled: formData.get('enabled') === 'on',
    sort_order: Number(formData.get('sort_order') || 0),
  };

  const { error } = await supabase.from('hotel_sections').insert(payload);

  if (error) {
    throw new Error('Não foi possível criar a seção.');
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);
}

export async function deleteSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = String(formData.get('id') || '');

  const { error } = await supabase.from('hotel_sections').delete().eq('id', id);

  if (error) {
    throw new Error('Não foi possível excluir a seção.');
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);
}

export async function toggleSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = String(formData.get('id') || '');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id);

  if (error) {
    throw new Error('Não foi possível atualizar o status da seção.');
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);
}