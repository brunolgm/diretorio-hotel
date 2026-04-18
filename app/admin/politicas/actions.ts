'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';

export async function createPolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');

  if (!title) {
    redirect('/admin/politicas?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    description: readNullableString(formData, 'description'),
    enabled: readCheckboxBoolean(formData, 'enabled'),
  };

  const { error } = await supabase.from('hotel_policies').insert(payload);

  if (error) {
    redirect(`/admin/politicas?error=${encodeURIComponent(`Não foi possível criar a política: ${error.message}`)}`);
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/politicas?success=Política criada com sucesso');
}

export async function deletePolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  const { error } = await supabase
    .from('hotel_policies')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(`/admin/politicas?error=${encodeURIComponent(`Não foi possível excluir a política: ${error.message}`)}`);
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/politicas?success=Política excluída com sucesso');
}

export async function togglePolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_policies')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(`/admin/politicas?error=${encodeURIComponent(`Não foi possível atualizar o status da política: ${error.message}`)}`);
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/politicas?success=${encodeURIComponent(enabled ? 'Política ativada com sucesso' : 'Política desativada com sucesso')}`);
}
