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
      buildFeedbackRedirect('/admin/politicas', {
        error: `Não foi possível criar a política: ${error.message}`,
      })
    );
  }

  const translationResult = await syncPolicyTranslations({
    supabase,
    policyId: policy.id,
    fields: {
      title: payload.title,
      description: payload.description,
    },
  });

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: 'Política criada com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
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
      buildFeedbackRedirect('/admin/politicas', {
        error: `Não foi possível excluir a política: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: 'Política excluída com sucesso',
    })
  );
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
      buildFeedbackRedirect('/admin/politicas', {
        error: `Não foi possível atualizar o status da política: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: enabled ? 'Política ativada com sucesso' : 'Política desativada com sucesso',
    })
  );
}

export async function retranslatePolicyAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  const { data: policy, error } = await supabase
    .from('hotel_policies')
    .select('id, title, description')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !policy) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'Não foi possível carregar a política para retradução.',
      })
    );
  }

  const translationResult = await syncPolicyTranslations({
    supabase,
    policyId: policy.id,
    fields: {
      title: policy.title,
      description: policy.description,
    },
  });

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: 'Retradução da política concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
