import { FileText, Hash } from 'lucide-react';
import { ServiceGuidedFields } from '@/components/admin/service-guided-fields';
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
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { buildServiceCategoryOptions } from '@/lib/service-options';
import { createClient } from '@/lib/supabase/server';
import { updateSectionAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function EditServicePage({ params, searchParams }: PageProps) {
  await requireAdminAccess('operador');
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const [{ data: section, error }, { data: hotelSectionCategories, error: categoryError }] =
    await Promise.all([
      supabase.from('hotel_sections').select('*').eq('id', id).eq('hotel_id', hotel.id).single(),
      supabase.from('hotel_sections').select('category').eq('hotel_id', hotel.id),
    ]);

  if (error || !section) {
    throw new Error('Serviço não encontrado.');
  }

  if (categoryError) {
    throw new Error('Não foi possível carregar as categorias de serviço do hotel.');
  }

  const action = updateSectionAction.bind(null, id);
  const serviceCategoryOptions = buildServiceCategoryOptions(
    (hotelSectionCategories || []).map((item) => item.category)
  );

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="editar serviço"
        title="Editar item do diretório"
        description="Atualize título, categoria, descrição, link, ordem e status de exibição do serviço."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Registro</p>
              <p className="mt-2 text-lg font-semibold text-white">#{section.sort_order ?? 0}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={section.title || 'Serviço'}
          description="As alterações feitas aqui serão refletidas no diretório público do hotel."
          action={<AdminInfoBadge>Serviço do diretório</AdminInfoBadge>}
        />

        <form action={action}>
          <AdminFormGrid>
            <AdminField label="Título" className="md:col-span-2">
              <AdminTextInput
                name="title"
                defaultValue={section.title || ''}
                required
                placeholder="Ex.: Café da manhã"
              />
            </AdminField>

            <ServiceGuidedFields
              categoryOptions={serviceCategoryOptions}
              initialIcon={section.icon}
              initialCategory={section.category}
            />

            <AdminField label="Descrição" className="md:col-span-2">
              <AdminTextarea
                name="content"
                defaultValue={section.content || ''}
                placeholder="Descreva com clareza o que será apresentado ao hóspede."
              />
            </AdminField>

            <AdminField label="Texto do botão">
              <div className="relative">
                <FileText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  name="cta"
                  defaultValue={section.cta || ''}
                  className="pl-11"
                  placeholder="Ex.: Ver detalhes"
                />
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Se houver link externo, o botão abre esse destino. Sem link, ele só aparece se o
                conteúdo for suficiente para uma página interna de detalhes.
              </p>
            </AdminField>

            <AdminField label="Link">
              <AdminTextInput
                name="url"
                defaultValue={section.url || ''}
                placeholder="https://..."
              />
              <p className="text-xs leading-5 text-slate-500">
                Se este campo ficar vazio, o GuestDesk decide entre página interna de detalhes ou
                ocultar o botão para evitar CTA sem destino.
              </p>
            </AdminField>

            <AdminField label="Ordem">
              <div className="relative">
                <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminTextInput
                  type="number"
                  name="sort_order"
                  defaultValue={section.sort_order ?? 0}
                  className="pl-11"
                />
              </div>
            </AdminField>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" name="enabled" defaultChecked={section.enabled ?? false} />
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
