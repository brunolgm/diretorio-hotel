import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ConciergeBell,
  Eye,
  Hotel,
  Languages,
  MessageCircle,
  Minus,
  MousePointerClick,
  ShieldCheck,
} from 'lucide-react';
import {
  AdminFilterBar,
  AdminInfoBadge,
  AdminLinkButton,
  AdminPageHero,
  AdminPrimaryButton,
  AdminQuickArrow,
  AdminSectionTitle,
  AdminSelect,
  AdminStatCard,
  AdminSurface,
} from '@/components/admin/ui';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import {
  getAdminHotel,
  getAdminOperationalReadiness,
  getHotelAnalyticsSummary,
} from '@/lib/queries';

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

interface AdminPageProps {
  searchParams?: Promise<{
    range?: string;
  }>;
}

function formatAnalyticsDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getRangeLabel(range: 'today' | '7d' | '30d') {
  if (range === 'today') return 'Hoje';
  if (range === '30d') return 'Últimos 30 dias';
  return 'Últimos 7 dias';
}

function getRangeWindowLabel(range: 'today' | '7d' | '30d', since: string) {
  if (range === 'today') return 'Eventos registrados desde o início de hoje.';
  return `Eventos registrados desde ${formatAnalyticsDate(since)}.`;
}

function getComparisonLabel(range: 'today' | '7d' | '30d') {
  if (range === 'today') return 'ontem';
  if (range === '30d') return '30 dias anteriores';
  return '7 dias anteriores';
}

function getLanguageLabel(language: 'pt' | 'en' | 'es') {
  if (language === 'en') return 'English';
  if (language === 'es') return 'Español';
  return 'Português';
}

function ComparisonPill({
  delta,
  previous,
}: {
  delta: number;
  previous: number;
}) {
  const isUp = delta > 0;
  const isDown = delta < 0;

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
        isUp
          ? 'bg-emerald-100 text-emerald-700'
          : isDown
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {isUp ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : isDown ? (
        <ArrowDownRight className="h-3.5 w-3.5" />
      ) : (
        <Minus className="h-3.5 w-3.5" />
      )}
      {delta === 0 ? 'Estável' : `${delta > 0 ? '+' : ''}${delta}`}
      <span className="text-[11px] opacity-80">vs {previous}</span>
    </span>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const [analytics, operationalReadiness] = await Promise.all([
    getHotelAnalyticsSummary(params?.range),
    getAdminOperationalReadiness(),
  ]);
  const comparisonLabel = getComparisonLabel(analytics.range);
  const canManageHotel = hasMinimumRole(profile.normalizedRole, 'editor');
  const canManageUsers = hasMinimumRole(profile.normalizedRole, 'administrador');
  const topLanguage = analytics.languageUsage.find((item) => item.count > 0) || null;
  const topAction = analytics.topActions.find((item) => item.count > 0) || null;
  const topDepartment = analytics.departmentUsage[0] || null;
  const primaryContactInteractions =
    analytics.whatsappClicks + analytics.bookingClicks + analytics.websiteClicks;
  const analyticsReadout =
    analytics.totalEvents > 0
      ? [
          `${analytics.pageViews} visualizações públicas foram registradas no período selecionado.`,
          primaryContactInteractions > 0
            ? `${primaryContactInteractions} interações de contato ou reserva indicam interesse mais próximo de ação.`
            : 'Ainda não houve interações suficientes em contato ou reserva para leitura de intenção.',
          topDepartment
            ? `${topDepartment.name} lidera entre os departamentos mais consultados pelos hóspedes neste período.`
            : 'Ainda não há cliques suficientes em departamentos para destacar uma preferência clara.',
        ]
      : [
          'Ainda não há eventos suficientes neste período para leitura gerencial.',
          'Assim que a experiência pública receber acessos e cliques, este bloco mostrará sinais mais úteis para gestão.',
          'Use estes números como indicadores de comportamento do hóspede, não como relatório financeiro.',
        ];

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
          value={`${operationalReadiness.completed}/${operationalReadiness.total}`}
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
          eyebrow="Prontidão operacional"
          title="O que falta configurar"
          description="Pendências calculadas com os dados atuais."
          action={
            <AdminInfoBadge>
              {operationalReadiness.pending === 0
                ? 'Base completa'
                : `${operationalReadiness.pending} ${
                    operationalReadiness.pending === 1 ? 'item pendente' : 'itens pendentes'
                  }`}
            </AdminInfoBadge>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {operationalReadiness.items.map((item) => {
            const hrefByKey = {
              hotel: '/admin/hotel',
              services: '/admin/servicos',
              departments: '/admin/departamentos',
              policies: '/admin/politicas',
            } as const;
            const canOpenItem = item.key !== 'hotel' || canManageHotel;
            const content = (
              <div className="flex items-start gap-3">
                {item.ready ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </div>
            );

            return canOpenItem ? (
              <Link
                key={item.key}
                href={hrefByKey[item.key]}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                {content}
              </Link>
            ) : (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
                {content}
              </div>
            );
          })}
        </div>
      </AdminSurface>

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="Analytics público"
          title="Uso da experiência pública"
          description="Interações registradas na experiência pública; não representa resultado financeiro."
          action={
            <AdminInfoBadge>
              <AdminQuickArrow />
              {getRangeLabel(analytics.range)}
            </AdminInfoBadge>
          }
        />

        <AdminFilterBar className="mt-5">
          <AdminSelect aria-label="Selecionar período dos analytics" name="range" defaultValue={analytics.range} className="md:w-[220px]">
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </AdminSelect>
          <AdminPrimaryButton type="submit" className="h-11 px-4">
            Aplicar
          </AdminPrimaryButton>
          {analytics.range !== '7d' ? (
            <AdminLinkButton href="/admin" className="h-11 px-4">
              Limpar
            </AdminLinkButton>
          ) : null}
        </AdminFilterBar>

        <p className="mt-4 text-xs text-slate-500">
          {getRangeWindowLabel(analytics.range, analytics.since)} Comparação com {comparisonLabel}.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            icon={<Eye className="h-5 w-5" />}
            title="Visualizações públicas"
            value={String(analytics.pageViews)}
            description="Acessos registrados"
          />
          <AdminStatCard
            icon={<MessageCircle className="h-5 w-5" />}
            title="Cliques em WhatsApp"
            value={String(analytics.whatsappClicks)}
            description="Contatos iniciados"
          />
          <AdminStatCard
            icon={<MousePointerClick className="h-5 w-5" />}
            title="Reservas e site"
            value={String(analytics.bookingAndWebsiteClicks)}
            description="Cliques externos"
          />
          <AdminStatCard
            icon={<Languages className="h-5 w-5" />}
            title="Trocas de idioma"
            value={String(analytics.languageSelections)}
            description="Seleções manuais"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ComparisonPill
            delta={analytics.comparison.pageViews.delta}
            previous={analytics.comparison.pageViews.previous}
          />
          <ComparisonPill
            delta={analytics.comparison.whatsappClicks.delta}
            previous={analytics.comparison.whatsappClicks.previous}
          />
          <ComparisonPill
            delta={analytics.comparison.bookingAndWebsiteClicks.delta}
            previous={analytics.comparison.bookingAndWebsiteClicks.previous}
          />
          <ComparisonPill
            delta={analytics.comparison.languageSelections.delta}
            previous={analytics.comparison.languageSelections.previous}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Leitura gerencial do período</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {analytics.totalEvents > 0
                ? `${analytics.totalEvents} eventos registrados no período.`
                : 'Sem eventos suficientes no período.'}
            </p>

            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
              {analyticsReadout.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Idiomas mais usados</p>
                </div>
                <AdminInfoBadge>
                  {topLanguage ? getLanguageLabel(topLanguage.language) : 'Sem destaque'}
                </AdminInfoBadge>
              </div>
              <div className="mt-3 space-y-2">
                {analytics.languageUsage.some((item) => item.count > 0) ? (
                  analytics.languageUsage.map((item) => (
                    <div
                      key={item.language}
                      className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200/70"
                    >
                      <span className="font-medium text-slate-700">
                        {getLanguageLabel(item.language)}
                      </span>
                      <span className="font-semibold text-slate-950">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-white px-3 py-4 text-sm text-slate-500 ring-1 ring-slate-200/70">
                    Sem visualizações por idioma neste período.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ações com mais engajamento</p>
                </div>
                <AdminInfoBadge>{topAction ? topAction.label : 'Sem destaque'}</AdminInfoBadge>
              </div>
              <div className="mt-3 space-y-2">
                {analytics.topActions.some((item) => item.count > 0) ? (
                  analytics.topActions.map((item) => (
                    <div
                      key={item.eventType}
                      className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200/70"
                    >
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-semibold text-slate-950">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-white px-3 py-4 text-sm text-slate-500 ring-1 ring-slate-200/70">
                    Sem ações suficientes para ranking.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Departamentos mais consultados
                </p>
              </div>
              <AdminInfoBadge>{topDepartment ? topDepartment.name : 'Sem destaque'}</AdminInfoBadge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {analytics.departmentUsage.length ? (
                analytics.departmentUsage.map((item) => (
                  <div
                    key={item.departmentId}
                    className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200/70"
                  >
                    <span className="font-medium text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-950">{item.count}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg bg-white px-3 py-4 text-sm text-slate-500 ring-1 ring-slate-200/70">
                  Sem cliques em departamentos neste período.
                </div>
              )}
            </div>
          </div>

        </div>
      </AdminSurface>

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
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Revisar conteúdo</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Descrições, horários e links.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Refinar apresentação</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Logo e identidade visual.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Testar jornada do hóspede</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Validação da rota pública.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Preparar demonstração</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Link público e QR Code.</p>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Resumo do ambiente"
            title="Situação atual"
            action={
              <AdminInfoBadge>
                <AdminQuickArrow />
                {operationalReadiness.pending === 0 ? 'Base completa' : 'Revisão pendente'}
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
                {operationalReadiness.pending === 0
                  ? 'A base recomendada de hotel, serviços, departamentos e políticas está configurada.'
                  : 'Use a checklist de prontidão para concluir os itens essenciais que ainda faltam.'}
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
