'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function uploadHotelLogoAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const fileEntry = formData.get('logo');

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    redirect('/admin/hotel?error=Selecione uma imagem antes de enviar');
  }

  const file = fileEntry;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${hotel.id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('hotel-assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    redirect(`/admin/hotel?error=${encodeURIComponent(`Não foi possível enviar a logo: ${uploadError.message}`)}`);
  }

  const { data } = supabase.storage.from('hotel-assets').getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('hotels')
    .update({ logo_url: data.publicUrl })
    .eq('id', hotel.id);

  if (updateError) {
    redirect(`/admin/hotel?error=${encodeURIComponent(`Logo enviada, mas não foi possível atualizar o hotel: ${updateError.message}`)}`);
  }

  revalidatePath('/admin/hotel');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/hotel?success=Logo enviada com sucesso');
}