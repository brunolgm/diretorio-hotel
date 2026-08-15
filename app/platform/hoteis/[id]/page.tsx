import Link from 'next/link';
import { ArrowLeft, Building2, ExternalLink, ImageIcon, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { AdminConfirmAction } from '@/components/admin/confirm-action';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  getAllowedPlatformHotelStatusTransitions,
  getPlatformHotelBrandLabel,
  getPlatformHotelStatusLabel,
  PLATFORM_HOTEL_BRANDS,
} from '@/lib/platform-governance';
import { getPlatformHotelDetail } from '@/lib/platform-queries';
import { isUuid } from '@/lib/security/identifiers';
import {
  updatePlatformHotelBrandAction,
  updatePlatformHotelStatusAction,
} from './actions';

type PageParams = Promise<{ id: string }>;
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function readFeedback(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

export default async function PlatformHotelDetailPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: PageSearchParams;
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);

  if (!isUuid(id)) notFound();

  const hotel = await getPlatformHotelDetail(id);
  if (!hotel) notFound();

  const transitions = getAllowedPlatformHotelStatusTransitions(hotel.platformStatus);
  const brandChoices = [
    { value: '', label: 'Sem bandeira' },
    ...PLATFORM_HOTEL_BRANDS,
  ].filter((brand) => (brand.value || null) !== hotel.brandCode);

  return (
    <div className="space-y-6">
      <FeedbackToast
        success={readFeedback(feedback.success)}
        error={readFeedback(feedback.error)}
      />

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <Link
          href="/platform/hoteis"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao diretório
        </Link>

        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-slate-50 ring-1 ring-slate-200">
            {hotel.logoUrl ? (
              <img src={hotel.logoUrl} alt="" className="h-full w-full object-contain p-3" />
            ) : (
              <Building2 className="h-7 w-7 text-slate-400" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Governança global
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {hotel.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{hotel.city || 'Cidade não informada'}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-950 px-3 py-1 font-semibold text-white">
                {getPlatformHotelBrandLabel(hotel.brandCode)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                {getPlatformHotelStatusLabel(hotel.platformStatus)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-slate-950">Identidade da plataforma</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A bandeira é governada exclusivamente pela plataforma. Slug, subdomínio e mídia são
            exibidos somente para referência.
          </p>

          <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Slug</dt><dd className="mt-1 break-all font-medium text-slate-900">{hotel.slug}</dd></div>
            <div><dt className="text-slate-500">Subdomínio</dt><dd className="mt-1 break-all font-medium text-slate-900">{hotel.subdomain || 'Não configurado'}</dd></div>
            <div><dt className="text-slate-500">Tema</dt><dd className="mt-1 font-medium text-slate-900">{hotel.themePreset || 'Padrão'}</dd></div>
            <div><dt className="text-slate-500">Bandeira atual</dt><dd className="mt-1 font-medium text-slate-900">{getPlatformHotelBrandLabel(hotel.brandCode)}</dd></div>
          </dl>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Alterar bandeira</h3>
            {hotel.platformStatus === 'archived' ? (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                A identidade de um hotel arquivado fica congelada. Nenhuma alteração de bandeira
                está disponível nesse lifecycle terminal.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                {brandChoices.map((brand) => (
                  <AdminConfirmAction
                    key={brand.value || 'unassigned'}
                    action={updatePlatformHotelBrandAction}
                    title={`Alterar bandeira para ${brand.label}?`}
                    description="Essa mudança altera a identidade permanente controlada pela plataforma e será registrada no audit global."
                    triggerLabel={brand.label}
                    confirmLabel="Confirmar bandeira"
                    pendingLabel="Atualizando..."
                    tone="warning"
                    hiddenFields={[
                      { name: 'hotel_id', value: hotel.id },
                      { name: 'brand_code', value: brand.value },
                    ]}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
          <h2 className="text-xl font-semibold text-slate-950">Lifecycle</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            O estado é explícito e não é inferido pela bandeira, completude ou conteúdo do hotel.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Estado atual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {getPlatformHotelStatusLabel(hotel.platformStatus)}
            </p>
          </div>

          {transitions.length ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {transitions.map((status) => {
                const sensitive = status === 'suspended' || status === 'archived';
                const description = status === 'archived'
                  ? 'Arquivar é uma transição terminal nesta fase. O hotel permanece no histórico, sem exclusão, e a ação será auditada.'
                  : status === 'suspended'
                    ? 'A suspensão representa bloqueio temporário por governança. Confirme que essa consequência é intencional.'
                    : 'A alteração será aplicada ao lifecycle canônico e registrada no audit global.';

                return (
                  <AdminConfirmAction
                    key={status}
                    action={updatePlatformHotelStatusAction}
                    title={`Alterar lifecycle para ${getPlatformHotelStatusLabel(status)}?`}
                    description={description}
                    triggerLabel={getPlatformHotelStatusLabel(status)}
                    confirmLabel={sensitive ? 'Confirmar mudança sensível' : 'Confirmar lifecycle'}
                    pendingLabel="Atualizando..."
                    tone={status === 'archived' ? 'danger' : 'warning'}
                    hiddenFields={[
                      { name: 'hotel_id', value: hotel.id },
                      { name: 'current_status', value: hotel.platformStatus },
                      { name: 'platform_status', value: status },
                    ]}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Arquivado é terminal na Sprint 46C. Reativação exige uma decisão futura explícita.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <div className="flex items-center gap-3">
          <ImageIcon className="h-5 w-5 text-slate-600" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-slate-950">Referências institucionais</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[['Logo', hotel.logoUrl], ['Imagem de capa', hotel.heroImageUrl]].map(([label, url]) => (
            <div key={label} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{label}</p>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 break-all text-sm text-slate-600 hover:text-slate-950">
                  Abrir mídia read-only <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              ) : <p className="mt-2 text-sm text-slate-500">Não configurada</p>}
            </div>
          ))}
        </div>
        <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Criado em</dt><dd className="mt-1 font-medium text-slate-900">{formatTimestamp(hotel.createdAt)}</dd></div>
          <div><dt className="text-slate-500">Atualizado em</dt><dd className="mt-1 font-medium text-slate-900">{formatTimestamp(hotel.updatedAt)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
