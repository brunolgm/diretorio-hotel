import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Images,
  Languages,
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
  createPromotionalBannerAction,
  deletePromotionalBannerAction,
  retranslatePromotionalBannerAction,
  togglePromotionalBannerAction,
} from './actions';

interface AdminBannersPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
    q?: string;
    status?: string;
  }>;
}

type Banner = Database['public']['Tables']['hotel_promotional_banners']['Row'];
type BannerTranslation =
  Database['public']['Tables']['hotel_promotional_banner_translations']['Row'];

function getBannerTimingStatus(item: Banner, now: number) {
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

function getBannerWindowLabel(item: Banner) {
  if (item.starts_at && item.ends_at) {
    return 'Período definido';
  }

  if (item.starts_at) {
    return 'Início programado';
  }

  if (item.ends_at) {
    return 'Ativo até a data final';
  }

  return 'Sem limite de período';
}

function getCurrentTimestamp() {
  return Date.now();
}

export default async function AdminBannersPage({ searchParams }: AdminBannersPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const canManageBanners = hasMinimumRole(profile.normalizedRole, 'operador');
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

  const { data: banners, error } = await supabase
    .from('hotel_promotional_banners')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('display_order', { ascending: true })
    .order('starts_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Erro ao carregar banners promocionais.');
  }

  const bannerIds = banners?.map((item) => item.id) || [];
  const { data: bannerTranslations, error: translationError } = bannerIds.length
    ? await supabase
        .from('hotel_promotional_banner_translations')
        .select('banner_id, language')
        .in('banner_id', bannerIds)
    : { data: [], error: null };

  if (translationError) {
    console.error('Erro ao carregar status de tradução dos banners:', translationError);
  }

  const translationsByBannerId = new Map<string, BannerTranslation[]>();

  ((bannerTranslations || []) as Array<Pick<BannerTranslation, 'banner_id' | 'language'>>).forEach(
    (translation) => {
      const currentTranslations = translationsByBannerId.get(translation.banner_id) || [];
      currentTranslations.push(translation as BannerTranslation);
      translationsByBannerId.set(translation.banner_id, currentTranslations);
    }
  );

  const now = getCurrentTimestamp();
  const totalBanners = banners?.length || 0;
  const activeBanners =
    banners?.filter((item) => getBannerTimingStatus(item, now) === 'active').length || 0;
  const scheduledBanners =
    banners?.filter((item) => getBannerTimingStatus(item, now) === 'scheduled').length || 0;

  const filteredBanners =
    banners?.filter((item) => {
      const matchesSearch = !normalizedQuery
        ? true
        : [item.title, item.subtitle, item.cta_label]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const timingStatus = getBannerTimingStatus(item, now);
      const matchesStatus = statusFilter === 'all' ? true : timingStatus === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="banners promocionais"
        title="Destaques visuais do hotel"
        description="Use banners para promoções, campanhas e destaques visuais que merecem mais evidência do que um comunicado operacional."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Exibição pública</p>
              <p className="mt-2 text-lg font-semibold text-white">No máximo 3 banners</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Images className="h-5 w-5" />}
          title="Total de banners"
          value={String(totalBanners)}
          description="Quantidade total de banners promocionais cadastrados para o hotel."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Elegíveis agora"
          value={String(activeBanners)}
          description="Banners públicos que podem entrar no carrossel neste momento."
        />
        <AdminStatCard
          icon={<CalendarClock className="h-5 w-5" />}
          title="Programados"
          value={String(scheduledBanners)}
          description="Banners ativos com início em data futura."
        />
        <AdminStatCard
          icon={<Languages className="h-5 w-5" />}
          title="Traduções"
          value="PT/EN/ES"
          description="Português é fonte. EN/ES são gerados ao salvar com fallback seguro em PT."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        {canManageBanners ? (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="cadastro rápido"
              title="Novo banner promocional"
              description="Banners ativos e elegíveis aparecem em carrossel na página pública, limitados a no máximo 3 destaques."
              action={<AdminInfoBadge>Role mínima: operador</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Boas práticas de imagem"
              description="Prefira imagens nítidas, horizontais e com foco visual claro para evitar cortes desconfortáveis no mobile."
              className="mt-8"
            >
              <AdminHelpList
                items={[
                  'Tamanho ideal: 1600 x 600 px.',
                  'Proporção ideal: 8:3.',
                  'Mínimo recomendado: 1200 x 450 px.',
                  'Formatos aceitos: JPG, PNG e WEBP.',
                  'Peso ideal até 1,5 MB e máximo técnico de 2 MB.',
                  'Imagens fora da proporção podem sofrer corte visual com object-fit.',
                ]}
              />
            </AdminGuideCard>

            <form action={createPromotionalBannerAction}>
              <div className="mt-8 grid gap-5">
                <AdminField label="Título">
                  <AdminTextInput
                    name="title"
                    required
                    placeholder="Ex.: Menu especial do fim de semana"
                  />
                </AdminField>

                <AdminField label="Texto curto">
                  <AdminTextarea
                    name="subtitle"
                    className="min-h-32"
                    placeholder="Descreva o destaque de forma objetiva e atraente."
                  />
                  <AdminHelpText>
                    Português é o conteúdo fonte. EN e ES são gerados ao salvar.
                  </AdminHelpText>
                </AdminField>

                <div className="grid gap-5 md:grid-cols-2">
                  <AdminField label="Texto do CTA">
                    <AdminTextInput name="cta_label" placeholder="Ex.: Ver detalhes" />
                  </AdminField>

                  <AdminField label="URL do CTA">
                    <AdminTextInput name="cta_url" placeholder="https://..." />
                  </AdminField>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <AdminField label="Ordem de exibição">
                    <AdminTextInput name="display_order" type="number" min="0" defaultValue="0" />
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
                  Criar banner
                </AdminPrimaryButton>

                <AdminInfoBadge>
                  <Sparkles className="h-3.5 w-3.5" />
                  A imagem pode ser enviada logo após salvar o banner
                </AdminInfoBadge>
              </div>
            </form>
          </AdminSurface>
        ) : (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="acesso em leitura"
              title="Visualização de banners"
              description="Seu papel permite revisar os banners promocionais do hotel sem criar, editar ou publicar mudanças."
              action={<AdminInfoBadge>Modo leitura</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Como usar esta área"
              description="Acompanhe ordem de exibição, janela pública, imagem e idiomas disponíveis nos destaques visuais do hotel."
              className="mt-8"
            />
          </AdminSurface>
        )}

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="banners cadastrados"
            title="Lista de banners"
            description="Acompanhe banners ativos, programados, expirados ou em fallback de tradução antes de revisar a página pública."
            action={<AdminListSummary total={filteredBanners.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como revisar a exibição pública"
            description="Use esta leitura para confirmar ordem, imagem, período e disponibilidade de idiomas antes de validar o carrossel no hotel."
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
              placeholder="Buscar por título, texto curto ou CTA"
            />
            <AdminSelect name="status" defaultValue={statusFilter} className="md:w-[220px]">
              <option value="all">Todos os status</option>
              <option value="active">Elegíveis agora</option>
              <option value="scheduled">Programados</option>
              <option value="expired">Expirados</option>
              <option value="inactive">Inativos</option>
            </AdminSelect>
            <AdminPrimaryButton type="submit" className="h-11 px-4">
              Aplicar
            </AdminPrimaryButton>
            {hasActiveFilters ? (
              <AdminLinkButton href="/admin/banners" className="h-11 px-4">
                Limpar
              </AdminLinkButton>
            ) : null}
          </AdminFilterBar>

          <div className="mt-6 space-y-4">
            {filteredBanners.length ? (
              filteredBanners.map((item) => {
                const availableLanguages = getAvailableTranslationLanguages(
                  translationsByBannerId.get(item.id) || []
                );
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);
                const timingStatus = getBannerTimingStatus(item, now);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.title}
                    description={item.subtitle || 'Sem texto complementar cadastrado.'}
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
                          Ordem {item.display_order}
                        </span>
                        <span>{getBannerWindowLabel(item)}</span>
                        <span>
                          {item.image_url
                            ? 'Imagem configurada'
                            : 'Sem imagem: o banner usará fallback visual'}
                        </span>
                        <span>
                          {timingStatus === 'scheduled'
                            ? 'Ainda não elegível publicamente'
                            : timingStatus === 'expired'
                              ? 'Fora do período público'
                              : timingStatus === 'inactive'
                                ? 'Oculto no momento'
                                : 'Pode entrar no carrossel público se estiver entre os 3 primeiros'}
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
                      canManageBanners ? (
                        <AdminActionGroup>
                          <AdminLinkButton href={`/admin/banners/${item.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </AdminLinkButton>

                          <form action={retranslatePromotionalBannerAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <AdminSecondaryButton type="submit">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retraduzir
                            </AdminSecondaryButton>
                          </form>

                          <form action={togglePromotionalBannerAction}>
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

                          <form action={deletePromotionalBannerAction}>
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
                    ? 'Nenhum banner encontrado com os filtros atuais'
                    : 'Nenhum banner cadastrado ainda'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou revise o filtro de status para localizar o banner desejado.'
                    : 'Crie o primeiro banner para destacar promoções e experiências visuais do hotel na página pública.'
                }
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
