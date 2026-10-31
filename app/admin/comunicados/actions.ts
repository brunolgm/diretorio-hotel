'use server';
import {updateCommunicationEditorial,deleteCommunication,confirmCommunicationAudit,communicationFailureMessage} from '@/lib/communications/editorial';
import {recordAdminAuditEvent} from '@/lib/audit';
import {setCommunicationStatus} from '@/lib/communications/status';


import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
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
import { isUuid } from '@/lib/security/identifiers';

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
  const {user}=await requireAdminAccess('operador'); await requireHotelModule('content.announcements');
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
    .select('id, updated_at')
    .single();

  if (error || !announcement) {
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

  try {await confirmCommunicationAudit(recordAdminAuditEvent,{actorUserId:user.id,hotelId:hotel.id,action:'announcement.created',entityType:'hotel_announcement',entityId:announcement.id,metadata:{is_active:payload.is_active}});}
  catch(error){revalidatePath('/admin/comunicados');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);redirect(buildFeedbackRedirect('/admin/comunicados',{error:communicationFailureMessage(error)}));}
  const translationResult = await syncAnnouncementTranslations({
    supabase,
    announcementId: announcement.id,
    expectedParentVersion:announcement.updated_at,
    hotelId:hotel.id,
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
  await requireAdminAccess('operador'); await requireHotelModule('content.announcements');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para exclusão.',
      })
    );
  }


  try {await deleteCommunication(supabase,{kind:'announcement',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')},recordAdminAuditEvent);}
  catch(error){revalidatePath('/admin/comunicados');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);redirect(buildFeedbackRedirect('/admin/comunicados',{error:communicationFailureMessage(error)}));}

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
  await requireAdminAccess('operador'); await requireHotelModule('content.announcements');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const statusValue=readTrimmedString(formData,'is_active');
  const isActive=statusValue==='true';
  if(!['true','false'].includes(statusValue))redirect(buildFeedbackRedirect('/admin/comunicados',{error:'Status inválido. Recarregue a página.'}));

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para atualização de status.',
      })
    );
  }

  let error: unknown = null;
  let updatedAnnouncement = null;
  try {
    const result = await setCommunicationStatus(supabase,{kind:"announcement",id,isActive,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')},recordAdminAuditEvent);
    updatedAnnouncement = {id:result.id};
  } catch (failure) { error = failure; }

  revalidatePath('/admin/comunicados');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);
  if (error || !updatedAnnouncement) {
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
        error: communicationFailureMessage(error),
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
  await requireAdminAccess('operador'); await requireHotelModule('content.announcements');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/comunicados', {
        error: 'Comunicado inválido para retradução.',
      })
    );
  }

  let announcement;
  try {announcement=await updateCommunicationEditorial(supabase,{kind:'announcement',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:{},operation:'translations'},recordAdminAuditEvent);}
  catch(error){revalidatePath('/admin/comunicados');redirect(buildFeedbackRedirect('/admin/comunicados',{error:communicationFailureMessage(error)}));}

  const translationResult = await syncAnnouncementTranslations({
    supabase,
    announcementId: announcement.id,
    expectedParentVersion:announcement.updated_at,
    hotelId:hotel.id,
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
