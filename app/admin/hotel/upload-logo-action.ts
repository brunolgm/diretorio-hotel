'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '@/lib/auth';
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
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function uploadHotelLogoAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();

  const fileEntry = formData.get('logo');

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect('/admin/hotel?error=Selecione uma imagem antes de enviar');
  }

  const validation = await validateImageUpload(fileEntry, IMAGE_UPLOAD_POLICIES.logo);
  if (!validation.ok) {
    const message = validation.reason === 'too_large'
      ? 'A logo deve ter no máximo 5MB'
      : validation.reason === 'dimensions'
        ? 'A logo possui dimensões excessivas'
        : 'Envie uma imagem PNG, JPEG ou WebP válida';
    redirect(`/admin/hotel?error=${encodeURIComponent(message)}`);
  }

  const path = buildHotelAssetStoragePath({
    hotelId: hotel.id,
    category: 'logo',
    extension: validation.value.extension,
  });
  const previousPath = extractOwnedHotelAssetPath({
    publicUrl: hotel.logo_url,
    hotelId: hotel.id,
    category: 'logo',
  });

  const { error: uploadError } = await adminSupabase.storage
    .from('hotel-assets')
    .upload(path, validation.value.bytes, {
      upsert: false,
      contentType: validation.value.mimeType,
    });

  if (uploadError) {
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelLogoAction',
      operation: 'upload logo to storage',
      hotelId: hotel.id,
      error: uploadError,
    });
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        buildOperationalErrorMessage(
          'a logo',
          'enviar',
          'Verifique o arquivo e tente novamente.'
        )
      )}`
    );
  }

  const { data } = supabase.storage.from('hotel-assets').getPublicUrl(path);

  const { data: updatedHotel, error: updateError } = await supabase
    .from('hotels')
    .update({ logo_url: data.publicUrl })
    .eq('id', hotel.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updatedHotel) {
    const { error: cleanupError } = await adminSupabase.storage.from('hotel-assets').remove([path]);
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelLogoAction',
      operation: 'save uploaded logo URL',
      hotelId: hotel.id,
      error: updateError,
    });
    if (cleanupError) {
      logOperationalError({
        module: 'hotel',
        action: 'uploadHotelLogoAction',
        operation: 'rollback uploaded logo',
        hotelId: hotel.id,
        error: 'Logo rollback cleanup failed',
      });
    }
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        'A logo foi enviada, mas não foi possível concluir a atualização do hotel. Revise a tela e tente novamente.'
      )}`
    );
  }

  if (previousPath && previousPath !== path) {
    const { error: cleanupError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([previousPath]);
    if (cleanupError) {
      logOperationalError({
        module: 'hotel',
        action: 'uploadHotelLogoAction',
        operation: 'clean previous logo',
        hotelId: hotel.id,
        error: 'Previous logo cleanup failed',
      });
    }
  }

  revalidatePath('/admin/hotel');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/hotel?success=Logo enviada com sucesso');
}

