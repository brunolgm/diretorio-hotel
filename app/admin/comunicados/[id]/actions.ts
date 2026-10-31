'use server';
import {updateCommunicationEditorial,communicationFailureMessage} from '@/lib/communications/editorial';
import {recordAdminAuditEvent} from '@/lib/audit';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { readNullableString, readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  logOperationalError,
  syncAnnouncementTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import type { Database } from '@/types/database';

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

export async function updateAnnouncementAction(id: string, formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.announcements');

  if (!isUuid(id)) {
    redirect('/admin/comunicados?error=Comunicado%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');

  if (!title) {
    redirect(`/admin/comunicados/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect(`/admin/comunicados/${id}?error=Informe%20uma%20data%20inicial%20v%C3%A1lida`);
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect(`/admin/comunicados/${id}?error=Informe%20uma%20data%20final%20v%C3%A1lida`);
  }

  if (!validateAnnouncementWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      `/admin/comunicados/${id}?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial`
    );
  }

  const payload: Database['public']['Tables']['hotel_announcements']['Update'] = {
    title,
    body: readNullableString(formData, 'body'),
    category: readTrimmedString(formData, 'category') || 'informativo',
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
  };

  let updatedAnnouncement;
  try {
    updatedAnnouncement=await updateCommunicationEditorial(supabase,{kind:'announcement',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:payload},recordAdminAuditEvent);
  } catch(error) {
    logOperationalError({module:'announcements',action:'update',operation:'conditional editorial update',hotelId:hotel.id,targetId:id,error});
    revalidatePath('/admin/comunicados');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);
    redirect(buildFeedbackRedirect(`/admin/comunicados/${id}`,{error:communicationFailureMessage(error)}));
  }

  const translationResult = await syncAnnouncementTranslations({
    supabase,
    announcementId: updatedAnnouncement.id,
    expectedParentVersion: updatedAnnouncement.updated_at,
    hotelId: hotel.id,
    fields: {
      title: payload.title || '',
      body: payload.body ?? null,
    },
  });

  revalidatePath('/admin/comunicados');
  revalidatePath(`/admin/comunicados/${id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/comunicados/${id}`, {
      success: 'Comunicado atualizado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
