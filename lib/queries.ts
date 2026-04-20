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
  previousSince: string;
  previousUntil: string;
  totalEvents: number;
  pageViews: number;
  languageSelections: number;
  whatsappClicks: number;
  websiteClicks: number;
  bookingClicks: number;
  departmentClicks: number;
  bookingAndWebsiteClicks: number;
  languageUsage: Array<{
    language: 'pt' | 'en' | 'es';
    count: number;
  }>;
  departmentUsage: Array<{
    departmentId: string;
    name: string;
    count: number;
  }>;
  topActions: Array<{
    eventType:
      | 'whatsapp_click'
      | 'booking_click'
      | 'website_click'
      | 'department_click'
      | 'language_selected';
    label: string;
    count: number;
  }>;
  comparison: {
    pageViews: AnalyticsMetricComparison;
    whatsappClicks: AnalyticsMetricComparison;
    bookingAndWebsiteClicks: AnalyticsMetricComparison;
    languageSelections: AnalyticsMetricComparison;
    totalEvents: AnalyticsMetricComparison;
  };
}

export interface AnalyticsMetricComparison {
  current: number;
  previous: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
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

function getPreviousAnalyticsRangeWindow(range: AnalyticsRange) {
  const now = new Date();

  if (range === 'today') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    return {
      previousSince: yesterdayStart.toISOString(),
      previousUntil: todayStart.toISOString(),
    };
  }

  const days = range === '30d' ? 30 : 7;
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    previousSince: previousStart.toISOString(),
    previousUntil: currentStart.toISOString(),
  };
}

function buildMetricComparison(current: number, previous: number): AnalyticsMetricComparison {
  const delta = current - previous;

  return {
    current,
    previous,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  };
}

export async function getHotelAnalyticsSummary(hotelId: string, range?: string | null) {
  const supabase = await createClient();
  const normalizedRange = normalizeAnalyticsRange(range);
  const since = getAnalyticsRangeStart(normalizedRange);
  const { previousSince, previousUntil } = getPreviousAnalyticsRangeWindow(normalizedRange);

  const [{ data: events, error: eventsError }, { data: departments, error: departmentsError }] =
    await Promise.all([
      supabase
        .from('hotel_analytics_events')
        .select('event_type, language, department_id, created_at')
        .eq('hotel_id', hotelId)
        .gte('created_at', previousSince),
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
  const currentEvents = typedEvents.filter((event) => event.created_at >= since);
  const previousEvents = typedEvents.filter(
    (event) => event.created_at >= previousSince && event.created_at < previousUntil
  );

  const languageCounts = new Map<'pt' | 'en' | 'es', number>();
  const departmentCounts = new Map<string, number>();
  const topActionDefinitions = [
    { eventType: 'whatsapp_click' as const, label: 'WhatsApp' },
    { eventType: 'booking_click' as const, label: 'Reservas' },
    { eventType: 'website_click' as const, label: 'Site oficial' },
    { eventType: 'department_click' as const, label: 'Departamentos' },
    { eventType: 'language_selected' as const, label: 'Trocas de idioma' },
  ];

  currentEvents.forEach((event) => {
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
  }))
    .sort((a, b) => b.count - a.count);

  const departmentUsage = Array.from(departmentCounts.entries())
    .map(([departmentId, count]) => ({
      departmentId,
      name: departmentNameById.get(departmentId) || 'Departamento removido',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const countByEventType = (
    list: typeof currentEvents,
    eventType: (typeof topActionDefinitions)[number]['eventType']
  ) => list.filter((event) => event.event_type === eventType).length;

  const pageViews = currentEvents.filter((event) => event.event_type === 'page_view').length;
  const whatsappClicks = countByEventType(currentEvents, 'whatsapp_click');
  const websiteClicks = countByEventType(currentEvents, 'website_click');
  const bookingClicks = countByEventType(currentEvents, 'booking_click');
  const departmentClicks = countByEventType(currentEvents, 'department_click');
  const languageSelections = countByEventType(currentEvents, 'language_selected');
  const bookingAndWebsiteClicks = bookingClicks + websiteClicks;

  const previousPageViews = previousEvents.filter((event) => event.event_type === 'page_view')
    .length;
  const previousWhatsappClicks = countByEventType(previousEvents, 'whatsapp_click');
  const previousWebsiteClicks = countByEventType(previousEvents, 'website_click');
  const previousBookingClicks = countByEventType(previousEvents, 'booking_click');
  const previousLanguageSelections = countByEventType(previousEvents, 'language_selected');
  const previousBookingAndWebsiteClicks = previousBookingClicks + previousWebsiteClicks;

  const topActions = topActionDefinitions
    .map((item) => ({
      ...item,
      count: countByEventType(currentEvents, item.eventType),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    range: normalizedRange,
    since,
    previousSince,
    previousUntil,
    totalEvents: currentEvents.length,
    pageViews,
    languageSelections,
    whatsappClicks,
    websiteClicks,
    bookingClicks,
    departmentClicks,
    bookingAndWebsiteClicks,
    languageUsage,
    departmentUsage,
    topActions,
    comparison: {
      pageViews: buildMetricComparison(pageViews, previousPageViews),
      whatsappClicks: buildMetricComparison(whatsappClicks, previousWhatsappClicks),
      bookingAndWebsiteClicks: buildMetricComparison(
        bookingAndWebsiteClicks,
        previousBookingAndWebsiteClicks
      ),
      languageSelections: buildMetricComparison(languageSelections, previousLanguageSelections),
      totalEvents: buildMetricComparison(currentEvents.length, previousEvents.length),
    },
  } satisfies HotelAnalyticsSummary;
}
