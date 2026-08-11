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
import { normalizeServiceActionType } from '@/lib/service-action-types';
import { normalizeServiceCategory, resolveServiceIconName } from '@/lib/service-options';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncSectionTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';

export async function createSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = resolveServiceIconName(readNullableString(formData, 'icon'));
  const serviceActionType = normalizeServiceActionType(
    readNullableString(formData, 'service_action_type')
  );
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!title) {
    redirect('/admin/servicos?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (urlInput && !url) {
    redirect('/admin/servicos?error=Informe%20uma%20URL%20v%C3%A1lida');
  }

  if (serviceActionType === 'external_url' && !url) {
    redirect('/admin/servicos?error=Informe%20uma%20URL%20fixa%20para%20o%20servi%C3%A7o');
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    icon,
    content: readNullableString(formData, 'content'),
    cta: readNullableString(formData, 'cta'),
    url,
    category: normalizeServiceCategory(readNullableString(formData, 'category')),
    service_action_type: serviceActionType,
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
          'o serviço',
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
      success: 'Serviço criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deleteSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Serviço inválido para exclusão.',
      })
    );
  }

  const { data: deletedSection, error } = await supabase
    .from('hotel_sections')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !deletedSection) {
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
          'o serviço',
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
      success: 'Serviço excluído com sucesso',
    })
  );
}

export async function toggleSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Serviço inválido para atualização de status.',
      })
    );
  }

  const { data: updatedSection, error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedSection) {
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
          'o status do serviço',
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
      success: enabled ? 'Serviço ativado com sucesso' : 'Serviço desativado com sucesso',
    })
  );
}

export async function retranslateSectionAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Serviço inválido para retradução.',
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
        error: 'Não foi possível preparar o serviço para retradução agora.',
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
      success: 'Retradução do serviço concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

