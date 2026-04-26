'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import {
  readCheckboxBoolean,
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import { normalizeServiceCategory, resolveServiceIconName } from '@/lib/service-options';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncSectionTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

export async function createSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = resolveServiceIconName(readNullableString(formData, 'icon'));
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
    category: normalizeServiceCategory(readNullableString(formData, 'category')),
    enabled: readCheckboxBoolean(formData, 'enabled'),
    sort_order: Math.max(0, readNumber(formData, 'sort_order', 0)),
  };

  const { data: section, error } = await supabase
    .from('hotel_sections')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    logOperationalError({
      module: 'services',
      action: 'createSectionAction',
      operation: 'create service',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: buildOperationalErrorMessage(
          'o serviÃ§o',
          'criar',
          'Revise os campos e tente novamente.'
        ),
      })
    );
  }

  const translationResult = await syncSectionTranslations({
    supabase,
    sectionId: section.id,
    fields: {
      title: payload.title,
      content: payload.content,
      cta: payload.cta,
      category: payload.category,
    },
  });

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/servicos', {
      success: 'ServiÃ§o criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deleteSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'ServiÃ§o invÃ¡lido para exclusÃ£o.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_sections')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'services',
      action: 'deleteSectionAction',
      operation: 'delete service',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: buildOperationalErrorMessage(
          'o serviÃ§o',
          'excluir',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/servicos', {
      success: 'ServiÃ§o excluÃ­do com sucesso',
    })
  );
}

export async function toggleSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'ServiÃ§o invÃ¡lido para atualizaÃ§Ã£o de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'services',
      action: 'toggleSectionAction',
      operation: 'update service status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: buildOperationalErrorMessage(
          'o status do serviÃ§o',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/servicos', {
      success: enabled ? 'ServiÃ§o ativado com sucesso' : 'ServiÃ§o desativado com sucesso',
    })
  );
}

export async function retranslateSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'ServiÃ§o invÃ¡lido para retraduÃ§Ã£o.',
      })
    );
  }

  const { data: section, error } = await supabase
    .from('hotel_sections')
    .select('id, title, content, cta, category')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !section) {
    logOperationalError({
      module: 'services',
      action: 'retranslateSectionAction',
      operation: 'load service for retranslation',
      hotelId: hotel.id,
      targetId: id,
      error: error || 'Section not found for retranslation',
    });
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'NÃ£o foi possÃ­vel preparar o serviÃ§o para retraduÃ§Ã£o agora.',
      })
    );
  }

  const translationResult = await syncSectionTranslations({
    supabase,
    sectionId: section.id,
    fields: {
      title: section.title,
      content: section.content,
      cta: section.cta,
      category: section.category,
    },
  });

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/servicos', {
      success: 'RetraduÃ§Ã£o do serviÃ§o concluÃ­da',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

