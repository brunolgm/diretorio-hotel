'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import { translatePolicyFields } from '@/lib/services/translation-service';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

async function syncPolicyTranslations({
  supabase,
  policyId,
  fields,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  policyId: string;
  fields: {
    title: string;
    description: string | null;
  };
}) {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translatePolicyFields(fields, 'en'),
      translatePolicyFields(fields, 'es'),
    ]);

    const translations = [
      englishTranslation
        ? {
            policy_id: policyId,
            language: 'en' as const,
            ...englishTranslation,
            updated_at: timestamp,
          }
        : null,
      spanishTranslation
        ? {
            policy_id: policyId,
            language: 'es' as const,
            ...spanishTranslation,
            updated_at: timestamp,
          }
        : null,
    ].filter((translation) => translation !== null);

    if (!translations.length) {
      return;
    }

    const { error } = await supabase
      .from('hotel_policy_translations')
      .upsert(translations, { onConflict: 'policy_id,language' });

    if (error) {
      console.error('Failed to persist policy translations:', error);
    }
  } catch (error) {
    console.error('Failed to sync policy translations:', error);
  }
}

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

  await syncPolicyTranslations({
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
    `/admin/politicas/${id}?success=${encodeURIComponent('Política atualizada com sucesso')}`
  );
}
