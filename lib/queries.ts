import { createClient } from '@/lib/supabase/server';

export async function getHotelBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .single();

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Usuário não autenticado.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('hotel_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.hotel_id) {
    throw new Error('Perfil sem hotel vinculado.');
  }

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('*')
    .eq('id', profile.hotel_id)
    .single();

  if (hotelError) {
    throw new Error('Não foi possível carregar o hotel do administrador.');
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