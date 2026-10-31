'use server';
import {updateCommunicationEditorial,readCommunicationVersion,communicationFailureMessage} from '@/lib/communications/editorial';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import {
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  formatTranslationWarning,
  logOperationalError,
  syncPromotionalBannerTranslations,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
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

export async function updatePromotionalBannerAction(id: string, formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');

  if (!isUuid(id)) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');
  const ctaUrlInput = readNullableString(formData, 'cta_url');
  const ctaUrl = readOptionalUrl(formData, 'cta_url');

  if (!title) {
    redirect(`/admin/banners/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (ctaUrlInput && !ctaUrl) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20URL%20v%C3%A1lida%20para%20o%20CTA`);
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20data%20inicial%20v%C3%A1lida`);
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20data%20final%20v%C3%A1lida`);
  }

  if (!validateBannerWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      `/admin/banners/${id}?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial`
    );
  }

  const payload: Database['public']['Tables']['hotel_promotional_banners']['Update'] = {
    title,
    subtitle: readNullableString(formData, 'subtitle'),
    cta_label: readNullableString(formData, 'cta_label'),
    cta_url: ctaUrl,
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
    display_order: Math.max(0, readNumber(formData, 'display_order', 0)),
  };

  let updatedBanner;
  try {
    updatedBanner=await updateCommunicationEditorial(supabase,{kind:'banner',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:payload},recordAdminAuditEvent);
  } catch(error) {
    logOperationalError({module:'banners',action:'update',operation:'conditional editorial update',hotelId:hotel.id,targetId:id,error});
    revalidatePath('/admin/banners');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);
    redirect(buildFeedbackRedirect(`/admin/banners/${id}`,{error:communicationFailureMessage(error)}));
  }

  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: updatedBanner.id,
    expectedParentVersion: updatedBanner.updated_at,
    hotelId: hotel.id,
    fields: {
      title: payload.title || '',
      subtitle: payload.subtitle ?? null,
      cta_label: payload.cta_label ?? null,
    },
  });


  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/banners/${id}`, {
      success: 'Banner promocional atualizado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function removePromotionalBannerImageAction(id: string, formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');

  if (!isUuid(id)) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();

  let banner;
  try {banner=await readCommunicationVersion(supabase,{kind:'banner',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')});}
  catch(error){redirect(buildFeedbackRedirect(`/admin/banners/${id}`,{error:communicationFailureMessage(error)}));}

  const storagePath = extractOwnedHotelAssetPath({
    publicUrl: banner.image_url,
    hotelId: hotel.id,
    category: 'promotional-banners',
  });

  let warning: string | undefined;

  try {await updateCommunicationEditorial(supabase,{kind:'banner',id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:{image_url:null},operation:'image',auditAction:'banner.image_removed'},recordAdminAuditEvent);}
  catch(error){revalidatePath('/admin/banners');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);redirect(buildFeedbackRedirect(`/admin/banners/${id}`,{error:communicationFailureMessage(error)}));}

  if (storagePath) {
    const { error: removeError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([storagePath]);
    if (removeError) {
      warning = 'A imagem foi desvinculada, mas o arquivo antigo precisa de limpeza posterior.';
      logOperationalError({
        module: 'banners',
        action: 'removePromotionalBannerImageAction',
        operation: 'remove promotional banner image from storage',
        hotelId: hotel.id,
        targetId: id,
        error: 'Storage removal failed',
      });
    }
  } else if (banner.image_url) {
    warning = 'A imagem foi desvinculada, mas o arquivo antigo não pôde ser identificado com segurança.';
  }


  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/banners/${id}`, {
      success: 'Imagem do banner removida com sucesso',
      warning,
    })
  );
}
