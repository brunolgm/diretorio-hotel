'use server';
import {updateCommunicationEditorial,deleteCommunication,confirmCommunicationAudit,communicationFailureMessage} from '@/lib/communications/editorial';
import {setCommunicationStatus} from '@/lib/communications/status';


import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
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
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncPromotionalBannerTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractOwnedHotelAssetPath } from '@/lib/security/image-upload';
import { isUuid } from '@/lib/security/identifiers';
import { recordAdminAuditEvent } from '@/lib/audit';

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

function validateBannerWindow({
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

export async function createPromotionalBannerAction(formData: FormData) {
  const { user } = await requireAdminAccess('operador'); await requireHotelModule('content.banners');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');
  const ctaUrlInput = readNullableString(formData, 'cta_url');
  const ctaUrl = readOptionalUrl(formData, 'cta_url');

  if (!title) {
    redirect('/admin/banners?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (ctaUrlInput && !ctaUrl) {
    redirect('/admin/banners?error=Informe%20uma%20URL%20v%C3%A1lida%20para%20o%20CTA');
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect('/admin/banners?error=Informe%20uma%20data%20inicial%20v%C3%A1lida');
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect('/admin/banners?error=Informe%20uma%20data%20final%20v%C3%A1lida');
  }

  if (!validateBannerWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      '/admin/banners?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial'
    );
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    subtitle: readNullableString(formData, 'subtitle'),
    image_url: null,
    cta_label: readNullableString(formData, 'cta_label'),
    cta_url: ctaUrl,
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
    is_active: readCheckboxBoolean(formData, 'is_active'),
    display_order: Math.max(0, readNumber(formData, 'display_order', 0)),
  };

  const { data: banner, error } = await supabase
    .from('hotel_promotional_banners')
    .insert(payload)
    .select('id, updated_at')
    .single();

  if (error || !banner) {
    logOperationalError({
      module: 'banners',
      action: 'createPromotionalBannerAction',
      operation: 'create promotional banner',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: buildOperationalErrorMessage(
          'o banner promocional',
          'criar',
          'Revise os campos e tente novamente.'
        ),
      })
    );
  }

  try {await confirmCommunicationAudit(recordAdminAuditEvent,{actorUserId:user.id,hotelId:hotel.id,action:'banner.created',entityType:'hotel_promotional_banner',entityId:banner.id,metadata:{is_active:payload.is_active}});}
  catch(error){revalidatePath('/admin/banners');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);redirect(buildFeedbackRedirect('/admin/banners',{error:communicationFailureMessage(error)}));}
  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: banner.id,
    expectedParentVersion:banner.updated_at,
    hotelId:hotel.id,
    fields: {
      title: payload.title,
      subtitle: payload.subtitle,
      cta_label: payload.cta_label,
    },
  });


  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Banner promocional criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deletePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para exclusão.',
      })
    );
  }

  let deletedBanner;
  try {deletedBanner=await deleteCommunication(supabase,{kind:'banner',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')},recordAdminAuditEvent);}
  catch(error){revalidatePath('/admin/banners');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);redirect(buildFeedbackRedirect('/admin/banners',{error:communicationFailureMessage(error)}));}

  const storagePath = extractOwnedHotelAssetPath({
    publicUrl: deletedBanner.image_url,
    hotelId: hotel.id,
    category: 'promotional-banners',
  });
  if (storagePath) {
    const { error: cleanupError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([storagePath]);
    if (cleanupError) {
      logOperationalError({
        module: 'banners',
        action: 'deletePromotionalBannerAction',
        operation: 'clean deleted banner image',
        hotelId: hotel.id,
        targetId: id,
        error: 'Deleted banner image cleanup failed',
      });
    }
  }


  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Banner promocional excluído com sucesso',
    })
  );
}

export async function togglePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const statusValue=readTrimmedString(formData,'is_active');
  const isActive=statusValue==='true';
  if(!['true','false'].includes(statusValue))redirect(buildFeedbackRedirect('/admin/banners',{error:'Status inválido. Recarregue a página.'}));

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para atualização de status.',
      })
    );
  }

  let error: unknown = null;
  let updatedBanner = null;
  try {
    const result = await setCommunicationStatus(supabase,{kind:"banner",id,isActive,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')},recordAdminAuditEvent);
    updatedBanner = {id:result.id};
  } catch (failure) { error = failure; }

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);
  if (error || !updatedBanner) {
    logOperationalError({
      module: 'banners',
      action: 'togglePromotionalBannerAction',
      operation: 'update promotional banner status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: communicationFailureMessage(error),
      })
    );
  }

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: isActive
        ? 'Banner promocional ativado com sucesso'
        : 'Banner promocional desativado com sucesso',
    })
  );
}

export async function retranslatePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!isUuid(id)) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para retradução.',
      })
    );
  }

  let banner;
  try {banner=await updateCommunicationEditorial(supabase,{kind:'banner',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:{},operation:'translations'},recordAdminAuditEvent);}
  catch(error){revalidatePath('/admin/banners');redirect(buildFeedbackRedirect('/admin/banners',{error:communicationFailureMessage(error)}));}

  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: banner.id,
    expectedParentVersion:banner.updated_at,
    hotelId:hotel.id,
    fields: {
      title: banner.title,
      subtitle: banner.subtitle,
      cta_label: banner.cta_label,
    },
  });

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Retradução do banner concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
