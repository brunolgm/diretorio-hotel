import type { Json } from '@/types/database';

export const ANALYTICS_PERIODS = ['today', '7d', '30d', '90d'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

export const ANALYTICS_PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export type AnalyticsMetricComparison = {
  current: number;
  previous: number;
  delta: number;
  percentage: number | null;
  state: 'up' | 'down' | 'flat' | 'new_period' | 'no_baseline';
};

export type AnalyticsMetricKey =
  | 'pageViews'
  | 'engagements'
  | 'whatsappClicks'
  | 'bookingWebsiteClicks'
  | 'languageChanges';

export type AnalyticsActionKey =
  | 'whatsapp_click'
  | 'booking_click'
  | 'website_click'
  | 'service_view'
  | 'department_click';

export const ANALYTICS_ACTION_LABELS: Record<AnalyticsActionKey, string> = {
  whatsapp_click: 'WhatsApp',
  booking_click: 'Reservas',
  website_click: 'Site oficial',
  service_view: 'Serviços',
  department_click: 'Departamentos',
};

export type HotelAnalytics = {
  period: AnalyticsPeriod;
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  metrics: Record<AnalyticsMetricKey, AnalyticsMetricComparison>;
  journey: { views: number; interactions: number; externalClicks: number };
  timeseries: Array<{ date: string; pageViews: number; engagements: number; externalClicks: number }>;
  actions: Array<{ eventType: AnalyticsActionKey; count: number; share: number }>;
  services: Array<{ id: string; name: string; count: number }>;
  departments: Array<{ id: string; name: string; count: number }>;
  languages: Array<{ language: 'pt' | 'en' | 'es'; count: number; share: number }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeAnalyticsPeriod(value?: string | null): AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly string[]).includes(value || '')
    ? value as AnalyticsPeriod
    : '7d';
}

export function buildAnalyticsComparison(current: number, previous: number): AnalyticsMetricComparison {
  const delta = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      delta,
      percentage: null,
      state: current > 0 ? 'new_period' : 'no_baseline',
    };
  }
  return {
    current,
    previous,
    delta,
    percentage: Math.round((delta / previous) * 1000) / 10,
    state: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  };
}

function readMetric(value: unknown) {
  if (!isRecord(value)) return null;
  const current = finiteNumber(value.current);
  const previous = finiteNumber(value.previous);
  return current === null || previous === null ? null : buildAnalyticsComparison(current, previous);
}

function readRankings(value: unknown) {
  if (!Array.isArray(value)) return null;
  const result: Array<{ id: string; name: string; count: number }> = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return null;
    const count = finiteNumber(item.count);
    if (count === null) return null;
    result.push({ id: item.id, name: item.name, count });
  }
  return result.slice(0, 5);
}

export function normalizeHotelAnalytics(value: Json): HotelAnalytics | null {
  if (!isRecord(value) || !ANALYTICS_PERIODS.includes(value.period as AnalyticsPeriod)) return null;
  if (!isRecord(value.metrics) || !isRecord(value.journey)) return null;
  const pageViews = readMetric(value.metrics.page_views);
  const engagements = readMetric(value.metrics.engagements);
  const whatsappClicks = readMetric(value.metrics.whatsapp_clicks);
  const bookingWebsiteClicks = readMetric(value.metrics.booking_website_clicks);
  const languageChanges = readMetric(value.metrics.language_changes);
  if (!pageViews || !engagements || !whatsappClicks || !bookingWebsiteClicks || !languageChanges) return null;

  const views = finiteNumber(value.journey.views);
  const interactions = finiteNumber(value.journey.interactions);
  const externalClicks = finiteNumber(value.journey.external_clicks);
  if (views === null || interactions === null || externalClicks === null) return null;
  if (![value.current_start,value.current_end,value.previous_start,value.previous_end].every((item) => typeof item === 'string')) return null;

  if (!Array.isArray(value.timeseries)
    || value.timeseries.length !== ANALYTICS_PERIOD_DAYS[value.period as AnalyticsPeriod]
    || !Array.isArray(value.actions)
    || !Array.isArray(value.languages)) return null;
  const timeseries: HotelAnalytics['timeseries'] = [];
  for (const item of value.timeseries) {
    if (!isRecord(item) || typeof item.date !== 'string') return null;
    const dailyViews = finiteNumber(item.page_views);
    const dailyEngagements = finiteNumber(item.engagements);
    const dailyExternal = finiteNumber(item.external_clicks);
    if (dailyViews === null || dailyEngagements === null || dailyExternal === null) return null;
    timeseries.push({ date: item.date, pageViews: dailyViews, engagements: dailyEngagements, externalClicks: dailyExternal });
  }

  const actions: HotelAnalytics['actions'] = [];
  for (const item of value.actions) {
    if (!isRecord(item) || !(item.event_type as string in ANALYTICS_ACTION_LABELS)) return null;
    const count = finiteNumber(item.count);
    const share = finiteNumber(item.share);
    if (count === null || share === null) return null;
    actions.push({ eventType: item.event_type as AnalyticsActionKey, count, share });
  }

  const languageRows: Array<{ language: 'pt' | 'en' | 'es'; count: number }> = [];
  for (const item of value.languages) {
    if (!isRecord(item) || !['pt','en','es'].includes(String(item.language))) return null;
    const count = finiteNumber(item.count);
    if (count === null) return null;
    languageRows.push({ language: item.language as 'pt' | 'en' | 'es', count });
  }
  const languageTotal = languageRows.reduce((sum, item) => sum + item.count, 0);
  const services = readRankings(value.services);
  const departments = readRankings(value.departments);
  if (!services || !departments) return null;

  return {
    period: value.period as AnalyticsPeriod,
    currentStart: value.current_start as string,
    currentEnd: value.current_end as string,
    previousStart: value.previous_start as string,
    previousEnd: value.previous_end as string,
    metrics: { pageViews, engagements, whatsappClicks, bookingWebsiteClicks, languageChanges },
    journey: { views, interactions, externalClicks },
    timeseries,
    actions,
    services,
    departments,
    languages: languageRows.map((item) => ({
      ...item,
      share: languageTotal ? Math.round((item.count * 1000) / languageTotal) / 10 : 0,
    })),
  };
}

export function buildAnalyticsInsights(analytics: HotelAnalytics): string[] {
  if (analytics.metrics.pageViews.current === 0) {
    return ['Ainda não há volume suficiente para uma leitura comparativa neste período.'];
  }
  const insights: string[] = [];
  const externalTotal = analytics.journey.externalClicks;
  const whatsapp = analytics.metrics.whatsappClicks.current;
  if (externalTotal > 0) {
    insights.push(`O WhatsApp concentrou ${Math.round((whatsapp * 100) / externalTotal)}% das ações externas no período.`);
  }
  const leadingContent = [
    analytics.services[0] ? { label: 'Serviços', count: analytics.services[0].count } : null,
    analytics.departments[0] ? { label: 'Departamentos', count: analytics.departments[0].count } : null,
  ].filter((item): item is { label: string; count: number } => Boolean(item)).sort((a,b) => b.count-a.count)[0];
  if (leadingContent) insights.push(`${leadingContent.label} foi a área mais consultada no período.`);
  const comparison = analytics.metrics.pageViews;
  if (comparison.state === 'up') insights.push('O uso cresceu em relação ao período anterior.');
  else if (comparison.state === 'down') insights.push('O uso recuou em relação ao período anterior.');
  else if (comparison.state === 'new_period') insights.push('Este período registrou uso, mas ainda não havia base anterior.');
  else insights.push('O volume de uso ficou estável em relação ao período anterior.');
  return insights;
}
