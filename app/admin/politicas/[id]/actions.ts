'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import type { Database } from '@/types/database';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';

export async function updatePolicyAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');

  if (!title) {
    redirect(`/admin/politicas/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  const payload: Database['public']['Tables']['hotel_policies']['Update'] = {
    title,
    description: readNullableString(formData, 'description'),
    enabled: readCheckboxBoolean(formData, 'enabled'),
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
