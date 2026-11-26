import { translatePendingHotelServicesAction } from './translation-actions';
import { ServiceTranslationManager } from '@/components/admin/service-translation-manager';
import { serviceLanguageStatus } from '@/lib/services/service-editorial-fields';
import { buildRoomServiceHref } from '@/lib/public-routes';
import { GuestServiceFields } from '@/components/admin/guest-service-fields';
import {
  CheckCircle2,
  Eye,
  Languages,
  LayoutGrid,
  Pencil,
  Power,
} from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import { AdminConfirmAction } from '@/components/admin/confirm-action';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import {
  AdminActionGroup,
  AdminEmptyState,
  AdminFilterBar,
  AdminGuideCard,
  AdminHelpList,
  AdminHelpText,
  AdminInfoBadge,
  AdminInlineError,
  AdminLanguageBadge,
  AdminLinkButton,
  AdminListItem,
  AdminListSummary,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSearchInput,
  AdminSectionTitle,
  AdminSelect,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTranslationStatusPill,
} from '@/components/admin/ui';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import {
  getServiceActionTypeLabel,
} from '@/lib/service-action-types';
import { buildServiceCategoryOptions } from '@/lib/service-options';
import {
  getRetranslationHelpText,
  getTranslationAvailabilityDescription,
  getTranslationAvailabilityStatus,
  getTranslationWorkflowHelpItems,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  createSectionAction,
  deleteSectionAction,
  retranslateSectionAction,
  toggleSectionAction,
} from './actions';

interface AdminServicesPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
    q?: string;
    status?: string;
  }>;
}

type SectionTranslation = Database['public']['Tables']['hotel_section_translations']['Row'];

export default async function AdminServicesPage({
  searchParams,
}: AdminServicesPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const canManageServices = hasMinimumRole(profile.normalizedRole, 'operador');
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;
  const warning = params?.warning;
  const searchQuery = (params?.q || '').trim();
  const normalizedQuery = searchQuery.toLowerCase();
  const statusFilter =
    params?.status === 'active' || params?.status === 'inactive' ? params.status : 'all';

  const { data: sections, error } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar serviços do hotel.');
  }

  const sectionIds = sections?.map((item) => item.id) || [];
  const { data: sectionTranslations, error: translationError } = sectionIds.length
    ? await supabase
        .from('hotel_section_translations')
        .select('*')
        .in('section_id', sectionIds)
    : { data: [], error: null };

  if (translationError) {
    console.error('Erro ao carregar status de tradução dos serviços:', translationError);
  }

  const translationsBySectionId = new Map<string, SectionTranslation[]>();

  ((sectionTranslations || []) as Array<Pick<SectionTranslation, 'section_id' | 'language'>>).forEach(
    (translation) => {
      const currentTranslations = translationsBySectionId.get(translation.section_id) || [];
      currentTranslations.push(translation as SectionTranslation);
      translationsBySectionId.set(translation.section_id, currentTranslations);
    }
  );

  const {data:serviceModules}=await supabase.rpc('get_current_hotel_modules');
  const allowRoomActions=Boolean(serviceModules?.some(m=>m.module_key==='rooms.qr'&&m.is_enabled));

  const totalServices = sections?.length || 0;
  const activeServices = sections?.filter((item) => item.enabled).length || 0;
  const inactiveServices = totalServices - activeServices;
  const serviceCategoryOptions = buildServiceCategoryOptions(
    (sections || []).map((item) => item.category)
  );

  const filteredSections =
    sections?.filter((item) => {
      const matchesSearch = !normalizedQuery
        ? true
        : [item.title, item.content, item.category, item.cta, item.url, item.service_action_type]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? Boolean(item.enabled)
            : !item.enabled;

      return matchesSearch && matchesStatus;
    }) || [];

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'all';

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />
      <AdminInlineError message={errorMessage} />

      <AdminPageHero
        eyebrow="gestão de serviços"
        title="Serviços e seções do diretório"
        description="Cadastre, organize e mantenha atualizados os cards que aparecem para o hóspede no diretório digital."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
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
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Total de serviços"
          value={String(totalServices)}
          description="Quantidade total de cards cadastrados no diretório."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Ativos"
          value={String(activeServices)}
          description="Serviços atualmente visíveis para o hóspede."
        />
        <AdminStatCard
          icon={<Power className="h-5 w-5" />}
          title="Inativos"
          value={String(inactiveServices)}
          description="Itens cadastrados, mas temporariamente ocultos."
        />
        <AdminStatCard
          icon={<Languages className="h-5 w-5" />}
          title="Traduções"
          value="PT/EN/ES"
          description="Acompanhe o status por idioma e retraduza itens individuais quando necessário."
        />
      </section>

      <section className="space-y-6">
        {canManageServices ? (
          <AdminSurface className="min-w-0">
            <AdminSectionTitle
              eyebrow="Cadastro rápido"
              title="Novo serviço"
              description="Cadastre cards claros e operacionais para orientar o hóspede no diretório digital."
              action={<AdminInfoBadge>Publicação direta no diretório</AdminInfoBadge>}
            />



            <form action={createSectionAction} className="mt-6">
              <GuestServiceFields categoryOptions={serviceCategoryOptions} themePreset={hotel.theme_preset} hotelId={hotel.id} hotelSlug={hotel.slug} hotelSubdomain={hotel.subdomain} canonicalRoomHref={buildRoomServiceHref({slug:hotel.slug,language:'pt'})} allowRoomActions={allowRoomActions}/>
              <div className="mt-6"><AdminSubmitButton label="Criar serviço" pendingLabel="Salvando e traduzindo..."/></div>
            </form>
            <ServiceTranslationManager source={{title:'',content:null,category:null,cta:null}}/>

          </AdminSurface>
        ) : (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="Acesso em leitura"
              title="Visualização de serviços"
              description="Seu papel permite acompanhar os itens do diretório, mas sem criar, editar ou publicar alterações."
              action={<AdminInfoBadge>Modo leitura</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Como usar esta área"
              description="Você pode revisar títulos, tipos de ação, categorias, status e idiomas disponíveis para apoiar a operação e validação do conteúdo."
              className="mt-8"
            />
          </AdminSurface>
        )}

        <AdminSurface className="min-w-0">
          <AdminSectionTitle
            eyebrow="Itens cadastrados"
            title="Lista de serviços"
            description="Busque, filtre, edite, ative, retraduza ou remova cada card do diretório."
            action={<AdminListSummary total={filteredSections.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como acompanhar o status de tradução"
            description="Use esta leitura para entender o que já está traduzido, o que ainda depende de fallback em português e quando faz sentido retraduzir."
            className="mt-8"
          >
            <AdminHelpList items={getTranslationWorkflowHelpItems()} />
          </AdminGuideCard>

          {canManageServices&&serviceModules?.some(m=>m.module_key==='content.languages'&&m.is_enabled)?<form action={translatePendingHotelServicesAction} className="mt-4"><AdminSubmitButton label="Traduzir pendências deste hotel (até 5 serviços)" pendingLabel="Processando pendências..." variant="secondary"/></form>:null}
          <AdminHelpText className="mt-4">{getRetranslationHelpText()}</AdminHelpText>

          <AdminFilterBar>
            <AdminSearchInput
              aria-label="Buscar serviços"
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por título, categoria, descrição, ação ou botão"
            />
            <AdminSelect aria-label="Filtrar serviços por status" name="status" defaultValue={statusFilter} className="md:w-[190px]">
              <option value="all">Todos os status</option>
              <option value="active">Somente ativos</option>
              <option value="inactive">Somente inativos</option>
            </AdminSelect>
            <AdminPrimaryButton type="submit" className="h-11 px-4">
              Aplicar
            </AdminPrimaryButton>
            {hasActiveFilters ? (
              <AdminLinkButton href="/admin/servicos" className="h-11 px-4">
                Limpar
              </AdminLinkButton>
            ) : null}
          </AdminFilterBar>

          <div className="mt-6 space-y-4">
            {filteredSections.length ? (
              filteredSections.map((item) => {
                const availableLanguages = new Set((['en','es'] as const).filter(language=>serviceLanguageStatus(item,translationsBySectionId.get(item.id)?.find(row=>row.language===language),language).status==='current'));
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.title}
                    description={
                      <p className="line-clamp-3 break-words [overflow-wrap:anywhere]">
                        {item.content || 'Sem descrição cadastrada.'}
                      </p>
                    }
                    status={
                      <>
                        <AdminInfoBadge>{item.category || 'Sem categoria'}</AdminInfoBadge>
                        <AdminInfoBadge>
                          {getServiceActionTypeLabel(item.service_action_type)}
                        </AdminInfoBadge>
                        <AdminStatusPill active={Boolean(item.enabled)} />
                        <AdminTranslationStatusPill status={translationStatus} />
                      </>
                    }
                    meta={
                      <>
                        <span>Botão: {item.cta || '—'}</span>
                        <span>Ordem: {item.sort_order ?? 0}</span>
                        <span>{getTranslationAvailabilityDescription(translationStatus)}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminLanguageBadge label="PT" available source />
                          <AdminLanguageBadge label="EN" available={availableLanguages.has('en')} />
                          <AdminLanguageBadge label="ES" available={availableLanguages.has('es')} />
                        </div>
                      </>
                    }
                    actions={
                      canManageServices ? (
                        <AdminActionGroup>
                          <AdminLinkButton href={`/admin/servicos/${item.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </AdminLinkButton>

                          <form action={retranslateSectionAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <AdminSubmitButton label="Traduzir pendências" pendingLabel="Traduzindo..." variant="secondary" />
                          </form>

                          <form action={toggleSectionAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="enabled" value={String(!item.enabled)} />
                            <AdminSubmitButton label={item.enabled ? 'Desativar' : 'Ativar'} pendingLabel="Atualizando..." variant="secondary" />
                          </form>

                          <AdminConfirmAction
                            action={deleteSectionAction}
                            title="Excluir serviço?"
                            description={`O serviço “${item.title}” será removido do diretório e esta ação não poderá ser desfeita.`}
                            triggerLabel="Excluir"
                            confirmLabel="Excluir serviço"
                            pendingLabel="Excluindo..."
                            hiddenFields={[{ name: 'id', value: item.id }]}
                          />
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
                    ? 'Nenhum serviço encontrado com os filtros atuais'
                    : 'Nenhum serviço cadastrado ainda'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste o termo buscado ou revise o filtro de status para encontrar o card que deseja operar.'
                    : 'Crie o primeiro card para começar a montar o diretório digital do hóspede.'
                }
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
