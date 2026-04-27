'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { readTrimmedString } from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function uploadPromotionalBannerImageAction(formData: FormData) {
  const { user, profile } = await requireAdminAccess('operador');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();
  const bannerId = readTrimmedString(formData, 'banner_id');
  const fileEntry = formData.get('image');

  if (!bannerId) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido%20para%20upload');
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect(`/admin/banners/${bannerId}?error=Selecione%20uma%20imagem%20antes%20de%20enviar`);
  }

  const { data: banner, error: bannerError } = await supabase
    .from('hotel_promotional_banners')
    .select('id')
    .eq('id', bannerId)
    .eq('hotel_id', hotel.id)
    .single();

  if (bannerError || !banner) {
    redirect(`/admin/banners/${bannerId}?error=Banner%20n%C3%A3o%20encontrado`);
  }

  const file = fileEntry;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maxFileSize = 2 * 1024 * 1024;

  if (!allowedMimeTypes.has(file.type)) {
    redirect(`/admin/banners/${bannerId}?error=Envie%20uma%20imagem%20JPG,%20PNG%20ou%20WEBP`);
  }

  if (file.size > maxFileSize) {
    redirect(`/admin/banners/${bannerId}?error=O%20banner%20deve%20ter%20no%20m%C3%A1ximo%202MB`);
  }

  if (!file.name.trim()) {
    redirect(`/admin/banners/${bannerId}?error=Arquivo%20de%20banner%20inv%C3%A1lido`);
  }

  const path = `${hotel.id}/promotional-banners/${banner.id}.${ext}`;

  console.info('[banners] uploadPromotionalBannerImageAction storage upload starting', {
    operation: 'upload promotional banner image to storage',
    bucket: 'hotel-assets',
    storagePath: path,
    hotelId: hotel.id,
    bannerId: banner.id,
    userId: user.id,
    profileHotelId: profile.hotel_id,
  });

  const { error: uploadError } = await adminSupabase.storage.from('hotel-assets').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    console.error('[banners] uploadPromotionalBannerImageAction storage upload failed', {
      operation: 'upload promotional banner image to storage',
      bucket: 'hotel-assets',
      storagePath: path,
      hotelId: hotel.id,
      bannerId: banner.id,
      userId: user.id,
      profileHotelId: profile.hotel_id,
      message: uploadError.message,
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

  const { error: updateError } = await supabase
    .from('hotel_promotional_banners')
    .update({
      image_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', banner.id)
    .eq('hotel_id', hotel.id);

  if (updateError) {
    logOperationalError({
      module: 'banners',
      action: 'uploadPromotionalBannerImageAction',
      operation: 'save uploaded banner image URL',
      hotelId: hotel.id,
      targetId: banner.id,
      error: updateError,
    });
    redirect(
      `/admin/banners/${bannerId}?error=${encodeURIComponent(
        'A imagem foi enviada, mas não foi possível concluir a atualização do banner. Revise a tela e tente novamente.'
      )}`
    );
  }

  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${banner.id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(`/admin/banners/${banner.id}?success=Imagem%20do%20banner%20enviada%20com%20sucesso`);
}
