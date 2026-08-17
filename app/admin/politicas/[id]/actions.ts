'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncPolicyTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import type { Database } from '@/types/database';

export async function updatePolicyAction(id: string, formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.policies');
  if (!isUuid(id)) {
    redirect('/admin/politicas?error=Pol%C3%ADtica%20inv%C3%A1lida');
  }

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

  const { data: updatedPolicy, error } = await supabase
    .from('hotel_policies')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedPolicy) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'Pol\u00edtica n\u00e3o encontrada ou indispon\u00edvel para este hotel.',
      })
    );
  }

  const translationResult = await syncPolicyTranslations({
    supabase,
    policyId: updatedPolicy.id,
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

