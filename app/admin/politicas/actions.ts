'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import { translatePolicyFields } from '@/lib/services/translation-service';
import { createClient } from '@/lib/supabase/server';

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

  const { data: policy, error } = await supabase
    .from('hotel_policies')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    redirect(
      `/admin/politicas?error=${encodeURIComponent(
        `Não foi possível criar a política: ${error.message}`
      )}`
    );
  }

  await syncPolicyTranslations({
    supabase,
    policyId: policy.id,
    fields: {
      title: payload.title,
      description: payload.description,
    },
  });

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/politicas?success=Pol%C3%ADtica%20criada%20com%20sucesso');
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
    redirect(
      `/admin/politicas?error=${encodeURIComponent(
        `Não foi possível excluir a política: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/politicas?success=Pol%C3%ADtica%20exclu%C3%ADda%20com%20sucesso');
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
    redirect(
      `/admin/politicas?error=${encodeURIComponent(
        `Não foi possível atualizar o status da política: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    `/admin/politicas?success=${encodeURIComponent(
      enabled ? 'Política ativada com sucesso' : 'Política desativada com sucesso'
    )}`
  );
}
