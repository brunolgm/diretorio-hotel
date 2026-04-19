'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  readCheckboxBoolean,
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  syncSectionTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function updateSectionAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = readNullableString(formData, 'icon');
  const urlInput = readNullableString(formData, 'url');
  const url = readOptionalUrl(formData, 'url');

  if (!title) {
    redirect(`/admin/servicos/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (urlInput && !url) {
    redirect(`/admin/servicos/${id}?error=Informe%20uma%20URL%20v%C3%A1lida`);
  }

  const payload: Database['public']['Tables']['hotel_sections']['Update'] = {
    title,
    icon,
    content: readNullableString(formData, 'content'),
    cta: readNullableString(formData, 'cta'),
    url,
    category: readNullableString(formData, 'category'),
    enabled: readCheckboxBoolean(formData, 'enabled'),
    sort_order: Math.max(0, readNumber(formData, 'sort_order', 0)),
  };

  const { error } = await supabase
    .from('hotel_sections')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect(`/admin/servicos/${id}`, {
        error: `Não foi possível atualizar o serviço: ${error.message}`,
      })
    );
  }

  const translationResult = await syncSectionTranslations({
    supabase,
    sectionId: id,
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
