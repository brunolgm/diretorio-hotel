import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
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
  createPolicyAction,
  deletePolicyAction,
  retranslatePolicyAction,
  togglePolicyAction,
} from './actions';

interface AdminPoliciesPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
    q?: string;
    status?: string;
  }>;
}

type PolicyTranslation = Database['public']['Tables']['hotel_policy_translations']['Row'];

export default async function AdminPoliciesPage({
  searchParams,
}: AdminPoliciesPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const canManagePolicies = hasMinimumRole(profile.normalizedRole, 'operador');
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;
  const warning = params?.warning;
  const searchQuery = (params?.q || '').trim();
  const normalizedQuery = searchQuery.toLowerCase();
  const statusFilter =
    params?.status === 'active' || params?.status === 'inactive' ? params.status : 'all';

  const { data: policies, error } = await supabase
    .from('hotel_policies')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar políticas.');
  }

  const policyIds = policies?.map((item) => item.id) || [];
  const { data: policyTranslations, error: translationError } = policyIds.length
    ? await supabase
        .from('hotel_policy_translations')
        .select('policy_id, language')
        .in('policy_id', policyIds)
    : { data: [], error: null };

  if (translationError) {
    console.error('Erro ao carregar status de tradução das políticas:', translationError);
  }

  const translationsByPolicyId = new Map<string, PolicyTranslation[]>();

  ((policyTranslations || []) as Array<Pick<PolicyTranslation, 'policy_id' | 'language'>>).forEach(
    (translation) => {
      const currentTranslations = translationsByPolicyId.get(translation.policy_id) || [];
      currentTranslations.push(translation as PolicyTranslation);
      translationsByPolicyId.set(translation.policy_id, currentTranslations);
    }
  );

  const totalPolicies = policies?.length || 0;
  const activePolicies = policies?.filter((item) => item.enabled).length || 0;
  const inactivePolicies = totalPolicies - activePolicies;

  const filteredPolicies =
    policies?.filter((item) => {
      const matchesSearch = !normalizedQuery
        ? true
        : [item.title, item.description]
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
        eyebrow="regras do hotel"
        title="Políticas e orientações"
        description="Organize as regras, orientações e informações institucionais que precisam estar claras para o hóspede durante toda a estadia."
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
          icon={<FileText className="h-5 w-5" />}
          title="Total de políticas"
          value={String(totalPolicies)}
          description="Quantidade total de regras e orientações cadastradas."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Ativas"
          value={String(activePolicies)}
          description="Políticas atualmente visíveis no diretório público."
        />
        <AdminStatCard
          icon={<Power className="h-5 w-5" />}
          title="Inativas"
          value={String(inactivePolicies)}
          description="Políticas cadastradas, mas ocultas no momento."
        />
        <AdminStatCard
          icon={<Languages className="h-5 w-5" />}
          title="Traduções"
          value="PT/EN/ES"
          description="Monitore idiomas disponíveis e refaça traduções quando necessário."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        {canManagePolicies ? (
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Cadastro rápido"
            title="Nova política"
            description="Cadastre regras como check-in, check-out, não fumante, pets, uso de áreas comuns e demais orientações importantes."
            action={<AdminInfoBadge>Regras visíveis ao hóspede</AdminInfoBadge>}
          />

          <AdminGuideCard
            title="Como escrever políticas claras"
            description="Políticas bem escritas reduzem dúvidas operacionais e deixam a experiência do hóspede mais previsível."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Use títulos diretos, como Não fumar, Horário de silêncio ou Política pet.',
                'Explique a regra em linguagem simples, evitando termos internos da operação.',
                'Se a orientação for muito importante, mantenha o item ativo e revise as traduções após alterações.',
              ]}
            />
          </AdminGuideCard>

          <form action={createPolicyAction}>
            <div className="mt-8 grid gap-5">
              <AdminField label="Título">
                <AdminTextInput name="title" required placeholder="Ex.: Não fumar" />
                <AdminHelpText>
                  O título deve deixar a regra evidente logo na primeira leitura.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Descrição">
                <AdminTextarea
                  name="description"
                  className="min-h-36"
                  placeholder="Descreva claramente a política para o hóspede."
                />
                <AdminHelpText>
                  Explique o que é permitido, o que não é e qualquer condição importante.
                </AdminHelpText>
              </AdminField>

              <AdminCheckboxRow>
                <input type="checkbox" name="enabled" defaultChecked />
                Ativa no diretório
              </AdminCheckboxRow>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AdminPrimaryButton type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Criar política
              </AdminPrimaryButton>

              <AdminInfoBadge>
                <Sparkles className="h-3.5 w-3.5" />
                As políticas aparecem automaticamente no diretório
              </AdminInfoBadge>
            </div>
          </form>
        </AdminSurface>
        ) : (
          <AdminSurface>
            <AdminSectionTitle
              eyebrow="Acesso em leitura"
              title="Visualização de políticas"
              description="Seu papel permite revisar as políticas do hotel sem criar, editar ou publicar mudanças."
              action={<AdminInfoBadge>Modo leitura</AdminInfoBadge>}
            />

            <AdminGuideCard
              title="Como usar esta área"
              description="Acompanhe status, idiomas e clareza das regras exibidas ao hóspede sem alterar o conteúdo."
              className="mt-8"
            />
          </AdminSurface>
        )}

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Políticas cadastradas"
            title="Lista de políticas"
            description="Busque, filtre, edite, ative, retraduza ou remova as regras exibidas para o hóspede."
            action={<AdminListSummary total={filteredPolicies.length} label="resultado(s)" />}
          />

          <AdminGuideCard
            title="Como acompanhar o status de tradução"
            description="Use esta leitura para saber quando a política já está pronta em EN/ES e quando a experiência pública ainda pode depender de fallback em português."
            className="mt-8"
          >
            <AdminHelpList items={getTranslationWorkflowHelpItems()} />
          </AdminGuideCard>

          <AdminHelpText className="mt-4">
            {getRetranslationHelpText()}
          </AdminHelpText>

          <AdminFilterBar>
            <AdminSearchInput
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por título ou descrição"
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
              <AdminLinkButton href="/admin/politicas" className="h-11 px-4">
                Limpar
              </AdminLinkButton>
            ) : null}
          </AdminFilterBar>

          <div className="mt-6 space-y-4">
            {filteredPolicies.length ? (
              filteredPolicies.map((item) => {
                const availableLanguages = getAvailableTranslationLanguages(
                  translationsByPolicyId.get(item.id) || []
                );
                const translationStatus = getTranslationAvailabilityStatus(availableLanguages);

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.title}
                    description={item.description || 'Sem descrição cadastrada.'}
                    status={
                      <>
                        <AdminStatusPill
                          active={Boolean(item.enabled)}
                          activeText="Ativa"
                          inactiveText="Inativa"
                        />
                        <AdminTranslationStatusPill status={translationStatus} />
                      </>
                    }
                    meta={
                      <>
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Política exibida ao hóspede no diretório digital
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
                      canManagePolicies ? (
                        <AdminActionGroup>
                          <AdminLinkButton href={`/admin/politicas/${item.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </AdminLinkButton>

                          <form action={retranslatePolicyAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <AdminSecondaryButton type="submit">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retraduzir
                            </AdminSecondaryButton>
                          </form>

                          <form action={togglePolicyAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="enabled" value={String(!item.enabled)} />
                            <AdminSecondaryButton type="submit">
                              <Power className="mr-2 h-4 w-4" />
                              {item.enabled ? 'Desativar' : 'Ativar'}
                            </AdminSecondaryButton>
                          </form>

                          <form action={deletePolicyAction}>
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
                    ? 'Nenhuma política encontrada com os filtros atuais'
                    : 'Nenhuma política cadastrada ainda'
                }
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou revise o filtro de status para localizar a regra desejada.'
                    : 'Cadastre a primeira política para orientar o hóspede com mais clareza e reduzir dúvidas operacionais.'
                }
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
