'use server';

import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { isValidOptionalUrl, readNullableString, readOptionalUrl, readTrimmedString } from '@/lib/form-utils';
import {
  sanitizeHotelThemePreset,
  sanitizeHotelThemePrimaryColor,
} from '@/lib/hotel-theme';
import { validateHotelSubdomain } from '@/lib/hotel-subdomain';

export async function updateHotelAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const name = readTrimmedString(formData, 'name');
  const bookingUrlInput = readNullableString(formData, 'booking_url');
  const websiteUrlInput = readNullableString(formData, 'website_url');
  const instagramUrlInput = readNullableString(formData, 'instagram_url');
  const logoUrlInput = readNullableString(formData, 'logo_url');
  const subdomainInput = readNullableString(formData, 'subdomain');
  const themePresetInput = readNullableString(formData, 'theme_preset');
  const themePrimaryColorInput = readNullableString(formData, 'theme_primary_color');
  const validatedSubdomain = validateHotelSubdomain(subdomainInput);

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

  if (!validatedSubdomain.isValid) {
    redirect(
      `/admin/hotel?error=${encodeURIComponent(validatedSubdomain.error || 'Subdom%C3%ADnio inv%C3%A1lido')}`
    );
  }

  if (validatedSubdomain.normalizedValue) {
    const { data: conflictingHotel, error: subdomainError } = await supabase
      .from('hotels')
      .select('id')
      .eq('subdomain', validatedSubdomain.normalizedValue)
      .neq('id', hotel.id)
      .maybeSingle();

    if (subdomainError) {
      redirect('/admin/hotel?error=N%C3%A3o%20foi%20poss%C3%ADvel%20validar%20o%20subdom%C3%ADnio');
    }

    if (conflictingHotel) {
      redirect('/admin/hotel?error=Este%20subdom%C3%ADnio%20j%C3%A1%20est%C3%A1%20em%20uso');
    }
  }

  const payload: Database['public']['Tables']['hotels']['Update'] = {
    name,
    subdomain: validatedSubdomain.normalizedValue,
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
    theme_preset: sanitizeHotelThemePreset(themePresetInput),
    theme_primary_color: sanitizeHotelThemePrimaryColor(themePrimaryColorInput),
  };

  const { error } = await supabase
    .from('hotels')
    .update(payload)
    .eq('id', hotel.id);

  if (error) {
    redirect('/admin/hotel?error=N%C3%A3o%20foi%20poss%C3%ADvel%20salvar%20os%20dados%20do%20hotel');
  }

  redirect('/admin/hotel?success=Altera%C3%A7%C3%B5es%20salvas%20com%20sucesso');
}

export async function removeHotelLogoAction() {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { error } = await supabase
    .from('hotels')
    .update({ logo_url: null })
    .eq('id', hotel.id);

  if (error) {
    redirect('/admin/hotel?error=N%C3%A3o%20foi%20poss%C3%ADvel%20remover%20a%20logo');
  }

  redirect('/admin/hotel?success=Logo%20removida%20com%20sucesso');
}

