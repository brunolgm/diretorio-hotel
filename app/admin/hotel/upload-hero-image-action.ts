'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import {
  getHotelHeroStoragePath,
  getHotelHeroStoragePaths,
  isSupportedHotelHeroMimeType,
} from '@/lib/hotel-hero-storage';
import { getAdminHotel } from '@/lib/queries';
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

  const maxFileSize = 10 * 1024 * 1024;

  if (!isSupportedHotelHeroMimeType(fileEntry.type)) {
    redirect('/admin/hotel?error=Envie%20uma%20imagem%20JPEG,%20PNG%20ou%20WEBP');
  }

  if (fileEntry.size > maxFileSize) {
    redirect('/admin/hotel?error=A%20imagem%20de%20capa%20deve%20ter%20no%20m%C3%A1ximo%2010MB');
  }

  const storagePath = getHotelHeroStoragePath(hotel.id, fileEntry.type);
  const { error: uploadError } = await adminSupabase.storage
    .from('hotel-assets')
    .upload(storagePath, fileEntry, { upsert: true, contentType: fileEntry.type });

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
    await adminSupabase.storage.from('hotel-assets').remove([storagePath]);
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelHeroImageAction',
      operation: 'save hero image URL',
      hotelId: hotel.id,
      error: 'Hero image URL update failed',
    });
    redirect(`/admin/hotel?error=${encodeURIComponent('A imagem foi enviada, mas não foi possível concluir a atualização do hotel. Revise a tela e tente novamente.')}`);
  }

  const staleStoragePaths = getHotelHeroStoragePaths(hotel.id).filter(
    (path) => path !== storagePath
  );
  const { error: cleanupError } = await adminSupabase.storage
    .from('hotel-assets')
    .remove(staleStoragePaths);

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
