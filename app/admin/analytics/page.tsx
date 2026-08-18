import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Languages,
  MessageCircle,
  Minus,
  MousePointerClick,
} from 'lucide-react';
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminLinkButton,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSectionTitle,
  AdminSelect,
  AdminSurface,
} from '@/components/admin/ui';
import {
  ANALYTICS_ACTION_LABELS,
  ANALYTICS_PERIOD_LABELS,
  buildAnalyticsInsights,
  type AnalyticsMetricComparison,
} from '@/lib/analytics-pro';
import { getCurrentHotelAnalytics } from '@/lib/analytics-queries';
import { requireAdminAccess } from '@/lib/auth';

interface AnalyticsPageProps { searchParams?: Promise<{ period?: string }> }

function comparisonLabel(metric: AnalyticsMetricComparison) {
  if (metric.state === 'new_period') return 'Novo período';
  if (metric.state === 'no_baseline') return 'Sem base anterior';
  if (metric.state === 'flat') return 'Estável';
  return `${metric.percentage! > 0 ? '+' : ''}${metric.percentage}%`;
}

function MetricCard({ title, metric, icon }: { title: string; metric: AnalyticsMetricComparison; icon: React.ReactNode }) {
  const Icon = metric.state === 'up' || metric.state === 'new_period'
    ? ArrowUpRight : metric.state === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="admin-theme-surface rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium uppercase tracking-[.13em] text-[var(--admin-muted)]">{title}</p><p className="mt-2 text-3xl font-semibold text-[var(--admin-text-strong)]">{metric.current}</p></div>
        <div className="rounded-xl bg-[var(--admin-accent-soft)] p-2.5 text-[var(--admin-accent)]">{icon}</div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-[var(--admin-text)]"><Icon className="h-3.5 w-3.5" />{comparisonLabel(metric)}</span>
        <span className="text-[var(--admin-muted)]">Anterior: {metric.previous}</span>
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: Array<{ date: string; pageViews: number }> }) {
  if (!points.some((point) => point.pageViews > 0)) return <AdminEmptyState title="Sem visualizações no período" description="A tendência aparecerá quando a experiência pública receber acessos." />;
  const maximum = Math.max(...points.map((point) => point.pageViews), 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 72 - (point.pageViews / maximum) * 62;
    return { ...point, x, y };
  });
  const first = new Date(points[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  const last = new Date(points.at(-1)!.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return (
    <div className="min-w-0">
      <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label="Visualizações públicas por dia">
        {[10,30,50,70].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" className="stroke-[var(--admin-border)]" />)}
        <polyline points={coordinates.map(({ x,y }) => `${x},${y}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" strokeWidth="2.5" className="stroke-[var(--admin-accent)]" />
        {coordinates.map(({ date,x,y }) => <circle key={date} cx={x} cy={y} r="1.5" vectorEffect="non-scaling-stroke" className="fill-[var(--admin-accent)]" />)}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-[var(--admin-muted)]"><span>{first}</span><span>{last}</span></div>
    </div>
  );
}

function Ranking({ items, empty }: { items: Array<{ id: string; name: string; count: number }>; empty: string }) {
  if (!items.length) return <p className="mt-4 rounded-xl bg-[var(--admin-surface-muted)] p-4 text-sm text-[var(--admin-muted)]">{empty}</p>;
  const total = items.reduce((sum,item) => sum+item.count,0);
  return <div className="mt-4 space-y-3">{items.map((item,index) => (
    <div key={item.id} className="rounded-xl border border-[var(--admin-border)] p-3">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium text-[var(--admin-text-strong)]">{index+1}. {item.name}</span><span className="font-semibold text-[var(--admin-text-strong)]">{item.count}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-muted)]"><div className="h-full rounded-full bg-[var(--admin-accent)]" style={{ width: `${total ? item.count*100/total : 0}%` }} /></div>
    </div>
  ))}</div>;
}

export default async function AdminAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await requireAdminAccess('visualizador');
  const params = searchParams ? await searchParams : {};
  const analytics = await getCurrentHotelAnalytics(params.period);
  const insights = buildAnalyticsInsights(analytics);
  const metrics = analytics.metrics;

  return <main className="space-y-6">
    <AdminPageHero eyebrow="Analytics básico" title="Analytics da experiência" description="Comportamento agregado dos hóspedes. Cliques externos não representam conversão financeira." />

    <AdminSurface>
      <AdminFilterBar className="mt-0">
        <AdminSelect name="period" aria-label="Selecionar período" defaultValue={analytics.period} className="w-full md:w-56">
          {Object.entries(ANALYTICS_PERIOD_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </AdminSelect>
        <AdminPrimaryButton type="submit">Aplicar</AdminPrimaryButton>
        {analytics.period !== '7d' ? <AdminLinkButton href="/admin/analytics">Limpar</AdminLinkButton> : null}
      </AdminFilterBar>
    </AdminSurface>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard title="Visualizações públicas" metric={metrics.pageViews} icon={<Eye className="h-5 w-5" />} />
      <MetricCard title="Ações e engajamentos" metric={metrics.engagements} icon={<Activity className="h-5 w-5" />} />
      <MetricCard title="Cliques em WhatsApp" metric={metrics.whatsappClicks} icon={<MessageCircle className="h-5 w-5" />} />
      <MetricCard title="Reservas e site" metric={metrics.bookingWebsiteClicks} icon={<MousePointerClick className="h-5 w-5" />} />
      <MetricCard title="Trocas de idioma" metric={metrics.languageChanges} icon={<Languages className="h-5 w-5" />} />
    </section>

    <AdminSurface><AdminSectionTitle eyebrow="Tendência" title="Visualizações ao longo do tempo" description="Série diária do período selecionado." /><div className="mt-6"><TrendChart points={analytics.timeseries} /></div></AdminSurface>

    <section className="grid gap-6 xl:grid-cols-2">
      <AdminSurface><AdminSectionTitle eyebrow="Jornada" title="Jornada de engajamento" description="Eventos agregados, sem inferir reservas ou receita." /><div className="mt-5 grid gap-3 sm:grid-cols-3">{[
        ['Visualizações',analytics.journey.views],['Interações',analytics.journey.interactions],['Cliques externos',analytics.journey.externalClicks],
      ].map(([label,value]) => <div key={label} className="rounded-xl bg-[var(--admin-surface-muted)] p-4"><p className="text-xs text-[var(--admin-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--admin-text-strong)]">{value}</p></div>)}</div></AdminSurface>
      <AdminSurface><AdminSectionTitle eyebrow="Engajamento" title="Ações com mais engajamento" />{analytics.actions.length ? <div className="mt-4 space-y-2">{analytics.actions.map((item) => <div key={item.eventType} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] p-3 text-sm"><span className="font-medium text-[var(--admin-text-strong)]">{ANALYTICS_ACTION_LABELS[item.eventType]}</span><span className="text-[var(--admin-muted)]">{item.count} · {item.share}%</span></div>)}</div> : <AdminEmptyState title="Sem ações no período" description="O ranking será exibido após as primeiras interações." />}</AdminSurface>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <AdminSurface><AdminSectionTitle title="Serviços mais consultados" /><Ranking items={analytics.services} empty="Nenhuma consulta de serviço registrada." /></AdminSurface>
      <AdminSurface><AdminSectionTitle title="Departamentos mais consultados" /><Ranking items={analytics.departments} empty="Nenhuma interação com departamento registrada." /></AdminSurface>
    </section>

    <section className="grid gap-6 xl:grid-cols-[.8fr,1.2fr]">
      <AdminSurface><AdminSectionTitle title="Idiomas mais utilizados" />{analytics.languages.length ? <div className="mt-4 space-y-2">{analytics.languages.map((item) => <div key={item.language} className="flex justify-between rounded-xl border border-[var(--admin-border)] p-3 text-sm"><span className="font-medium text-[var(--admin-text-strong)]">{{pt:'Português',en:'English',es:'Español'}[item.language]}</span><span className="text-[var(--admin-muted)]">{item.count} · {item.share}%</span></div>)}</div> : <AdminEmptyState title="Sem idiomas no período" description="O uso por idioma aparecerá após as primeiras visualizações." />}</AdminSurface>
      <AdminSurface><AdminSectionTitle title="Leitura gerencial do período" description="Insights determinísticos derivados exclusivamente dos eventos agregados." /><ul className="mt-5 space-y-3">{insights.map((insight) => <li key={insight} className="rounded-xl bg-[var(--admin-surface-muted)] p-4 text-sm leading-6 text-[var(--admin-text)]">{insight}</li>)}</ul><p className="mt-4 text-xs text-[var(--admin-muted)]">Analytics comportamental; não mede receita ou conversão de reservas.</p></AdminSurface>
    </section>

    <Link href="/admin" className="inline-flex text-sm font-semibold text-[var(--admin-accent)]">Voltar ao dashboard</Link>
  </main>;
}
