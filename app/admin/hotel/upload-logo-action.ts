'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import {
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

export async function uploadHotelLogoAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const fileEntry = formData.get('logo');

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect('/admin/hotel?error=Selecione uma imagem antes de enviar');
  }

  const file = fileEntry;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
  const maxFileSize = 5 * 1024 * 1024;

  if (!allowedMimeTypes.has(file.type)) {
    redirect('/admin/hotel?error=Envie%20uma%20imagem%20JPEG,%20PNG,%20WEBP%20ou%20SVG');
  }

  if (file.size > maxFileSize) {
    redirect('/admin/hotel?error=A%20logo%20deve%20ter%20no%20m%C3%A1ximo%205MB');
  }

  if (!file.name.trim()) {
    redirect('/admin/hotel?error=Arquivo%20de%20logo%20inv%C3%A1lido');
  }

  const path = `${hotel.id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('hotel-assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
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

  const { error: updateError } = await supabase
    .from('hotels')
    .update({ logo_url: data.publicUrl })
    .eq('id', hotel.id);

  if (updateError) {
    logOperationalError({
      module: 'hotel',
      action: 'uploadHotelLogoAction',
      operation: 'save uploaded logo URL',
      hotelId: hotel.id,
      error: updateError,
    });
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        'A logo foi enviada, mas nÃ£o foi possÃ­vel concluir a atualizaÃ§Ã£o do hotel. Revise a tela e tente novamente.'
      )}`
    );
  }

  revalidatePath('/admin/hotel');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/hotel?success=Logo enviada com sucesso');
}

