'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
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
  const { user } = await requireAdminAccess('operador');
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

  const { data: banner, error: bannerError } = await supabase
    .from('hotel_promotional_banners')
    .select('id, image_url')
    .eq('id', bannerId)
    .eq('hotel_id', hotel.id)
    .single();

  if (bannerError || !banner) {
    redirect(`/admin/banners/${bannerId}?error=Banner%20n%C3%A3o%20encontrado`);
  }

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

  const { data: updatedBanner, error: updateError } = await supabase
    .from('hotel_promotional_banners')
    .update({
      image_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', banner.id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updatedBanner) {
    const { error: cleanupError } = await adminSupabase.storage.from('hotel-assets').remove([path]);
    logOperationalError({
      module: 'banners',
      action: 'uploadPromotionalBannerImageAction',
      operation: 'save uploaded banner image URL',
      hotelId: hotel.id,
      targetId: banner.id,
      error: 'Banner image URL update failed',
    });
    if (cleanupError) {
      logOperationalError({
        module: 'banners',
        action: 'uploadPromotionalBannerImageAction',
        operation: 'rollback uploaded banner image',
        hotelId: hotel.id,
        targetId: banner.id,
        error: 'Banner image rollback cleanup failed',
      });
    }
    redirect(
      `/admin/banners/${bannerId}?error=${encodeURIComponent(
        'A imagem foi enviada, mas não foi possível concluir a atualização do banner. Revise a tela e tente novamente.'
      )}`
    );
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

  await recordAdminAuditEvent({
    actorUserId: user.id,
    hotelId: hotel.id,
    action: 'banner.image_uploaded',
    entityType: 'hotel_promotional_banner',
    entityId: banner.id,
    metadata: { media_category: 'promotional-banners', format: validation.value.extension },
  });

  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${banner.id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/banners/${banner.id}?success=Imagem%20do%20banner%20enviada%20com%20sucesso`);
}
