'use server';

import { redirect } from 'next/navigation';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function updateHotelAction(formData: FormData) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const payload: Database['public']['Tables']['hotels']['Update'] = {
    name: String(formData.get('name') || ''),
    city: String(formData.get('city') || ''),
    booking_url: String(formData.get('booking_url') || ''),
    website_url: String(formData.get('website_url') || ''),
    instagram_url: String(formData.get('instagram_url') || ''),
    whatsapp_number: String(formData.get('whatsapp_number') || ''),
    wifi_name: String(formData.get('wifi_name') || ''),
    wifi_password: String(formData.get('wifi_password') || ''),
    breakfast_hours: String(formData.get('breakfast_hours') || ''),
    checkin_time: String(formData.get('checkin_time') || ''),
    checkout_time: String(formData.get('checkout_time') || ''),
    logo_url: String(formData.get('logo_url') || ''),
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