import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Languages,
  Megaphone,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminDangerButton,
  AdminEmptyState,
  AdminField,
  AdminFilterBar,
  AdminGuideCard,
  AdminHelpList,
  AdminHelpText,
  AdminInfoBadge,
  AdminLanguageBadge,
  AdminLinkButton,
  AdminListItem,
  AdminListSummary,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSearchInput,
  AdminSecondaryButton,
  AdminSectionTitle,
  AdminSelect,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
  AdminTranslationStatusPill,
} from '@/components/admin/ui';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import {
  getAvailableTranslationLanguages,
  getRetranslationHelpText,
  getTranslationAvailabilityDescription,
  getTranslationAvailabilityStatus,
  getTranslationWorkflowHelpItems,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  retranslateAnnouncementAction,
  toggleAnnouncementAction,
} from './actions';

interface AdminAnnouncementsPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
    q?: string;
    status?: string;
  }>;
}

type Announcement = Database['public']['Tables']['hotel_announcements']['Row'];
type AnnouncementTranslation = Database['public']['Tables']['hotel_announcement_translations']['Row'];

function getAnnouncementCategoryLabel(category: string) {
  if (category === 'alerta') return 'Alerta';
  if (category === 'manutencao') return 'Manutenção';
  if (category === 'promocao') return 'Promoção';
  return 'Informativo';
}

function getAnnouncementWindowLabel(item: Announcement) {
  if (item.starts_at && item.ends_at) {
    return 'Período definido';
  }

  if (item.starts_at) {
    return 'Inicia em data programada';
  }

  if (item.ends_at) {
    return 'Ativo até a data final';
  }

  return 'Sem limite de período';
}

function getAnnouncementTimingStatus(item: Announcement, now: number) {
  if (!item.is_active) {
    return 'inactive';
  }

  const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null;
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;

  if (startsAt && startsAt > now) {
    return 'scheduled';
  }

  if (endsAt && endsAt < now) {
    return 'expired';
  }

  return 'active';
}

function getCurrentTimestamp() {
  return Date.now();
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: AdminAnnouncementsPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const canManageAnnouncements = hasMinimumRole(profile.normalizedRole, 'operador');
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;
  const warning = params?.warning;
  const searchQuery = (params?.q || '').trim();
  const normalizedQuery = searchQuery.toLowerCase();
  const allowedStatusFilters = new Set(['all', 'active', 'inactive', 'scheduled', 'expired']);
  const statusFilter = allowedStatusFilters.has(params?.status || '')
    ? (params?.status as 'all' | 'active' | 'inactive' | 'scheduled' | 'expired')
    : 'all';

  const { data: announcements, error } = await supabase
    .from('hotel_announcements')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('starts_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Erro ao carregar comunicados.');
  }

  const announcementIds = announcements?.map((item) => item.id) || [];
  const { data: announcementTranslations, error: translationError } = announcementIds.length
    ? await supabase
        .from('hotel_announcement_translations')
        .select('announcement_id, language')
        .in('announcement_id', announcementIds)
    : { data: [], error: null };

  if (translationError) {
    console.error('Erro ao carregar status de tradução dos comunicados:', translationError);
  }

  const translationsByAnnouncementId = new Map<string, AnnouncementTranslation[]>();

  ((announcementTranslations ||
    []) as Array<Pick<AnnouncementTranslation, 'announcement_id' | 'language'>>).forEach(
    (translation) => {
      const currentTranslations =
        translationsByAnnouncementId.get(translation.announcement_id) || [];
      currentTranslations.push(translation as AnnouncementTranslation);
      translationsByAnnouncementId.set(translation.announcement_id, currentTranslations);
    }
  );

  const now = getCurrentTimestamp();
  const totalAnnouncements = announcements?.length || 0;
  const activeAnnouncements =
    announcements?.filter((item) => getAnnouncementTimingStatus(item, now) === 'active').length ||
    0;
  const scheduledAnnouncements =
    announcements?.filter((item) => getAnnouncementTimingStatus(item, now) === 'scheduled')
      .length || 0;

  const filteredAnnouncements =
    announcements?.filter((item) => {
      const matchesSearch = !normalizedQuery
        ? true
        : [item.title, item.body]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const timingStatus = getAnnouncementTimingStatus(item, now);
      const matchesStatus = statusFilter === 'all' ? true : timingStatus === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="avisos do hotel"
        title="Comunicados gerais"
        description="Use comunicados para avisos temporários e informações importantes para hóspedes sem criar mensagens individuais ou dados pessoais."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Escopo</p>
              <p className="mt-2 text-lg font-semibold text-white">Avisos gerais públicos</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Megaphone className="h-5 w-5" />}
          title="Total de comunicados"
          value={String(totalAnnouncements)}
          description="Quantidade total de avisos cadastrados para o hotel."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Ativos agora"
          value={String(activeAnnouncements)}
          description="Comunicados públicos que podem aparecer ao hóspede neste momento."
        />
        <AdminStatCard
          icon={<CalendarClock className="h-5 w-5" />}
          title="Programados"
          value={String(scheduledAnnouncements)}
          description="Avisos ativos com início em data futura."
        />
        <AdminStatCard
          icon={<Languages className="h-5 w-5" />}
          title="Traduções"
          value="PT/EN/ES"
          description="Português é fonte. EN/ES são gerados ao salvar com fallback seguro em PT."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        {canManageAnnouncements ? (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="cadastro rápido"
              title="Novo comunicado"
              description="Comunicados ativos aparecem na página pública do hotel durante o período definido."
              action={<AdminInfoBadge>Role mínima: operador</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Boas práticas para avisos públicos"
              description="Para avisos urgentes, use título curto e mensagem objetiva."
              className="mt-8"
            >
              <AdminHelpList
                items={[
                  'Use este recurso para informações gerais e temporárias do hotel.',
                  'Não use comunicados para mensagens individuais ou dados pessoais de hóspedes.',
                  'Se o aviso tiver prazo, preencha início e fim para controlar a exibição pública.',
                ]}
              />
            </AdminGuideCard>

            <form action={createAnnouncementAction}>
              <div className="mt-8 grid gap-5">
                <AdminField label="Título">
                  <AdminTextInput name="title" required placeholder="Ex.: Manutenção na piscina" />
                  <AdminHelpText>
                    Prefira títulos curtos e fáceis de entender em celular.
                  </AdminHelpText>
                </AdminField>

                <AdminField label="Mensagem">
                  <AdminTextarea
                    name="body"
                    className="min-h-36"
                    placeholder="Explique o aviso de forma simples e objetiva."
                  />
                  <AdminHelpText>
                    Português é o conteúdo fonte. EN e ES são gerados ao salvar.
                  </AdminHelpText>
                </AdminField>

                <div className="grid gap-5 md:grid-cols-2">
                  <AdminField label="Categoria">
                    <AdminSelect name="category" defaultValue="informativo">
                      <option value="informativo">Informativo</option>
                      <option value="alerta">Alerta</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="promocao">Promoção</option>
                    </AdminSelect>
                  </AdminField>

                  <AdminField label="Status">
                    <AdminCheckboxRow>
                      <input type="checkbox" name="is_active" defaultChecked />
                      Ativo para exibição pública
                    </AdminCheckboxRow>
                  </AdminField>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <AdminField label="Início (opcional)">
                    <AdminTextInput name="starts_at" type="datetime-local" />
                  </AdminField>

                  <AdminField label="Fim (opcional)">
                    <AdminTextInput name="ends_at" type="datetime-local" />
                  </AdminField>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <AdminPrimaryButton type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar comunicado
                </AdminPrimaryButton>

                <AdminInfoBadge>
                  <Sparkles className="h-3.5 w-3.5" />
                  Avisos ativos aparecem para todos os hóspedes do hotel
                </AdminInfoBadge>
              </div>
            </form>
          </AdminSurface>
        ) : (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="acesso em leitura"
              title="Visualização de comunicados"
              description="Seu papel permite revisar os comunicados do hotel sem criar, editar ou publicar mudanças."
              action={<AdminInfoBadge>Modo leitura</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Como usar esta área"
              description="Acompanhe status, período e idiomas disponíveis nos avisos públicos do hotel."
              className="mt-8"
            />
          </AdminSurface>
        )}

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="avisos cadastrados"
            title="Lista de comunicados"
            description="Acompanhe avisos ativos, programados, expirados ou em fallback de tradução sem depender de mensagens individuais."
            action={<AdminListSummary total={filteredAnnouncements.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como acompanhar a publicação pública"
            description="Use esta leitura para confirmar o que está visível agora, o que ainda vai entrar no ar e quando o hóspede pode ver fallback em português."
            className="mt-8"
          >
            <AdminHelpList items={getTranslationWorkflowHelpItems()} />
          </AdminGuideCard>

          <AdminHelpText className="mt-4">{getRetranslationHelpText()}</AdminHelpText>

          <AdminFilterBar>
            <AdminSearchInput
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por título ou mensagem"
            />
            <AdminSelect name="status" defaultValue={statusFilter} className="md:w-[220px]">
              <option value="all">Todos os status</option>
              <option value="active">Ativos agora</option>
              <option value="scheduled">Programados</option>
              <option value="expired">Expirados</option>
              <option value="inactive">Inativos</option>
            </AdminSelect>
            <AdminPrimaryButton type="submit" className="h-11 px-4">
              Aplicar
            </AdminPrimaryButton>
            {hasActiveFilters ? (
              <AdminLinkButton href="/admin/comunicados" className="h-11 px-4">
                Limpar
              </AdminLinkButton>
            ) : null}
          </AdminFilterBar>

          <div className="mt-6 space-y-4">
            {filteredAnnouncements.length ? (
              filteredAnnouncements.map((item) => {
                const availableLanguages = getAvailableTranslationLanguages(
                  translationsByAnnouncementId.get(item.id) || []
                );
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);
                const timingStatus = getAnnouncementTimingStatus(item, now);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.title}
                    description={item.body || 'Sem mensagem complementar cadastrada.'}
                    status={
                      <>
                        <AdminStatusPill
                          active={Boolean(item.is_active)}
                          activeText="Ativo"
                          inactiveText="Inativo"
                        />
                        <AdminTranslationStatusPill status={translationStatus} />
                      </>
                    }
                    meta={
                      <>
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {getAnnouncementCategoryLabel(item.category)}
                        </span>
                        <span>{getAnnouncementWindowLabel(item)}</span>
                        <span>
                          {timingStatus === 'scheduled'
                            ? 'Ainda não visível publicamente'
                            : timingStatus === 'expired'
                              ? 'Fora do período público'
                              : timingStatus === 'inactive'
                                ? 'Oculto no momento'
                                : 'Visível para hóspedes quando acessarem o diretório'}
                        </span>
                        <span>{getTranslationAvailabilityDescription(translationStatus)}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminLanguageBadge label="PT" available source />
                          <AdminLanguageBadge label="EN" available={availableLanguages.has('en')} />
                          <AdminLanguageBadge label="ES" available={availableLanguages.has('es')} />
                        </div>
                      </>
                    }
                    actions={
                      canManageAnnouncements ? (
                        <AdminActionGroup>
                          <AdminLinkButton href={`/admin/comunicados/${item.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </AdminLinkButton>

                          <form action={retranslateAnnouncementAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <AdminSecondaryButton type="submit">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retraduzir
                            </AdminSecondaryButton>
                          </form>

                          <form action={toggleAnnouncementAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="is_active"
                              value={String(!item.is_active)}
                            />
                            <AdminSecondaryButton type="submit">
                              <Power className="mr-2 h-4 w-4" />
                              {item.is_active ? 'Desativar' : 'Ativar'}
                            </AdminSecondaryButton>
                          </form>

                          <form action={deleteAnnouncementAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <AdminDangerButton type="submit">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </AdminDangerButton>
                          </form>
                        </AdminActionGroup>
                      ) : null
                    }
                  />
                );
              })
            ) : (
              <AdminEmptyState
                title={
                  hasActiveFilters
                    ? 'Nenhum comunicado encontrado com os filtros atuais'
                    : 'Nenhum comunicado cadastrado ainda'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou revise o filtro de status para localizar o aviso desejado.'
                    : 'Crie o primeiro comunicado para publicar avisos gerais do hotel sem depender de mensagens individuais.'
                }
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
