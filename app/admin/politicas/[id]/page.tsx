import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminField,
  AdminFormGrid,
  AdminInfoBadge,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSectionTitle,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { updatePolicyAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function EditPolicyPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: policy, error } = await supabase
    .from('hotel_policies')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !policy) {
    throw new Error('Política não encontrada.');
  }

  const action = updatePolicyAction.bind(null, id);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="editar política"
        title="Editar regra do hotel"
        description="Atualize o título, a descrição e o status de exibição da política no diretório público."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Política</p>
              <p className="mt-2 text-lg font-semibold text-white">{policy.title}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={policy.title || 'Política'}
          description="As alterações feitas aqui serão refletidas no diretório público do hotel."
          action={<AdminInfoBadge>Regra exibida ao hóspede</AdminInfoBadge>}
        />

        <form action={action}>
          <AdminFormGrid className="md:grid-cols-1">
            <AdminField label="Título">
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="title"
                  defaultValue={policy.title || ''}
                  required
                  className="pl-11"
                  placeholder="Ex.: Não fumar"
                />
              </div>
            </AdminField>

            <AdminField label="Descrição">
              <AdminTextarea
                name="description"
                defaultValue={policy.description || ''}
                className="min-h-40"
                placeholder="Descreva com clareza a regra ou orientação que o hóspede precisa saber."
              />
            </AdminField>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" name="enabled" defaultChecked={policy.enabled ?? false} />
                Ativa no diretório
              </label>
            </div>
          </AdminFormGrid>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AdminPrimaryButton type="submit">Salvar alterações</AdminPrimaryButton>
            <AdminInfoBadge>
              <AlertTriangle className="h-3.5 w-3.5" />
              Atualização com feedback visual
            </AdminInfoBadge>
          </div>
        </form>
      </AdminSurface>
    </main>
  );
}
