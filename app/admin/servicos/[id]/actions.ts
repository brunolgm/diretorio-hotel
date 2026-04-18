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
import { translateSectionFields } from '@/lib/services/translation-service';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

async function syncSectionTranslations({
  supabase,
  sectionId,
  fields,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sectionId: string;
  fields: {
    title: string;
    content: string | null;
    cta: string | null;
    category: string | null;
  };
}) {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translateSectionFields(fields, 'en'),
      translateSectionFields(fields, 'es'),
    ]);

    const translations = [
      englishTranslation
        ? {
            section_id: sectionId,
            language: 'en' as const,
            ...englishTranslation,
            updated_at: timestamp,
          }
        : null,
      spanishTranslation
        ? {
            section_id: sectionId,
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
      .from('hotel_section_translations')
      .upsert(translations, { onConflict: 'section_id,language' });

    if (error) {
      console.error('Failed to persist section translations:', error);
    }
  } catch (error) {
    console.error('Failed to sync section translations:', error);
  }
}

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
      `/admin/servicos/${id}?error=${encodeURIComponent(
        `Não foi possível atualizar o serviço: ${error.message}`
      )}`
    );
  }

  await syncSectionTranslations({
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

  redirect(`/admin/servicos/${id}?success=${encodeURIComponent('Serviço atualizado com sucesso')}`);
}
