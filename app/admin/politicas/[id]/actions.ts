'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncPolicyTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

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
      buildFeedbackRedirect(`/admin/politicas/${id}`, {
        error: `Não foi possível atualizar a política: ${error.message}`,
      })
    );
  }

  const translationResult = await syncPolicyTranslations({
    supabase,
    policyId: id,
    fields: {
      title: payload.title || '',
      description: payload.description ?? null,
    },
  });

  revalidatePath('/admin/politicas');
  revalidatePath(`/admin/politicas/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/politicas/${id}`, {
      success: 'Política atualizada com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
