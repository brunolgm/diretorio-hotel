import { createClient } from '@/lib/supabase/server';

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

export type AnalyticsRange = 'today' | '7d' | '30d';

export interface HotelAnalyticsSummary {
  range: AnalyticsRange;
  since: string;
  totalEvents: number;
  pageViews: number;
  languageSelections: number;
  whatsappClicks: number;
  websiteClicks: number;
  bookingClicks: number;
  departmentClicks: number;
  languageUsage: Array<{
    language: 'pt' | 'en' | 'es';
    count: number;
  }>;
  departmentUsage: Array<{
    departmentId: string;
    name: string;
    count: number;
  }>;
}

function normalizeAnalyticsRange(range?: string | null): AnalyticsRange {
  if (range === 'today' || range === '7d' || range === '30d') {
    return range;
  }

  return '7d';
}

function getAnalyticsRangeStart(range: AnalyticsRange) {
  const now = new Date();

  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  if (range === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function getHotelAnalyticsSummary(hotelId: string, range?: string | null) {
  const supabase = await createClient();
  const normalizedRange = normalizeAnalyticsRange(range);
  const since = getAnalyticsRangeStart(normalizedRange);

  const [{ data: events, error: eventsError }, { data: departments, error: departmentsError }] =
    await Promise.all([
      supabase
        .from('hotel_analytics_events')
        .select('event_type, language, department_id')
        .eq('hotel_id', hotelId)
        .gte('created_at', since),
      supabase.from('hotel_departments').select('id, name').eq('hotel_id', hotelId),
    ]);

  if (eventsError) {
    throw new Error('Não foi possível carregar os eventos de analytics do hotel.');
  }

  if (departmentsError) {
    throw new Error('Não foi possível carregar os departamentos do hotel para analytics.');
  }

  const typedEvents = events || [];
  const typedDepartments = departments || [];
  const departmentNameById = new Map(typedDepartments.map((item) => [item.id, item.name]));

  const languageCounts = new Map<'pt' | 'en' | 'es', number>();
  const departmentCounts = new Map<string, number>();

  typedEvents.forEach((event) => {
    if (
      event.event_type === 'page_view' &&
      (event.language === 'pt' || event.language === 'en' || event.language === 'es')
    ) {
      languageCounts.set(event.language, (languageCounts.get(event.language) || 0) + 1);
    }

    if (event.event_type === 'department_click' && event.department_id) {
      departmentCounts.set(
        event.department_id,
        (departmentCounts.get(event.department_id) || 0) + 1
      );
    }
  });

  const languageUsage = (['pt', 'en', 'es'] as const).map((language) => ({
    language,
    count: languageCounts.get(language) || 0,
  }));

  const departmentUsage = Array.from(departmentCounts.entries())
    .map(([departmentId, count]) => ({
      departmentId,
      name: departmentNameById.get(departmentId) || 'Departamento removido',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    range: normalizedRange,
    since,
    totalEvents: typedEvents.length,
    pageViews: typedEvents.filter((event) => event.event_type === 'page_view').length,
    languageSelections: typedEvents.filter((event) => event.event_type === 'language_selected')
      .length,
    whatsappClicks: typedEvents.filter((event) => event.event_type === 'whatsapp_click').length,
    websiteClicks: typedEvents.filter((event) => event.event_type === 'website_click').length,
    bookingClicks: typedEvents.filter((event) => event.event_type === 'booking_click').length,
    departmentClicks: typedEvents.filter((event) => event.event_type === 'department_click')
      .length,
    languageUsage,
    departmentUsage,
  } satisfies HotelAnalyticsSummary;
}
