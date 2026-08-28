'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import {
  readCheckboxBoolean,
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import { normalizeServiceActionType } from '@/lib/service-action-types';
import { parseServiceOperationalKey } from '@/lib/service-operational';
import { normalizeServiceCategory, resolveServiceIconName } from '@/lib/service-options';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncSectionTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import type { Database } from '@/types/database';

export async function updateSectionAction(id: string, formData: FormData) {
  const { profile } = await requireAdminAccess('operador'); await requireHotelModule('content.services');
  if (!isUuid(id)) {
    redirect('/admin/servicos?error=Servi%C3%A7o%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = resolveServiceIconName(readNullableString(formData, 'icon'));
  const serviceActionType = normalizeServiceActionType(
    readNullableString(formData, 'service_action_type')
  );
  const canManageOperationalKey = hasMinimumRole(profile.normalizedRole, 'editor');
  let operationalKey;
  try {
    operationalKey = parseServiceOperationalKey(
      readNullableString(formData, 'operational_key')
    );
  } catch {
    redirect(`/admin/servicos/${id}?error=Fun%C3%A7%C3%A3o%20operacional%20inv%C3%A1lida`);
  }

  if (formData.has('operational_key') && !canManageOperationalKey) {
    redirect(`/admin/servicos/${id}?error=Acesso%20insuficiente%20para%20alterar%20a%20fun%C3%A7%C3%A3o%20operacional`);
  }
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!title) {
    redirect(`/admin/servicos/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (urlInput && !url) {
    redirect(`/admin/servicos/${id}?error=Informe%20uma%20URL%20v%C3%A1lida`);
  }

  if (serviceActionType === 'external_url' && !url) {
    redirect(`/admin/servicos/${id}?error=Informe%20uma%20URL%20fixa%20para%20o%20servi%C3%A7o`);
  }

  const payload: Database['public']['Tables']['hotel_sections']['Update'] = {
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

  if (canManageOperationalKey) {
    payload.operational_key = operationalKey;
  }

  const { data: updatedSection, error } = await supabase
    .from('hotel_sections')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedSection) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Servi\u00e7o n\u00e3o encontrado ou indispon\u00edvel para este hotel.',
      })
    );
  }

  const translationResult = await syncSectionTranslations({
    supabase,
    sectionId: updatedSection.id,
    fields: {
      title: payload.title || '',
      content: payload.content ?? null,
      cta: payload.cta ?? null,
      category: payload.category ?? null,
    },
  });

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${id}`);
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/servicos/${id}`, {
      success: 'Serviço atualizado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

