'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import type { Database } from '@/types/database';

export async function updateSectionAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload: Database['public']['Tables']['hotel_sections']['Update'] = {
    title: String(formData.get('title') || ''),
    icon: String(formData.get('icon') || 'Globe'),
    content: String(formData.get('content') || ''),
    cta: String(formData.get('cta') || ''),
    url: String(formData.get('url') || ''),
    category: String(formData.get('category') || ''),
    enabled: formData.get('enabled') === 'on',
    sort_order: Number(formData.get('sort_order') || 0),
  };

  const { error } = await supabase
    .from('hotel_sections')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    throw new Error(`Não foi possível atualizar o serviço: ${error.message}`);
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);
}