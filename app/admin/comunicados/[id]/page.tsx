import { AlertTriangle, CalendarClock, Megaphone } from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminCheckboxRow,
  AdminField,
  AdminFormGrid,
  AdminGuideCard,
  AdminHelpList,
  AdminInfoBadge,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSectionTitle,
  AdminSelect,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import {
  getRetranslationHelpText,
  getTranslationWorkflowHelpItems,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { updateAnnouncementAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default async function EditAnnouncementPage({ params, searchParams }: PageProps) {
  await requireAdminAccess('operador');
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: announcement, error } = await supabase
    .from('hotel_announcements')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !announcement) {
    throw new Error('Comunicado não encontrado.');
  }

  const action = updateAnnouncementAction.bind(null, id);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="editar comunicado"
        title="Editar aviso público do hotel"
        description="Atualize título, mensagem, período e status de exibição do comunicado na página pública."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Comunicado</p>
              <p className="mt-2 text-lg font-semibold text-white">{announcement.title}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={announcement.title || 'Comunicado'}
          description="Português continua como conteúdo fonte deste cadastro. EN e ES são atualizados a partir do texto salvo em PT."
          action={<AdminInfoBadge>Role mínima: operador</AdminInfoBadge>}
        />

        <AdminGuideCard
          title="Como a publicação funciona"
          description={getRetranslationHelpText()}
          className="mt-8"
        >
          <AdminHelpList
            items={[
              ...getTranslationWorkflowHelpItems(),
              'Comunicados inativos ou fora do período não aparecem para o hóspede.',
            ]}
          />
        </AdminGuideCard>

        <form action={action}>
          <AdminFormGrid className="md:grid-cols-1">
            <AdminField label="Título">
              <div className="relative">
                <Megaphone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="title"
                  defaultValue={announcement.title || ''}
                  required
                  className="pl-11"
                  placeholder="Ex.: Manutenção na academia"
                />
              </div>
            </AdminField>

            <AdminField label="Mensagem">
              <AdminTextarea
                name="body"
                defaultValue={announcement.body || ''}
                className="min-h-40"
                placeholder="Explique o aviso de forma simples e objetiva para o hóspede."
              />
            </AdminField>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminField label="Categoria">
                <AdminSelect name="category" defaultValue={announcement.category || 'informativo'}>
                  <option value="informativo">Informativo</option>
                  <option value="alerta">Alerta</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="promocao">Promoção</option>
                </AdminSelect>
              </AdminField>

              <AdminField label="Status">
                <AdminCheckboxRow>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={announcement.is_active ?? false}
                  />
                  Ativo para exibição pública
                </AdminCheckboxRow>
              </AdminField>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <AdminField label="Início (opcional)">
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={toDateTimeLocalValue(announcement.starts_at)}
                    className="pl-11"
                  />
                </div>
              </AdminField>

              <AdminField label="Fim (opcional)">
                <div className="relative">
                  <CalendarClock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    name="ends_at"
                    type="datetime-local"
                    defaultValue={toDateTimeLocalValue(announcement.ends_at)}
                    className="pl-11"
                  />
                </div>
              </AdminField>
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
