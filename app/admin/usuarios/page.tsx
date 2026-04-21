import { CheckCircle2, Mail, ShieldCheck, UserCog, Users } from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminField,
  AdminFormGrid,
  AdminGuideCard,
  AdminHelpList,
  AdminInfoBadge,
  AdminLanguageBadge,
  AdminLinkButton,
  AdminListItem,
  AdminPageHero,
  AdminSecondaryButton,
  AdminSectionTitle,
  AdminSelect,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTextInput,
} from '@/components/admin/ui';
import {
  APP_ROLE_OPTIONS,
  getRoleLabel,
  normalizeAppRole,
  requireAdminAccess,
} from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHotelUserAction, toggleHotelUserStatusAction } from './actions';
import { CreateUserSubmitButton } from './create-user-submit-button';

interface AdminUsersPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdminAccess('administrador');
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();
  const params = searchParams ? await searchParams : {};

  const { data: profiles, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Não foi possível carregar os usuários do hotel.');
  }

  const users = profiles || [];
  const activeUsers = users.filter((item) => item.is_active).length;
  const inactiveUsers = users.length - activeUsers;
  const administrators = users.filter(
    (item) => normalizeAppRole(item.role) === 'administrador'
  ).length;

  return (
    <main className="space-y-6">
      <FeedbackToast success={params?.success} error={params?.error} warning={params?.warning} />

      <AdminPageHero
        eyebrow="gestão de acesso"
        title="Usuários do hotel"
        description="Crie acessos, distribua papéis e mantenha a operação do GuestDesk com permissões simples e claras por hotel."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Área</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Controle de acesso
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<Users className="h-5 w-5" />}
          title="Total de usuários"
          value={String(users.length)}
          description="Total de perfis vinculados ao hotel nesta operação."
        />
        <AdminStatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Ativos"
          value={String(activeUsers)}
          description="Usuários com acesso liberado ao painel administrativo."
        />
        <AdminStatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Administradores"
          value={String(administrators)}
          description="Perfis que podem gerenciar usuários e papéis do hotel."
        />
        <AdminStatCard
          icon={<UserCog className="h-5 w-5" />}
          title="Inativos"
          value={String(inactiveUsers)}
          description="Perfis mantidos no histórico, mas com acesso temporariamente bloqueado."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Novo acesso"
            title="Criar usuário"
            description="Cadastre um novo acesso para o hotel com papel, e-mail e senha inicial."
            action={<AdminInfoBadge>Convite operacional simplificado</AdminInfoBadge>}
          />

          <AdminGuideCard
            title="Como distribuir papéis"
            description="Mantenha a hierarquia simples para reduzir risco operacional e facilitar a gestão do hotel."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Administrador: gerencia usuários, papéis e todos os módulos do hotel.',
                'Editor: edita hotel, serviços, departamentos e políticas.',
                'Operador: atua nos conteúdos operacionais do diretório.',
                'Visualizador: consulta o painel sem alterar dados.',
              ]}
            />
          </AdminGuideCard>

          <form action={createHotelUserAction}>
            <AdminFormGrid className="mt-8">
              <AdminField label="Nome completo" className="md:col-span-2">
                <AdminTextInput name="full_name" required placeholder="Ex.: Ana Souza" />
              </AdminField>

              <AdminField label="E-mail" className="md:col-span-2">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    type="email"
                    name="email"
                    required
                    className="pl-11"
                    placeholder="usuario@hotel.com"
                  />
                </div>
              </AdminField>

              <AdminField label="Senha inicial">
                <AdminTextInput
                  type="password"
                  name="password"
                  required
                  placeholder="Mínimo de 6 caracteres"
                />
              </AdminField>

              <AdminField label="Papel">
                <AdminSelect name="role" defaultValue="operador">
                  {APP_ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>

              <AdminCheckboxRow className="md:col-span-2">
                <input type="checkbox" name="is_active" defaultChecked />
                Ativo no painel administrativo
              </AdminCheckboxRow>
            </AdminFormGrid>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CreateUserSubmitButton />

              <AdminInfoBadge>
                <ShieldCheck className="h-3.5 w-3.5" />
                Um papel por usuário nesta V1
              </AdminInfoBadge>
            </div>
          </form>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Equipe vinculada"
            title="Lista de usuários"
            description="Edite dados, ajuste papéis e ative ou desative acessos já vinculados ao hotel."
          />

          <div className="mt-8 space-y-4">
            {users.length ? (
              users.map((item) => {
                const normalizedRole = normalizeAppRole(item.role);
                const role = normalizedRole ? getRoleLabel(normalizedRole) : 'Sem papel';

                return (
                  <AdminListItem
                    key={item.id}
                    title={item.full_name || item.email || 'Usuário sem nome'}
                    description={item.email || 'Sem e-mail informado'}
                    status={
                      <>
                        <AdminInfoBadge>{role}</AdminInfoBadge>
                        <AdminStatusPill
                          active={item.is_active}
                          activeText="Ativo"
                          inactiveText="Inativo"
                        />
                      </>
                    }
                    meta={
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminLanguageBadge label="HOTEL" available />
                        <span>
                          Criado em:{' '}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                      </div>
                    }
                    actions={
                      <AdminActionGroup>
                        <AdminLinkButton href={`/admin/usuarios/${item.id}`}>
                          Editar
                        </AdminLinkButton>

                        <form action={toggleHotelUserStatusAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="is_active" value={String(!item.is_active)} />
                          <AdminSecondaryButton type="submit">
                            {item.is_active ? 'Desativar' : 'Ativar'}
                          </AdminSecondaryButton>
                        </form>
                      </AdminActionGroup>
                    }
                  />
                );
              })
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-10 text-center">
                <p className="text-base font-semibold text-slate-900">
                  Nenhum usuário cadastrado ainda
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Crie o primeiro acesso para começar a distribuir papéis dentro do hotel.
                </p>
              </div>
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
