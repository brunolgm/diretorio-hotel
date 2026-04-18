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

export async function createSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const icon = readNullableString(formData, 'icon');
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
    category: readNullableString(formData, 'category'),
    enabled: readCheckboxBoolean(formData, 'enabled'),
    sort_order: Math.max(0, readNumber(formData, 'sort_order', 0)),
  };

  const { data: section, error } = await supabase
    .from('hotel_sections')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    redirect(
      `/admin/servicos?error=${encodeURIComponent(
        `Não foi possível criar o serviço: ${error.message}`
      )}`
    );
  }

  await syncSectionTranslations({
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

  redirect('/admin/servicos?success=Servi%C3%A7o%20criado%20com%20sucesso');
}

export async function deleteSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  const { error } = await supabase
    .from('hotel_sections')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      `/admin/servicos?error=${encodeURIComponent(
        `Não foi possível excluir o serviço: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/servicos?success=Servi%C3%A7o%20exclu%C3%ADdo%20com%20sucesso');
}

export async function toggleSectionAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  const { error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      `/admin/servicos?error=${encodeURIComponent(
        `Não foi possível atualizar o status do serviço: ${error.message}`
      )}`
    );
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    `/admin/servicos?success=${encodeURIComponent(
      enabled ? 'Serviço ativado com sucesso' : 'Serviço desativado com sucesso'
    )}`
  );
}
