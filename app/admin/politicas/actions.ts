'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncPolicyTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

export async function createPolicyAction(formData: FormData) {
  await requireAdminAccess('operador');
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
        error: `NÃ£o foi possÃ­vel criar a polÃ­tica: ${error.message}`,
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
      success: 'PolÃ­tica criada com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deletePolicyAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'PolÃ­tica invÃ¡lida para exclusÃ£o.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_policies')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: `NÃ£o foi possÃ­vel excluir a polÃ­tica: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: 'PolÃ­tica excluÃ­da com sucesso',
    })
  );
}

export async function togglePolicyAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'PolÃ­tica invÃ¡lida para atualizaÃ§Ã£o de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_policies')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: `NÃ£o foi possÃ­vel atualizar o status da polÃ­tica: ${error.message}`,
      })
    );
  }

  revalidatePath('/admin/politicas');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/politicas', {
      success: enabled ? 'PolÃ­tica ativada com sucesso' : 'PolÃ­tica desativada com sucesso',
    })
  );
}

export async function retranslatePolicyAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'PolÃ­tica invÃ¡lida para retraduÃ§Ã£o.',
      })
    );
  }

  const { data: policy, error } = await supabase
    .from('hotel_policies')
    .select('id, title, description')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !policy) {
    redirect(
      buildFeedbackRedirect('/admin/politicas', {
        error: 'NÃ£o foi possÃ­vel carregar a polÃ­tica para retraduÃ§Ã£o.',
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
      success: 'RetraduÃ§Ã£o da polÃ­tica concluÃ­da',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

