import { Mail, ShieldCheck, UserCog } from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminCheckboxRow,
  AdminField,
  AdminFormGrid,
  AdminGuideCard,
  AdminHelpList,
  AdminInfoBadge,
  AdminPageHero,
  AdminSectionTitle,
  AdminSelect,
  AdminSurface,
  AdminTextInput,
} from '@/components/admin/ui';
import { APP_ROLE_OPTIONS, getRoleLabel, normalizeAppRole, requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateHotelUserAction } from './actions';
import { EditUserSubmitButton } from './edit-user-submit-button';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function EditHotelUserPage({ params, searchParams }: PageProps) {
  await requireAdminAccess('administrador');
  const { id } = await params;
  const hotel = await getAdminHotel();
  const adminClient = createAdminClient();
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const { data: userProfile, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !userProfile) {
    throw new Error('Usuário não encontrado.');
  }

  const action = updateHotelUserAction.bind(null, id);
  const normalizedRole = normalizeAppRole(userProfile.role) || 'visualizador';

  return (
    <main className="space-y-6">
      <FeedbackToast
        success={resolvedSearchParams?.success}
        error={resolvedSearchParams?.error}
        warning={resolvedSearchParams?.warning}
      />

      <AdminPageHero
        eyebrow="editar usuário"
        title="Editar acesso do hotel"
        description="Atualize nome, e-mail, senha opcional, papel e status de acesso deste usuário dentro do hotel atual."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Papel</p>
              <p className="mt-2 text-lg font-semibold text-white">{getRoleLabel(normalizedRole)}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={userProfile.full_name || userProfile.email || 'Usuário'}
          description="As alterações feitas aqui afetam imediatamente o acesso administrativo deste hotel."
          action={<AdminInfoBadge>Permissão aplicada por hotel</AdminInfoBadge>}
        />

        <AdminGuideCard
          title="Cuidados nesta edição"
          description="Trocas de papel e status alteram imediatamente a disponibilidade do usuário no painel e continuam limitadas ao hotel vinculado."
          className="mt-8"
        >
          <AdminHelpList
            items={[
              'Use senha nova apenas quando precisar redefinir o acesso.',
              'Usuário inativo deixa de acessar o admin até ser reativado.',
              'Você não pode remover o próprio papel de administrador nesta área.',
              'Mantenha pelo menos um administrador ativo no hotel.',
              'Desative acessos antigos em vez de apagar histórico nesta V1.',
            ]}
          />
        </AdminGuideCard>

        <form action={action}>
          <AdminFormGrid className="mt-8">
            <AdminField label="Nome completo" className="md:col-span-2">
              <div className="relative">
                <UserCog className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="full_name"
                  defaultValue={userProfile.full_name || ''}
                  required
                  className="pl-11"
                />
              </div>
            </AdminField>

            <AdminField label="E-mail" className="md:col-span-2">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  type="email"
                  name="email"
                  defaultValue={userProfile.email || ''}
                  required
                  className="pl-11"
                />
              </div>
            </AdminField>

            <AdminField label="Nova senha">
              <AdminTextInput type="password" name="password" placeholder="Opcional" />
            </AdminField>

            <AdminField label="Papel">
              <AdminSelect name="role" defaultValue={normalizedRole}>
                {APP_ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            <AdminCheckboxRow className="md:col-span-2">
              <input type="checkbox" name="is_active" defaultChecked={userProfile.is_active} />
              Ativo no painel administrativo
            </AdminCheckboxRow>
          </AdminFormGrid>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <EditUserSubmitButton />
            <AdminInfoBadge>
              <ShieldCheck className="h-3.5 w-3.5" />
              O papel define a visibilidade e o acesso operacional neste hotel
            </AdminInfoBadge>
          </div>
        </form>
      </AdminSurface>
    </main>
  );
}

