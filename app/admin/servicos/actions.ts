'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import {
  readCheckboxBoolean,
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';

export async function createSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = readNullableString(formData, 'icon');
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!title) {
    redirect('/admin/servicos?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (urlInput && !url) {
    redirect('/admin/servicos?error=Informe%20uma%20URL%20v%C3%A1lida');
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    icon,
    content: readNullableString(formData, 'content'),
    cta: readNullableString(formData, 'cta'),
    url,
    category: readNullableString(formData, 'category'),
    enabled: readCheckboxBoolean(formData, 'enabled'),
    sort_order: Math.max(0, readNumber(formData, 'sort_order', 0)),
  };

  const { error } = await supabase.from('hotel_sections').insert(payload);

  if (error) {
    redirect(`/admin/servicos?error=${encodeURIComponent(`Não foi possível criar o serviço: ${error.message}`)}`);
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/servicos?success=Serviço criado com sucesso');
}

export async function deleteSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  const { error } = await supabase
    .from('hotel_sections')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(`/admin/servicos?error=${encodeURIComponent(`Não foi possível excluir o serviço: ${error.message}`)}`);
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/servicos?success=Serviço excluído com sucesso');
}

export async function toggleSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(`/admin/servicos?error=${encodeURIComponent(`Não foi possível atualizar o status do serviço: ${error.message}`)}`);
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/servicos?success=${encodeURIComponent(enabled ? 'Serviço ativado com sucesso' : 'Serviço desativado com sucesso')}`);
}
