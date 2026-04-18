import {
  Phone,
  Clock3,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Plus,
  Power,
  Pencil,
  Trash2,
  MessageCircle,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import {
  createDepartmentAction,
  deleteDepartmentAction,
  toggleDepartmentAction,
} from './actions';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminEmptyState,
  AdminField,
  AdminFormGrid,
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

interface AdminDepartmentsPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function AdminDepartmentsPage({
  searchParams,
}: AdminDepartmentsPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;

  const { data: departments, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar departamentos.');
  }

  const totalDepartments = departments?.length || 0;
  const activeDepartments = departments?.filter((item) => item.enabled).length || 0;
  const inactiveDepartments = totalDepartments - activeDepartments;

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

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
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Atendimento"
          value="Organizado"
          description="Os contatos do hotel podem ser mantidos sempre atualizados."
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

          <form action={createDepartmentAction}>
            <AdminFormGrid>
              <AdminField label="Nome" className="md:col-span-2">
                <AdminTextInput name="name" required placeholder="Ex.: Recepção" />
              </AdminField>

              <AdminField label="Descrição" className="md:col-span-2">
                <AdminTextarea
                  name="description"
                  placeholder="Descreva como esse departamento atende o hóspede."
                />
              </AdminField>

              <AdminField label="Horário">
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    name="hours"
                    className="pl-11"
                    placeholder="Ex.: 24 horas"
                  />
                </div>
              </AdminField>

              <AdminField label="Texto do botão">
                <AdminTextInput name="action" placeholder="Ex.: Falar com a Recepção" />
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
            description="Edite, ative, desative ou remova os canais de atendimento disponíveis."
            action={<AdminInfoBadge>Gestão rápida</AdminInfoBadge>}
          />

          <div className="mt-6 space-y-4">
            {departments?.length ? (
              departments.map((item) => (
                <AdminListItem
                  key={item.id}
                  title={item.name}
                  description={item.description || 'Sem descrição cadastrada.'}
                  status={<AdminStatusPill active={Boolean(item.enabled)} />}
                  meta={
                    <>
                      <span>Horário: {item.hours || 'Não informado'}</span>
                      <span>Botão: {item.action || '—'}</span>
                    </>
                  }
                  actions={
                    <AdminActionGroup>
                      <AdminLinkButton href={`/admin/departamentos/${item.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </AdminLinkButton>

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
              ))
            ) : (
              <AdminEmptyState
                title="Nenhum departamento cadastrado ainda"
                description="Crie o primeiro setor de atendimento para exibir canais de contato ao hóspede."
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
