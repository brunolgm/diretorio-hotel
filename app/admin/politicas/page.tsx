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
  AdminInfoBadge,
  AdminLanguageBadge,
  AdminLinkButton,
  AdminListItem,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminSectionTitle,
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
  }>;
}

type PolicyTranslation = Database['public']['Tables']['hotel_policy_translations']['Row'];

export default async function AdminPoliciesPage({
  searchParams,
}: AdminPoliciesPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;
  const warning = params?.warning;

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
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Cadastro rápido"
            title="Nova política"
            description="Cadastre regras como check-in, check-out, não fumante, pets, uso de áreas comuns e demais orientações importantes."
            action={<AdminInfoBadge>Regras visíveis ao hóspede</AdminInfoBadge>}
          />

          <form action={createPolicyAction}>
            <div className="mt-8 grid gap-5">
              <AdminField label="Título">
                <AdminTextInput name="title" required placeholder="Ex.: Não fumar" />
              </AdminField>

              <AdminField label="Descrição">
                <AdminTextarea
                  name="description"
                  className="min-h-36"
                  placeholder="Descreva claramente a política para o hóspede."
                />
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

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Políticas cadastradas"
            title="Lista de políticas"
            description="Edite, ative, desative, retraduza ou remova as regras exibidas para o hóspede."
            action={<AdminInfoBadge>Gestão rápida</AdminInfoBadge>}
          />

          <div className="mt-6 space-y-4">
            {policies?.length ? (
              policies.map((item) => {
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
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminLanguageBadge label="PT" available />
                          <AdminLanguageBadge label="EN" available={availableLanguages.has('en')} />
                          <AdminLanguageBadge label="ES" available={availableLanguages.has('es')} />
                        </div>
                      </>
                    }
                    actions={
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
                    }
                  />
                );
              })
            ) : (
              <AdminEmptyState
                title="Nenhuma política cadastrada ainda"
                description="Cadastre a primeira política para orientar o hóspede com mais clareza."
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
