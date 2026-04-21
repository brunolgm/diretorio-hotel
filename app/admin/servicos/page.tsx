import {
  CheckCircle2,
  Eye,
  FileText,
  Languages,
  LayoutGrid,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ServiceGuidedFields } from '@/components/admin/service-guided-fields';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminDangerButton,
  AdminEmptyState,
  AdminField,
  AdminFilterBar,
  AdminFormGrid,
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
import { buildServiceCategoryOptions } from '@/lib/service-options';
import {
  getAvailableTranslationLanguages,
  getTranslationAvailabilityStatus,
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
        .select('section_id, language')
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
        : [item.title, item.content, item.category, item.cta]
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        {canManageServices ? (
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Cadastro rápido"
            title="Novo serviço"
            description="Adicione um novo card com título, categoria, descrição, botão e link."
            action={<AdminInfoBadge>Publicação direta no diretório</AdminInfoBadge>}
          />

          <AdminGuideCard
            title="Como cadastrar um bom serviço"
            description="Use cards curtos, objetivos e orientados à ação para facilitar a leitura do hóspede no celular."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Prefira títulos curtos e categorias fáceis de reconhecer.',
                'Use a descrição para explicar o benefício ou o que o hóspede encontra ao tocar no card.',
                'Revise o link final sempre que o botão levar para uma reserva, site ou página externa.',
              ]}
            />
          </AdminGuideCard>

          <form action={createSectionAction}>
            <AdminFormGrid>
              <AdminField label="Título" className="md:col-span-2">
                <AdminTextInput name="title" required />
                <AdminHelpText>
                  Este é o texto principal do card. Prefira algo fácil de escanear.
                </AdminHelpText>
              </AdminField>

              <ServiceGuidedFields categoryOptions={serviceCategoryOptions} />

              <AdminField label="Descrição" className="md:col-span-2">
                <AdminTextarea
                  name="content"
                  placeholder="Descreva o serviço que será exibido no diretório."
                />
                <AdminHelpText>
                  Explique em uma ou duas frases o que o hóspede encontra ao abrir este item.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Texto do botão">
                <AdminTextInput name="cta" placeholder="Ex.: Ver mais" />
                <AdminHelpText>
                  O botão deve indicar a próxima ação, como ver detalhes ou abrir um link.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Link">
                <AdminTextInput name="url" placeholder="https://..." />
                <AdminHelpText>
                  Preencha somente quando o card realmente precisar abrir uma página externa.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Ordem">
                <AdminTextInput type="number" name="sort_order" defaultValue="0" />
                <AdminHelpText>
                  Números menores aparecem primeiro e ajudam a destacar o que é mais importante.
                </AdminHelpText>
              </AdminField>

              <AdminCheckboxRow className="md:col-span-2">
                <input type="checkbox" name="enabled" defaultChecked />
                Ativo no diretório
              </AdminCheckboxRow>
            </AdminFormGrid>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AdminPrimaryButton type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Criar serviço
              </AdminPrimaryButton>

              <AdminInfoBadge>
                <FileText className="h-3.5 w-3.5" />
                Os serviços aparecem automaticamente no diretório público
              </AdminInfoBadge>
            </div>
          </form>
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
              description="Você pode revisar títulos, categorias, status e idiomas disponíveis para apoiar a operação e validação do conteúdo."
              className="mt-8"
            />
          </AdminSurface>
        )}

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Itens cadastrados"
            title="Lista de serviços"
            description="Busque, filtre, edite, ative, retraduza ou remova cada card do diretório."
            action={<AdminListSummary total={filteredSections.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como acompanhar esta lista"
            description="Os badges de idioma mostram rapidamente o que já está disponível em PT, EN e ES. Use retradução quando um item for atualizado."
            className="mt-8"
          />

          <AdminFilterBar>
            <AdminSearchInput
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por título, categoria, descrição ou botão"
            />
            <AdminSelect name="status" defaultValue={statusFilter} className="md:w-[190px]">
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
                const availableLanguages = getAvailableTranslationLanguages(
                  translationsBySectionId.get(item.id) || []
                );
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.title}
                    description={item.content || 'Sem descrição cadastrada.'}
                    status={
                      <>
                        <AdminInfoBadge>{item.category || 'Sem categoria'}</AdminInfoBadge>
                        <AdminStatusPill active={Boolean(item.enabled)} />
                        <AdminTranslationStatusPill status={translationStatus} />
                      </>
                    }
                    meta={
                      <>
                        <span>Botão: {item.cta || '—'}</span>
                        <span>Ordem: {item.sort_order ?? 0}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminLanguageBadge label="PT" available />
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
                            <AdminSecondaryButton type="submit">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retraduzir
                            </AdminSecondaryButton>
                          </form>

                          <form action={toggleSectionAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="enabled" value={String(!item.enabled)} />
                            <AdminSecondaryButton type="submit">
                              <Power className="mr-2 h-4 w-4" />
                              {item.enabled ? 'Desativar' : 'Ativar'}
                            </AdminSecondaryButton>
                          </form>

                          <form action={deleteSectionAction}>
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
