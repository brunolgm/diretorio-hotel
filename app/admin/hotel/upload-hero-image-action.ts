'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import {
  buildHotelAssetStoragePath,
  extractOwnedHotelAssetPath,
  IMAGE_UPLOAD_POLICIES,
  validateImageUpload,
} from '@/lib/security/image-upload';
import { buildOperationalErrorMessage, logOperationalError } from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function uploadHotelHeroImageAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();
  const fileEntry = formData.get('hero_image');

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect('/admin/hotel?error=Selecione%20uma%20imagem%20de%20capa');
  }

  const validation = await validateImageUpload(fileEntry, IMAGE_UPLOAD_POLICIES.hero);
  if (!validation.ok) {
    const message = validation.reason === 'too_large'
      ? 'A imagem de capa deve ter no máximo 10MB'
      : validation.reason === 'dimensions'
        ? 'A imagem de capa possui dimensões excessivas'
        : 'Envie uma imagem PNG, JPEG ou WebP válida';
    redirect(`/admin/hotel?error=${encodeURIComponent(message)}`);
  }

  const storagePath = buildHotelAssetStoragePath({
    hotelId: hotel.id,
    category: 'hero',
    extension: validation.value.extension,
  });
  const previousPath = extractOwnedHotelAssetPath({
    publicUrl: hotel.hero_image_url,
    hotelId: hotel.id,
    category: 'hero',
  });
  const { error: uploadError } = await adminSupabase.storage
    .from('hotel-assets')
    .upload(storagePath, validation.value.bytes, {
      upsert: false,
      contentType: validation.value.mimeType,
    });

  if (uploadError) {
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelHeroImageAction',
      operation: 'upload hero image to storage',
      hotelId: hotel.id,
      error: 'Hero image storage upload failed',
    });
    redirect(`/admin/hotel?error=${encodeURIComponent(buildOperationalErrorMessage('a imagem de capa', 'enviar', 'Verifique o arquivo e tente novamente.'))}`);
  }

  const { data } = supabase.storage.from('hotel-assets').getPublicUrl(storagePath);
  const { data: updatedHotel, error: updateError } = await supabase
    .from('hotels')
    .update({ hero_image_url: data.publicUrl })
    .eq('id', hotel.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updatedHotel) {
    const { error: cleanupError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([storagePath]);
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelHeroImageAction',
      operation: 'save hero image URL',
      hotelId: hotel.id,
      error: 'Hero image URL update failed',
    });
    if (cleanupError) {
      logOperationalError({
        module: 'hotel',
        action: 'uploadHotelHeroImageAction',
        operation: 'rollback uploaded hero image',
        hotelId: hotel.id,
        error: 'Hero image rollback cleanup failed',
      });
    }
    redirect(`/admin/hotel?error=${encodeURIComponent('A imagem foi enviada, mas não foi possível concluir a atualização do hotel. Revise a tela e tente novamente.')}`);
  }

  const { error: cleanupError } = previousPath && previousPath !== storagePath
    ? await adminSupabase.storage.from('hotel-assets').remove([previousPath])
    : { error: null };

  if (cleanupError) {
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelHeroImageAction',
      operation: 'clean previous hero image variants',
      hotelId: hotel.id,
      error: 'Previous hero image cleanup failed',
    });
  }

  revalidatePath('/admin/hotel');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);
  redirect('/admin/hotel?success=Imagem%20de%20capa%20enviada%20com%20sucesso');
}
