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
      buildFeedbackRedirect('/admin/servicos', {
        error: `Não foi possível criar o serviço: ${error.message}`,
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
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Serviço inválido para exclusão.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_sections')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: `Não foi possível excluir o serviço: ${error.message}`,
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
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const enabled = String(formData.get('enabled') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Serviço inválido para atualização de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_sections')
    .update({ enabled })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: `Não foi possível atualizar o status do serviço: ${error.message}`,
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
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
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
    redirect(
      buildFeedbackRedirect('/admin/servicos', {
        error: 'Não foi possível carregar o serviço para retradução.',
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
