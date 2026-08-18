import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Clock3,
  ConciergeBell,
  Eye,
  Hotel,
  MousePointerClick,
  ShieldCheck,
} from 'lucide-react';
import {
  AdminInfoBadge,
  AdminLinkButton,
  AdminPageHero,
  AdminQuickArrow,
  AdminSectionTitle,
  AdminStatCard,
  AdminSurface,
} from '@/components/admin/ui';
import { HotelReadinessChecklist } from '@/components/readiness/hotel-readiness-checklist';
import { hasHotelModule } from '@/lib/admin-entitlements';
import { buildAnalyticsComparison } from '@/lib/analytics-pro';
import { getCurrentHotelAnalytics } from '@/lib/analytics-queries';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { getHotelReadinessNextSteps } from '@/lib/hotel-readiness';
import { getAdminHotel } from '@/lib/queries';
import { getCurrentHotelReadiness } from '@/lib/readiness-queries';

function QuickLink({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_-26px_rgba(15,23,42,0.25)] transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-[var(--admin-accent-soft)] p-2.5 text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-border)] transition group-hover:bg-[var(--admin-accent)] group-hover:text-[var(--admin-accent-text)]">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-700" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </Link>
  );
}

export default async function AdminPage() {
  const { profile } = await requireAdminAccess('visualizador');
  const [hotel, readiness, analyticsEnabled] = await Promise.all([
    getAdminHotel(),
    getCurrentHotelReadiness(),
    hasHotelModule('analytics.basic'),
  ]);
  const analytics = analyticsEnabled ? await getCurrentHotelAnalytics('7d') : null;
  const canManageHotel = hasMinimumRole(profile.normalizedRole, 'editor');
  const canManageUsers = hasMinimumRole(profile.normalizedRole, 'administrador');
  const readinessNextSteps = getHotelReadinessNextSteps(readiness);
  const externalClicks = analytics ? buildAnalyticsComparison(
    analytics.metrics.whatsappClicks.current + analytics.metrics.bookingWebsiteClicks.current,
    analytics.metrics.whatsappClicks.previous + analytics.metrics.bookingWebsiteClicks.previous
  ) : null;

  return (
    <main className="space-y-6">
      <AdminPageHero
        eyebrow="Visão geral"
        title="Dashboard"
        description={`Operação e experiência digital de ${hotel.name}.`}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Hotel className="h-5 w-5" />}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Horário de entrada"
        />
        <AdminStatCard
          icon={<Clock3 className="h-5 w-5" />}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Horário de saída"
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Configuração essencial"
          value={readiness.blockingCount === 0 ? 'Base pronta' : `${readiness.blockingCount} bloqueante${readiness.blockingCount === 1 ? '' : 's'}`}
          description="Itens essenciais concluídos"
        />
        <AdminStatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Admin"
          value="Protegido"
          description="Acesso autenticado e restrito"
        />
      </section>

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="Prontidão para publicação"
          title={hotel.platform_status === 'active' ? 'Publicado' : 'Em preparação'}
          description="Checklist calculado em tempo real com os dados e módulos atuais."
          action={
            <AdminInfoBadge>
              {readiness.blockingCount === 0
                ? 'Base completa'
                : `${readiness.blockingCount} ${
                    readiness.blockingCount === 1 ? 'bloqueante' : 'bloqueantes'
                  }`}
            </AdminInfoBadge>
          }
        />

        <div className="mt-6">
          <HotelReadinessChecklist readiness={readiness} variant="admin" />
        </div>
      </AdminSurface>

      {analytics && externalClicks ? <AdminSurface>
        <AdminSectionTitle
          eyebrow="Analytics básico"
          title="Uso da experiência nos últimos 7 dias"
          description="Resumo comportamental; cliques externos não representam conversão financeira."
          action={<AdminLinkButton href="/admin/analytics"><AdminQuickArrow />Ver analytics completo</AdminLinkButton>}
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <AdminStatCard
            icon={<Eye className="h-5 w-5" />}
            title="Visualizações"
            value={String(analytics.metrics.pageViews.current)}
            description={`Anterior: ${analytics.metrics.pageViews.previous}`}
          />
          <AdminStatCard
            icon={<MousePointerClick className="h-5 w-5" />}
            title="Ações"
            value={String(analytics.metrics.engagements.current)}
            description={`Anterior: ${analytics.metrics.engagements.previous}`}
          />
          <AdminStatCard
            icon={<MousePointerClick className="h-5 w-5" />}
            title="Cliques externos"
            value={String(externalClicks.current)}
            description={`Anterior: ${externalClicks.previous}`}
          />
        </div>
      </AdminSurface> : null}

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {canManageHotel ? (
          <QuickLink
            href="/admin/hotel"
            icon={Hotel}
            title="Informações do hotel"
            text="Atualize nome, cidade, horários, Wi-Fi, links institucionais e apresentação da marca."
          />
        ) : null}
        <QuickLink
          href="/admin/servicos"
          icon={ConciergeBell}
          title="Serviços"
          text="Cadastre e organize os cards de serviços e informações exibidos no LibGuest."
        />
        <QuickLink
          href="/admin/departamentos"
          icon={Building2}
          title="Departamentos"
          text="Gerencie os setores de contato exibidos para os hóspedes."
        />
        <QuickLink
          href="/admin/politicas"
          icon={ShieldCheck}
          title="Políticas"
          text="Mantenha regras, orientações e políticas sempre atualizadas."
        />
        {canManageUsers ? (
          <QuickLink
            href="/admin/usuarios"
            icon={ShieldCheck}
            title="Usuários"
            text="Gerencie acessos e distribua papéis simples para a equipe do hotel."
          />
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <AdminSurface>
          <AdminSectionTitle eyebrow="Acesso rápido" title="Próximas ações recomendadas" />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {readinessNextSteps.length ? readinessNextSteps.map((step) => (
              <Link key={step.key} href={step.href!} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300">
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
              </Link>
            )) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Nenhuma ação pendente no checklist atual.</div>}
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Resumo do ambiente"
            title="Situação atual"
            action={
              <AdminInfoBadge>
                <AdminQuickArrow />
                {readiness.blockingCount === 0 ? 'Base pronta' : 'Revisão pendente'}
              </AdminInfoBadge>
            }
          />

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Endereço público</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Slug preservado como fallback.</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Conteúdo essencial</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {readiness.blockingCount === 0
                  ? `Sem bloqueantes; ${readiness.warningCount} recomendações continuam visíveis.`
                  : 'Use o checklist de prontidão para concluir os bloqueantes antes da ativação.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Marca e conteúdo</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Revisão visual e traduções.</p>
            </div>
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
