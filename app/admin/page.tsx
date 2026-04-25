import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
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
  AdminGuideCard,
  AdminHelpList,
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
import { getAdminHotel, getHotelAnalyticsSummary } from '@/lib/queries';

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
      className="group rounded-[30px] bg-white p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_24px_55px_-34px_rgba(15,23,42,0.32)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-[22px] bg-slate-100 p-3 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
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

function getRangeLabel(range: 'today' | '7d' | '30d') {
  if (range === 'today') return 'Hoje';
  if (range === '30d') return 'Últimos 30 dias';
  return 'Últimos 7 dias';
}

function getComparisonLabel(range: 'today' | '7d' | '30d') {
  if (range === 'today') return 'ontem';
  if (range === '30d') return '30 dias anteriores';
  return '7 dias anteriores';
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
  const analytics = await getHotelAnalyticsSummary(hotel.id, params?.range);
  const comparisonLabel = getComparisonLabel(analytics.range);
  const canManageHotel = hasMinimumRole(profile.normalizedRole, 'editor');
  const canManageUsers = hasMinimumRole(profile.normalizedRole, 'administrador');

  return (
    <main className="space-y-6">
      <AdminPageHero
        eyebrow="LibGuest"
        title={hotel.name}
        description="Gerencie o LibGuest do hotel com uma experiência mais organizada, elegante e preparada para apresentação, operação e atualização diária."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[30px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Cidade</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {hotel.city || 'Não informada'}
              </p>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Status</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Operacional
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Hotel className="h-5 w-5" />}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Horário padrão configurado para entrada dos hóspedes."
        />
        <AdminStatCard
          icon={<Clock3 className="h-5 w-5" />}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Horário padrão configurado para saída dos hóspedes."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Experiência pública"
          value="Online"
          description="A versão pública do LibGuest está publicada e acessível."
        />
        <AdminStatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Admin"
          value="Protegido"
          description="Área administrativa com autenticação e acesso restrito."
        />
      </section>

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="Analytics público"
          title="Uso da experiência pública"
          description="Acompanhe visualizações e interações principais do LibGuest para entender o que mais gera interesse, contato e leitura útil para gestão."
          action={
            <AdminInfoBadge>
              <AdminQuickArrow />
              {getRangeLabel(analytics.range)}
            </AdminInfoBadge>
          }
        />

        <AdminFilterBar className="mt-8">
          <AdminSelect name="range" defaultValue={analytics.range} className="md:w-[220px]">
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

        <AdminGuideCard
          title="Como ler este bloco"
          description={`Os números abaixo mostram o período atual e, logo depois, uma comparação rápida com ${comparisonLabel}.`}
          className="mt-6"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            icon={<Eye className="h-5 w-5" />}
            title="Page views"
            value={String(analytics.pageViews)}
            description="Visualizações registradas na página pública do hotel no período atual."
          />
          <AdminStatCard
            icon={<MessageCircle className="h-5 w-5" />}
            title="Cliques em WhatsApp"
            value={String(analytics.whatsappClicks)}
            description="Interações com os botões de WhatsApp do hero, rodapé e CTA flutuante."
          />
          <AdminStatCard
            icon={<MousePointerClick className="h-5 w-5" />}
            title="Reservas e site"
            value={String(analytics.bookingAndWebsiteClicks)}
            description="Soma dos cliques em reservas e no site oficial do hotel."
          />
          <AdminStatCard
            icon={<Languages className="h-5 w-5" />}
            title="Trocas de idioma"
            value={String(analytics.languageSelections)}
            description="Seleções manuais de idioma feitas na experiência pública."
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 ring-1 ring-white/70">
            <p className="text-sm font-semibold text-slate-900">Leitura gerencial do período</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {analytics.totalEvents > 0
                ? `Foram registrados ${analytics.totalEvents} eventos no período atual. O comparativo usa ${comparisonLabel} como base de leitura.`
                : 'Ainda não há eventos suficientes neste período para gerar uma leitura operacional consistente.'}
            </p>

            {analytics.totalEvents > 0 ? (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                  <span>Cliques em reservas</span>
                  <span className="font-semibold text-slate-950">{analytics.bookingClicks}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                  <span>Cliques no site oficial</span>
                  <span className="font-semibold text-slate-950">{analytics.websiteClicks}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                  <span>Cliques em departamentos</span>
                  <span className="font-semibold text-slate-950">{analytics.departmentClicks}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                  <span>Total de eventos registrados</span>
                  <span className="font-semibold text-slate-950">{analytics.totalEvents}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-white px-4 py-6 text-sm text-slate-500 ring-1 ring-slate-200/70">
                Assim que a rota pública receber acessos e cliques principais, este bloco vai
                mostrar um resumo de uso mais útil para gestão.
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 ring-1 ring-white/70">
              <p className="text-sm font-semibold text-slate-900">Idiomas mais usados</p>
              <div className="mt-4 space-y-3">
                {analytics.languageUsage.some((item) => item.count > 0) ? (
                  analytics.languageUsage.map((item) => (
                    <div
                      key={item.language}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200/70"
                    >
                      <span className="font-medium uppercase tracking-[0.12em] text-slate-500">
                        {item.language}
                      </span>
                      <span className="font-semibold text-slate-950">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500 ring-1 ring-slate-200/70">
                    Ainda não há visualizações suficientes por idioma no período selecionado.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 ring-1 ring-white/70">
              <p className="text-sm font-semibold text-slate-900">Ações com mais engajamento</p>
              <div className="mt-4 space-y-3">
                {analytics.topActions.some((item) => item.count > 0) ? (
                  analytics.topActions.map((item) => (
                    <div
                      key={item.eventType}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200/70"
                    >
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-semibold text-slate-950">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500 ring-1 ring-slate-200/70">
                    Ainda não há cliques suficientes para ranquear as ações principais.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 ring-1 ring-white/70">
            <p className="text-sm font-semibold text-slate-900">Departamentos mais clicados</p>
            <div className="mt-4 space-y-3">
              {analytics.departmentUsage.length ? (
                analytics.departmentUsage.map((item) => (
                  <div
                    key={item.departmentId}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200/70"
                  >
                    <span className="font-medium text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-950">{item.count}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500 ring-1 ring-slate-200/70">
                  Nenhum clique em departamento foi registrado no período selecionado.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 ring-1 ring-white/70">
            <p className="text-sm font-semibold text-slate-900">Como interpretar estes dados</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200/70">
                Page views mostram o volume de uso real da experiência pública no período.
              </div>
              <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200/70">
                Reservas, site e WhatsApp indicam interesse mais próximo de conversão ou contato.
              </div>
              <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200/70">
                Idioma e departamentos ajudam a entender quais partes da jornada merecem revisão
                ou destaque.
              </div>
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

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <AdminSurface>
          <AdminSectionTitle eyebrow="Acesso rápido" title="Próximas ações recomendadas" />

          <AdminGuideCard
            title="Primeiros passos para operar o painel"
            description="Se esta for a primeira revisão do hotel, siga esta ordem para atualizar o LibGuest com mais segurança e clareza."
            className="mt-6"
          >
            <AdminHelpList
              items={[
                'Revise as informações do hotel para confirmar nome, links, Wi-Fi, horários e identidade visual.',
                'Depois organize serviços, departamentos e políticas para publicar apenas conteúdos já prontos para o hóspede.',
                'Finalize testando a rota pública no celular e validando idiomas, contatos e links principais.',
              ]}
            />
          </AdminGuideCard>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold text-slate-900">Revisar conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verifique descrições, textos de botões, horários e links finais do hotel.
              </p>
            </div>

            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold text-slate-900">Refinar apresentação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confira logo oficial, consistência visual e assinatura comercial do produto.
              </p>
            </div>

            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold text-slate-900">Testar jornada do hóspede</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Navegue pela rota pública e valide a experiência do LibGuest no celular.
              </p>
            </div>

            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold text-slate-900">Preparar demonstração</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Organize o link público para portfólio, QR Code e apresentação comercial.
              </p>
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
                Gestão ativa
              </AdminInfoBadge>
            }
          />

          <AdminGuideCard
            title="Como ler este painel"
            description="Os cards superiores mostram o estado operacional do hotel e o bloco de analytics resume o uso da experiência pública no período selecionado."
            className="mt-6"
          />

          <div className="mt-6 space-y-4">
            <div className="rounded-[26px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">LibGuest publicado</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A experiência pública já está online e pronta para demonstração.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Operação centralizada</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Serviços, departamentos e políticas podem ser gerenciados em um único painel.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Marca e conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O hotel já pode ajustar identidade visual e finalizar os textos da apresentação.
              </p>
            </div>
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
