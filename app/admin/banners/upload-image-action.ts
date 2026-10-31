'use server';
import {updateCommunicationEditorial,readCommunicationVersion,communicationFailureMessage} from '@/lib/communications/editorial';
import {CommunicationStatusError} from '@/lib/communications/access';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildHotelAssetStoragePath,
  extractOwnedHotelAssetPath,
  IMAGE_UPLOAD_POLICIES,
  validateImageUpload,
} from '@/lib/security/image-upload';
import {
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import { recordAdminAuditEvent } from '@/lib/audit';

export async function uploadPromotionalBannerImageAction(formData: FormData) {
  await requireAdminAccess('operador'); await requireHotelModule('content.banners');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();
  const bannerId = readTrimmedString(formData, 'banner_id');
  const fileEntry = formData.get('image');

  if (!isUuid(bannerId)) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido%20para%20upload');
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect(`/admin/banners/${bannerId}?error=Selecione%20uma%20imagem%20antes%20de%20enviar`);
  }

  let banner;
  try {banner=await readCommunicationVersion(supabase,{kind:'banner',id:bannerId,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at')});}
  catch(error){redirect(`/admin/banners/${bannerId}?error=${encodeURIComponent(communicationFailureMessage(error))}`);}

  const validation = await validateImageUpload(fileEntry, IMAGE_UPLOAD_POLICIES.banner);
  if (!validation.ok) {
    const message = validation.reason === 'too_large'
      ? 'O banner deve ter no máximo 2MB'
      : validation.reason === 'dimensions'
        ? 'A imagem do banner possui dimensões excessivas'
        : 'Envie uma imagem PNG, JPEG ou WebP válida';
    redirect(`/admin/banners/${bannerId}?error=${encodeURIComponent(message)}`);
  }

  const path = buildHotelAssetStoragePath({
    hotelId: hotel.id,
    category: 'promotional-banners',
    resourceId: banner.id,
    extension: validation.value.extension,
  });
  const previousPath = extractOwnedHotelAssetPath({
    publicUrl: banner.image_url,
    hotelId: hotel.id,
    category: 'promotional-banners',
  });

  const { error: uploadError } = await adminSupabase.storage.from('hotel-assets').upload(path, validation.value.bytes, {
    upsert: false,
    contentType: validation.value.mimeType,
  });

  if (uploadError) {
    logOperationalError({
      module: 'banners',
      action: 'uploadPromotionalBannerImageAction',
      operation: 'upload promotional banner image to storage',
      hotelId: hotel.id,
      targetId: banner.id,
      error: 'Storage upload failed',
    });
    redirect(
      `/admin/banners/${bannerId}?error=${encodeURIComponent(
        buildOperationalErrorMessage(
          'a imagem do banner',
          'enviar',
          'Verifique o arquivo e tente novamente.'
        )
      )}`
    );
  }

  const { data } = supabase.storage.from('hotel-assets').getPublicUrl(path);

  try {
    await updateCommunicationEditorial(supabase,{kind:'banner',id:banner.id,hotelId:hotel.id,expectedUpdatedAt:readTrimmedString(formData,'expected_updated_at'),changes:{image_url:data.publicUrl},operation:'image',auditAction:'banner.image_uploaded'},recordAdminAuditEvent);
  } catch(error) {
    // Audit failure means the URL is already persisted: never delete the linked asset.
    // Ambiguous network/database responses may also have committed; retain the asset for reconciliation.
    if(error instanceof CommunicationStatusError&&['PT409','record_unavailable','authorization_required','module_required','version_required'].includes(error.code)){
      const cleanup=await adminSupabase.storage.from('hotel-assets').remove([path]);
      if(cleanup.error)logOperationalError({module:'banners',action:'uploadPromotionalBannerImageAction',operation:'clean unlinked upload after confirmed rejection',hotelId:hotel.id,targetId:banner.id,error:'Upload cleanup unconfirmed'});
    }
    revalidatePath('/admin/banners');revalidatePath('/');revalidatePath(`/hotel/${hotel.slug}`);
    redirect(`/admin/banners/${bannerId}?error=${encodeURIComponent(communicationFailureMessage(error))}`);
  }

  if (previousPath && previousPath !== path) {
    const { error: cleanupError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([previousPath]);
    if (cleanupError) {
      logOperationalError({
        module: 'banners',
        action: 'uploadPromotionalBannerImageAction',
        operation: 'clean previous banner image',
        hotelId: hotel.id,
        targetId: banner.id,
        error: 'Previous banner image cleanup failed',
      });
    }
  }


  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${banner.id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/banners/${banner.id}?success=Imagem%20do%20banner%20enviada%20com%20sucesso`);
}
