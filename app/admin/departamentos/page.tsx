import {
  CheckCircle2,
  Clock3,
  Languages,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
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
import { getAdminHotel } from '@/lib/queries';
import {
  getAvailableTranslationLanguages,
  getTranslationAvailabilityStatus,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  createDepartmentAction,
  deleteDepartmentAction,
  retranslateDepartmentAction,
  toggleDepartmentAction,
} from './actions';

interface AdminDepartmentsPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
    q?: string;
    status?: string;
  }>;
}

type DepartmentTranslation = Database['public']['Tables']['hotel_department_translations']['Row'];

export default async function AdminDepartmentsPage({
  searchParams,
}: AdminDepartmentsPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;
  const warning = params?.warning;
  const searchQuery = (params?.q || '').trim();
  const normalizedQuery = searchQuery.toLowerCase();
  const statusFilter =
    params?.status === 'active' || params?.status === 'inactive' ? params.status : 'all';

  const { data: departments, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar departamentos.');
  }

  const departmentIds = departments?.map((item) => item.id) || [];
  const { data: departmentTranslations, error: translationError } = departmentIds.length
    ? await supabase
        .from('hotel_department_translations')
        .select('department_id, language')
        .in('department_id', departmentIds)
    : { data: [], error: null };

  if (translationError) {
    console.error('Erro ao carregar status de tradução dos departamentos:', translationError);
  }

  const translationsByDepartmentId = new Map<string, DepartmentTranslation[]>();

  ((departmentTranslations || []) as Array<
    Pick<DepartmentTranslation, 'department_id' | 'language'>
  >).forEach((translation) => {
    const currentTranslations = translationsByDepartmentId.get(translation.department_id) || [];
    currentTranslations.push(translation as DepartmentTranslation);
    translationsByDepartmentId.set(translation.department_id, currentTranslations);
  });

  const totalDepartments = departments?.length || 0;
  const activeDepartments = departments?.filter((item) => item.enabled).length || 0;
  const inactiveDepartments = totalDepartments - activeDepartments;

  const filteredDepartments =
    departments?.filter((item) => {
      const matchesSearch = !normalizedQuery
        ? true
        : [item.name, item.description, item.action, item.hours]
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
        eyebrow="gestão de departamentos"
        title="Departamentos e contatos"
        description="Gerencie os setores que o hóspede pode acionar diretamente no diretório digital, com clareza, organização e resposta rápida."
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
          icon={<Users className="h-5 w-5" />}
          title="Total de departamentos"
          value={String(totalDepartments)}
          description="Quantidade total de setores cadastrados no painel."
        />
        <AdminStatCard
          icon={<Phone className="h-5 w-5" />}
          title="Ativos"
          value={String(activeDepartments)}
          description="Setores atualmente visíveis para contato no diretório."
        />
        <AdminStatCard
          icon={<Power className="h-5 w-5" />}
          title="Inativos"
          value={String(inactiveDepartments)}
          description="Departamentos cadastrados, mas ocultos no momento."
        />
        <AdminStatCard
          icon={<Languages className="h-5 w-5" />}
          title="Traduções"
          value="PT/EN/ES"
          description="Verifique idiomas disponíveis e refaça traduções de canais específicos."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Cadastro rápido"
            title="Novo departamento"
            description="Cadastre setores como Recepção, Reservas, Governança, Eventos e outros canais de atendimento do hotel."
            action={<AdminInfoBadge>Canal disponível no diretório</AdminInfoBadge>}
          />

          <AdminGuideCard
            title="Como organizar os canais de atendimento"
            description="Cada departamento deve deixar claro quem atende, quando atende e qual ação o hóspede pode realizar."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Use nomes familiares como Recepção, Reservas, Governança ou Eventos.',
                'Informe horário sempre que o canal não funcionar 24 horas.',
                'Revise o link final para garantir que o hóspede caia no atendimento correto.',
              ]}
            />
          </AdminGuideCard>

          <form action={createDepartmentAction}>
            <AdminFormGrid>
              <AdminField label="Nome" className="md:col-span-2">
                <AdminTextInput name="name" required placeholder="Ex.: Recepção" />
                <AdminHelpText>
                  Este nome aparece no diretório público e deve ser fácil de reconhecer.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Descrição" className="md:col-span-2">
                <AdminTextarea
                  name="description"
                  placeholder="Descreva como esse departamento atende o hóspede."
                />
                <AdminHelpText>
                  Explique rapidamente quando este canal deve ser usado pelo hóspede.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Horário">
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput name="hours" className="pl-11" placeholder="Ex.: 24 horas" />
                </div>
                <AdminHelpText>
                  Se o atendimento tiver janela específica, informe isso para evitar frustração.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Texto do botão">
                <AdminTextInput name="action" placeholder="Ex.: Falar com a Recepção" />
                <AdminHelpText>
                  O texto do botão deve indicar claramente o próximo passo.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Link" className="md:col-span-2">
                <div className="relative">
                  <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    name="url"
                    className="pl-11"
                    placeholder="https://... ou link do WhatsApp"
                  />
                </div>
                <AdminHelpText>
                  Você pode usar links de WhatsApp, páginas externas ou outro canal direto do hotel.
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
                Criar departamento
              </AdminPrimaryButton>

              <AdminInfoBadge>
                <Sparkles className="h-3.5 w-3.5" />
                Os contatos aparecem automaticamente para o hóspede
              </AdminInfoBadge>
            </div>
          </form>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Setores cadastrados"
            title="Lista de departamentos"
            description="Busque, filtre, edite, ative, retraduza ou remova os canais de atendimento disponíveis."
            action={<AdminListSummary total={filteredDepartments.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como acompanhar esta lista"
            description="Use o status para ver o que já está publicado e os badges de idioma para identificar rapidamente quais versões estão disponíveis."
            className="mt-8"
          />

          <AdminFilterBar>
            <AdminSearchInput
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por nome, descrição, botão ou horário"
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
              <AdminLinkButton href="/admin/departamentos" className="h-11 px-4">
                Limpar
              </AdminLinkButton>
            ) : null}
          </AdminFilterBar>

          <div className="mt-6 space-y-4">
            {filteredDepartments.length ? (
              filteredDepartments.map((item) => {
                const availableLanguages = getAvailableTranslationLanguages(
                  translationsByDepartmentId.get(item.id) || []
                );
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.name}
                    description={item.description || 'Sem descrição cadastrada.'}
                    status={
                      <>
                        <AdminStatusPill active={Boolean(item.enabled)} />
                        <AdminTranslationStatusPill status={translationStatus} />
                      </>
                    }
                    meta={
                      <>
                        <span>Horário: {item.hours || 'Não informado'}</span>
                        <span>Botão: {item.action || '—'}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminLanguageBadge label="PT" available />
                          <AdminLanguageBadge label="EN" available={availableLanguages.has('en')} />
                          <AdminLanguageBadge label="ES" available={availableLanguages.has('es')} />
                        </div>
                      </>
                    }
                    actions={
                      <AdminActionGroup>
                        <AdminLinkButton href={`/admin/departamentos/${item.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </AdminLinkButton>

                        <form action={retranslateDepartmentAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <AdminSecondaryButton type="submit">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retraduzir
                          </AdminSecondaryButton>
                        </form>

                        <form action={toggleDepartmentAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="enabled" value={String(!item.enabled)} />
                          <AdminSecondaryButton type="submit">
                            <Power className="mr-2 h-4 w-4" />
                            {item.enabled ? 'Desativar' : 'Ativar'}
                          </AdminSecondaryButton>
                        </form>

                        <form action={deleteDepartmentAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <AdminDangerButton type="submit">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </AdminDangerButton>
                        </form>
                      </AdminActionGroup>
                    }
                  />
                );
              })
            ) : (
              <AdminEmptyState
                title={
                  hasActiveFilters
                    ? 'Nenhum departamento encontrado com os filtros atuais'
                    : 'Nenhum departamento cadastrado ainda'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou revise o filtro de status para localizar o canal desejado.'
                    : 'Crie o primeiro setor de atendimento para mostrar ao hóspede quem deve ser acionado em cada situação.'
                }
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
