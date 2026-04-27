import { AlertTriangle, ImageIcon } from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminCheckboxRow,
  AdminDangerButton,
  AdminField,
  AdminFormGrid,
  AdminGuideCard,
  AdminHelpList,
  AdminHelpText,
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
import {
  getRetranslationHelpText,
  getTranslationWorkflowHelpItems,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';
import { removePromotionalBannerImageAction, updatePromotionalBannerAction } from './actions';
import { uploadPromotionalBannerImageAction } from '../upload-image-action';

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

export default async function EditBannerPage({ params, searchParams }: PageProps) {
  await requireAdminAccess('operador');
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: banner, error } = await supabase
    .from('hotel_promotional_banners')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !banner) {
    throw new Error('Banner promocional não encontrado.');
  }

  const action = updatePromotionalBannerAction.bind(null, id);
  const removeImageAction = removePromotionalBannerImageAction.bind(null, id);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />

      <AdminPageHero
        eyebrow="editar banner"
        title="Editar banner promocional"
        description="Atualize texto, CTA, imagem, ordem e período de exibição do banner no carrossel público."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Banner</p>
              <p className="mt-2 text-lg font-semibold text-white">{banner.title}</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="edição individual"
            title={banner.title || 'Banner promocional'}
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
                'O carrossel público mostra no máximo 3 banners elegíveis por hotel.',
              ]}
            />
          </AdminGuideCard>

          <form action={action}>
            <AdminFormGrid className="md:grid-cols-1">
              <AdminField label="Título">
                <AdminTextInput
                  name="title"
                  defaultValue={banner.title || ''}
                  required
                  placeholder="Ex.: Pacote romântico de fim de semana"
                />
              </AdminField>

              <AdminField label="Texto curto">
                <AdminTextarea
                  name="subtitle"
                  defaultValue={banner.subtitle || ''}
                  className="min-h-36"
                  placeholder="Descreva o destaque com clareza e apelo visual."
                />
              </AdminField>

              <div className="grid gap-5 md:grid-cols-2">
                <AdminField label="Texto do CTA">
                  <AdminTextInput
                    name="cta_label"
                    defaultValue={banner.cta_label || ''}
                    placeholder="Ex.: Ver oferta"
                  />
                </AdminField>

                <AdminField label="URL do CTA">
                  <AdminTextInput
                    name="cta_url"
                    defaultValue={banner.cta_url || ''}
                    placeholder="https://..."
                  />
                </AdminField>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <AdminField label="Ordem de exibição">
                  <AdminTextInput
                    name="display_order"
                    type="number"
                    min="0"
                    defaultValue={String(banner.display_order ?? 0)}
                  />
                </AdminField>

                <AdminField label="Status">
                  <AdminCheckboxRow>
                    <input type="checkbox" name="is_active" defaultChecked={banner.is_active} />
                    Ativo para exibição pública
                  </AdminCheckboxRow>
                </AdminField>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <AdminField label="Início (opcional)">
                  <AdminTextInput
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={toDateTimeLocalValue(banner.starts_at)}
                  />
                </AdminField>

                <AdminField label="Fim (opcional)">
                  <AdminTextInput
                    name="ends_at"
                    type="datetime-local"
                    defaultValue={toDateTimeLocalValue(banner.ends_at)}
                  />
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

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="imagem do banner"
            title="Upload e preview"
            description="Prefira imagens 1600 x 600 px na proporção 8:3 para manter o destaque visual mais estável no desktop e no mobile."
            action={<AdminInfoBadge>Bucket: hotel-assets</AdminInfoBadge>}
          />

          <div className="mt-8 overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_55%,#334155_100%)] shadow-[0_20px_50px_-36px_rgba(15,23,42,0.5)]">
            <div className="relative aspect-[8/3] min-h-[200px] overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_28%)]" />
              {banner.image_url ? (
                <div
                  role="img"
                  aria-label={banner.title}
                  className="absolute inset-0 bg-cover bg-center opacity-80"
                  style={{ backgroundImage: `url("${banner.image_url}")` }}
                />
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.82)_0%,rgba(2,6,23,0.62)_42%,rgba(2,6,23,0.22)_100%)]" />
              <div className="relative flex h-full flex-col justify-end gap-3 p-6 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Preview público</p>
                <h3 className="text-2xl font-semibold tracking-tight">{banner.title}</h3>
                <p className="max-w-xl text-sm leading-7 text-slate-200">
                  {banner.subtitle || 'Sem texto curto configurado para este banner.'}
                </p>
              </div>
            </div>
          </div>

          <AdminGuideCard
            title="Orientação de mídia"
            description="Não há crop automático real nesta sprint. Imagens fora da proporção podem sofrer corte visual com object-fit."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Tamanho ideal: 1600 x 600 px.',
                'Mínimo recomendado: 1200 x 450 px.',
                'Formatos aceitos: JPG, PNG e WEBP.',
                'Peso ideal até 1,5 MB e máximo técnico de 2 MB.',
              ]}
            />
          </AdminGuideCard>

          <form action={uploadPromotionalBannerImageAction} className="mt-8 space-y-4">
            <input type="hidden" name="banner_id" value={banner.id} />

            <AdminField label="Arquivo da imagem">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                />
              </div>
              <AdminHelpText>
                Se a imagem estiver fora da proporção ideal, o banner público poderá cortar as bordas com
                <span className="font-medium"> object-cover</span>.
              </AdminHelpText>
            </AdminField>

            <AdminPrimaryButton type="submit">
              <ImageIcon className="mr-2 h-4 w-4" />
              Enviar imagem
            </AdminPrimaryButton>
          </form>

          {banner.image_url ? (
            <form action={removeImageAction} className="mt-3">
              <AdminDangerButton type="submit">Remover imagem</AdminDangerButton>
            </form>
          ) : null}
        </AdminSurface>
      </section>
    </main>
  );
}
