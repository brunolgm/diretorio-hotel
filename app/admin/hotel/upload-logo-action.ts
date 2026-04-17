'use server';

import { revalidatePath } from 'next/cache';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function uploadHotelLogoAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const file = formData.get('logo') as File | null;

  if (!file || file.size === 0) {
    throw new Error('Arquivo de logo não enviado.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${hotel.id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('hotel-assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Erro no upload da logo:', uploadError);
    throw new Error(`Não foi possível enviar a logo: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('hotel-assets').getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('hotels')
    .update({ logo_url: data.publicUrl })
    .eq('id', hotel.id);

  if (updateError) {
    console.error('Erro ao atualizar logo_url do hotel:', updateError);
    throw new Error(`Logo enviada, mas não foi possível atualizar o hotel: ${updateError.message}`);
  }

  revalidatePath('/admin/hotel');
  revalidatePath(`/hotel/${hotel.slug}`);
}