import { Building2, Clock3, Link as LinkIcon, MessageCircle } from 'lucide-react';
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
import { updateDepartmentAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function EditDepartmentPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: department, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !department) {
    throw new Error('Departamento não encontrado.');
  }

  const action = updateDepartmentAction.bind(null, id);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="editar departamento"
        title="Editar canal de atendimento"
        description="Atualize nome, descrição, horário, ação de contato e status de exibição do departamento."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Departamento</p>
              <p className="mt-2 text-lg font-semibold text-white">{department.name}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={department.name || 'Departamento'}
          description="As alterações feitas aqui serão refletidas no diretório público do hotel."
          action={<AdminInfoBadge>Contato do diretório</AdminInfoBadge>}
        />

        <form action={action}>
          <AdminFormGrid>
            <AdminField label="Nome" className="md:col-span-2">
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="name"
                  defaultValue={department.name || ''}
                  required
                  className="pl-11"
                  placeholder="Ex.: Recepção"
                />
              </div>
            </AdminField>

            <AdminField label="Descrição" className="md:col-span-2">
              <AdminTextarea
                name="description"
                defaultValue={department.description || ''}
                placeholder="Descreva com clareza como esse setor atende o hóspede."
              />
            </AdminField>

            <AdminField label="Horário">
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="hours"
                  defaultValue={department.hours || ''}
                  className="pl-11"
                  placeholder="Ex.: 24 horas"
                />
              </div>
            </AdminField>

            <AdminField label="Texto do botão">
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="action"
                  defaultValue={department.action || ''}
                  className="pl-11"
                  placeholder="Ex.: Falar com a Recepção"
                />
              </div>
            </AdminField>

            <AdminField label="Link" className="md:col-span-2">
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="url"
                  defaultValue={department.url || ''}
                  className="pl-11"
                  placeholder="https://... ou link do WhatsApp"
                />
              </div>
            </AdminField>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={department.enabled ?? false}
                />
                Ativo no diretório
              </label>
            </div>
          </AdminFormGrid>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AdminPrimaryButton type="submit">Salvar alterações</AdminPrimaryButton>
            <AdminInfoBadge>Atualização com feedback visual</AdminInfoBadge>
          </div>
        </form>
      </AdminSurface>
    </main>
  );
}
