import { createClient } from '@/lib/supabase/server';
import { requireAdminAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function getHotelBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.from('hotels').select('*').eq('slug', slug).single();

  if (error) throw new Error('Hotel não encontrado.');
  return data;
}

export async function getHotelSections(hotelId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error('Erro ao buscar seções do hotel.');
  return data;
}

export async function getHotelDepartments(hotelId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('enabled', true);

  if (error) throw new Error('Erro ao buscar departamentos do hotel.');
  return data;
}

export async function getAdminHotel() {
  const supabase = await createClient();
  const { profile } = await requireAdminAccess('visualizador');

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('*')
    .eq('id', profile.hotel_id)
    .maybeSingle();

  if (hotelError || !hotel) {
    redirect('/acesso-indisponivel');
  }

  return hotel;
}

export async function getHotelPolicies(hotelId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hotel_policies')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('enabled', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error('Erro ao buscar políticas do hotel.');
  return data;
}
