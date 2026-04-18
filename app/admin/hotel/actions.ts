'use server';

import { redirect } from 'next/navigation';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { isValidOptionalUrl, readNullableString, readOptionalUrl, readTrimmedString } from '@/lib/form-utils';

export async function updateHotelAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const name = readTrimmedString(formData, 'name');
  const bookingUrlInput = readNullableString(formData, 'booking_url');
  const websiteUrlInput = readNullableString(formData, 'website_url');
  const instagramUrlInput = readNullableString(formData, 'instagram_url');
  const logoUrlInput = readNullableString(formData, 'logo_url');

  if (!name) {
    redirect('/admin/hotel?error=Nome%20do%20hotel%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (!isValidOptionalUrl(bookingUrlInput)) {
    redirect('/admin/hotel?error=Link%20de%20reservas%20inv%C3%A1lido');
  }

  if (!isValidOptionalUrl(websiteUrlInput)) {
    redirect('/admin/hotel?error=Link%20do%20site%20inv%C3%A1lido');
  }

  if (!isValidOptionalUrl(instagramUrlInput)) {
    redirect('/admin/hotel?error=Link%20do%20Instagram%20inv%C3%A1lido');
  }

  if (!isValidOptionalUrl(logoUrlInput)) {
    redirect('/admin/hotel?error=Logo%20URL%20inv%C3%A1lida');
  }

  const payload: Database['public']['Tables']['hotels']['Update'] = {
    name,
    city: readNullableString(formData, 'city'),
    booking_url: readOptionalUrl(formData, 'booking_url'),
    website_url: readOptionalUrl(formData, 'website_url'),
    instagram_url: readOptionalUrl(formData, 'instagram_url'),
    whatsapp_number: readNullableString(formData, 'whatsapp_number'),
    wifi_name: readNullableString(formData, 'wifi_name'),
    wifi_password: readNullableString(formData, 'wifi_password'),
    breakfast_hours: readNullableString(formData, 'breakfast_hours'),
    checkin_time: readNullableString(formData, 'checkin_time'),
    checkout_time: readNullableString(formData, 'checkout_time'),
    logo_url: readOptionalUrl(formData, 'logo_url'),
  };

  const { error } = await supabase
    .from('hotels')
    .update(payload)
    .eq('id', hotel.id);

  if (error) {
    redirect('/admin/hotel?error=Não foi possível salvar os dados do hotel');
  }

  redirect('/admin/hotel?success=Alterações salvas com sucesso');
}

export async function removeHotelLogoAction() {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { error } = await supabase
    .from('hotels')
    .update({ logo_url: null })
    .eq('id', hotel.id);

  if (error) {
    redirect('/admin/hotel?error=Não foi possível remover a logo');
  }

  redirect('/admin/hotel?success=Logo removida com sucesso');
}
