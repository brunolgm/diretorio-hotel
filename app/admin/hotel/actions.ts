'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { isValidOptionalUrl, readNullableString, readOptionalUrl, readTrimmedString } from '@/lib/form-utils';
import {
  isAllowedAdminThemePreset,
  sanitizeHotelThemePrimaryColor,
} from '@/lib/hotel-theme';
import { validateHotelSubdomain } from '@/lib/hotel-subdomain';
import { getHotelHeroStoragePaths } from '@/lib/hotel-hero-storage';
import {
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function updateHotelAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const name = readTrimmedString(formData, 'name');
  const bookingUrlInput = readNullableString(formData, 'booking_url');
  const websiteUrlInput = readNullableString(formData, 'website_url');
  const instagramUrlInput = readNullableString(formData, 'instagram_url');
  const logoUrlInput = readNullableString(formData, 'logo_url');
  const heroImageUrlInput = readNullableString(formData, 'hero_image_url');
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

  if (!isValidOptionalUrl(heroImageUrlInput)) {
    redirect('/admin/hotel?error=URL%20da%20imagem%20de%20capa%20inv%C3%A1lida');
  }

  if (!validatedSubdomain.isValid) {
    redirect(
      `/admin/hotel?error=${encodeURIComponent(validatedSubdomain.error || 'Subdom%C3%ADnio inv%C3%A1lido')}`
    );
  }

  if (!isAllowedAdminThemePreset(hotel, themePresetInput)) {
    redirect(
      '/admin/hotel?error=O%20tema%20selecionado%20n%C3%A3o%20%C3%A9%20permitido%20para%20este%20hotel'
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
      logOperationalError({
        module: 'hotel',
        action: 'updateHotelAction',
        operation: 'validate subdomain uniqueness',
        hotelId: hotel.id,
        error: subdomainError,
      });
      redirect('/admin/hotel?error=N%C3%A3o%20foi%20poss%C3%ADvel%20validar%20o%20subdom%C3%ADnio%20agora');
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
    hero_image_url: readOptionalUrl(formData, 'hero_image_url'),
    theme_preset: themePresetInput,
    theme_primary_color: sanitizeHotelThemePrimaryColor(themePrimaryColorInput),
  };

  const { data: updatedHotel, error } = await supabase
    .from('hotels')
    .update(payload)
    .eq('id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedHotel) {
    logOperationalError({
      module: 'hotel',
      action: 'updateHotelAction',
      operation: 'save hotel settings',
      hotelId: hotel.id,
      error,
    });
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        buildOperationalErrorMessage(
          'os dados do hotel',
          'salvar',
          'Revise os campos e tente novamente.'
        )
      )}`
    );
  }

  redirect('/admin/hotel?success=Altera%C3%A7%C3%B5es%20salvas%20com%20sucesso');
}

export async function removeHotelLogoAction() {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: updatedHotel, error } = await supabase
    .from('hotels')
    .update({ logo_url: null })
    .eq('id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedHotel) {
    logOperationalError({
      module: 'hotel',
      action: 'removeHotelLogoAction',
      operation: 'remove logo',
      hotelId: hotel.id,
      error,
    });
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        buildOperationalErrorMessage(
          'a logo atual',
          'remover',
          'Tente novamente em instantes.'
        )
      )}`
    );
  }

  redirect('/admin/hotel?success=Logo%20removida%20com%20sucesso');
}

export async function removeHotelHeroImageAction() {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();

  const { data: updatedHotel, error } = await supabase
    .from('hotels')
    .update({ hero_image_url: null })
    .eq('id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedHotel) {
    logOperationalError({
      module: 'hotel',
      action: 'removeHotelHeroImageAction',
      operation: 'remove hero image',
      hotelId: hotel.id,
      error,
    });
    redirect(
      `/admin/hotel?error=${encodeURIComponent(
        buildOperationalErrorMessage(
          'a imagem de capa',
          'remover',
          'Tente novamente em instantes.'
        )
      )}`
    );
  }

  const { error: storageError } = await adminSupabase.storage
    .from('hotel-assets')
    .remove(getHotelHeroStoragePaths(hotel.id));

  if (storageError) {
    logOperationalError({
      module: 'hotel',
      action: 'removeHotelHeroImageAction',
      operation: 'remove hero image from storage',
      hotelId: hotel.id,
      error: 'Hero image storage removal failed',
    });
  }

  revalidatePath('/admin/hotel');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect('/admin/hotel?success=Imagem%20de%20capa%20removida%20com%20sucesso');
}

