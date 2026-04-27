'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { readCheckboxBoolean, readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncAnnouncementTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

function readOptionalDateTimeIso(formData: FormData, key: string) {
  const rawValue = readNullableString(formData, key);

  if (!rawValue) {
    return { rawValue: null, isoValue: null };
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return { rawValue, isoValue: null };
  }

  return { rawValue, isoValue: parsed.toISOString() };
}

function validateAnnouncementWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  if (!startsAt || !endsAt) {
    return true;
  }

  return new Date(endsAt).getTime() >= new Date(startsAt).getTime();
}

export async function createAnnouncementAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const body = readNullableString(formData, 'body');
  const category = readTrimmedString(formData, 'category') || 'informativo';
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');

  if (!title) {
    redirect('/admin/comunicados?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect('/admin/comunicados?error=Informe%20uma%20data%20inicial%20v%C3%A1lida');
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect('/admin/comunicados?error=Informe%20uma%20data%20final%20v%C3%A1lida');
  }

  if (!validateAnnouncementWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      '/admin/comunicados?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial'
    );
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    body,
    category,
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
    is_active: readCheckboxBoolean(formData, 'is_active'),
  };

  const { data: announcement, error } = await supabase
    .from('hotel_announcements')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    logOperationalError({
      module: 'announcements',
      action: 'createAnnouncementAction',
      operation: 'create announcement',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: buildOperationalErrorMessage(
          'o comunicado',
          'criar',
          'Revise os campos e tente novamente.'
        ),
      })
    );
  }

  const translationResult = await syncAnnouncementTranslations({
    supabase,
    announcementId: announcement.id,
    fields: {
      title: payload.title,
      body: payload.body,
    },
  });

  revalidatePath('/admin/comunicados');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/comunicados', {
      success: 'Comunicado criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para exclusão.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_announcements')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'announcements',
      action: 'deleteAnnouncementAction',
      operation: 'delete announcement',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: buildOperationalErrorMessage(
          'o comunicado',
          'excluir',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/comunicados');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/comunicados', {
      success: 'Comunicado excluído com sucesso',
    })
  );
}

export async function toggleAnnouncementAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const isActive = String(formData.get('is_active') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para atualização de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_announcements')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'announcements',
      action: 'toggleAnnouncementAction',
      operation: 'update announcement status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: buildOperationalErrorMessage(
          'o status do comunicado',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/comunicados');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/comunicados', {
      success: isActive
        ? 'Comunicado ativado com sucesso'
        : 'Comunicado desativado com sucesso',
    })
  );
}

export async function retranslateAnnouncementAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para retradução.',
      })
    );
  }

  const { data: announcement, error } = await supabase
    .from('hotel_announcements')
    .select('id, title, body')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !announcement) {
    logOperationalError({
      module: 'announcements',
      action: 'retranslateAnnouncementAction',
      operation: 'load announcement for retranslation',
      hotelId: hotel.id,
      targetId: id,
      error: error || 'Announcement not found for retranslation',
    });
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Não foi possível preparar o comunicado para retradução agora.',
      })
    );
  }

  const translationResult = await syncAnnouncementTranslations({
    supabase,
    announcementId: announcement.id,
    fields: {
      title: announcement.title,
      body: announcement.body,
    },
  });

  revalidatePath('/admin/comunicados');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/comunicados', {
      success: 'Retradução do comunicado concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
