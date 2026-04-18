import {
  CheckCircle2,
  Sparkles,
  Plus,
  Power,
  Pencil,
  Trash2,
  FileText,
  Scale,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import { createPolicyAction, deletePolicyAction, togglePolicyAction } from './actions';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminEmptyState,
  AdminField,
  AdminInfoBadge,
  AdminLinkButton,
  AdminListItem,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminDangerButton,
  AdminSectionTitle,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';

interface AdminPoliciesPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function AdminPoliciesPage({
  searchParams,
}: AdminPoliciesPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;

  const { data: policies, error } = await supabase
    .from('hotel_policies')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar políticas.');
  }

  const totalPolicies = policies?.length || 0;
  const activePolicies = policies?.filter((item) => item.enabled).length || 0;
  const inactivePolicies = totalPolicies - activePolicies;

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

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
          icon={<Scale className="h-5 w-5" />}
          title="Conformidade"
          value="Organizada"
          description="As regras do hotel podem ser mantidas claras e atualizadas."
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
            description="Edite, ative, desative ou remova as regras exibidas para o hóspede."
            action={<AdminInfoBadge>Gestão rápida</AdminInfoBadge>}
          />

          <div className="mt-6 space-y-4">
            {policies?.length ? (
              policies.map((item) => (
                <AdminListItem
                  key={item.id}
                  title={item.title}
                  description={item.description || 'Sem descrição cadastrada.'}
                  status={<AdminStatusPill active={Boolean(item.enabled)} activeText="Ativa" inactiveText="Inativa" />}
                  meta={
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Política exibida ao hóspede no diretório digital
                    </span>
                  }
                  actions={
                    <AdminActionGroup>
                      <AdminLinkButton href={`/admin/politicas/${item.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </AdminLinkButton>

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
              ))
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
