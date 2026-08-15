import Link from 'next/link';
import { Activity, ArrowRight, Building2, Tags } from 'lucide-react';
import {
  getPlatformHotelBrandLabel,
  getPlatformHotelStatusLabel,
} from '@/lib/platform-governance';
import { getPlatformHotelMetrics } from '@/lib/platform-queries';

export default async function PlatformPage() {
  const metrics = await getPlatformHotelMetrics();
  const brandEntries = Object.entries(metrics.hotelsByBrand).sort(([left], [right]) =>
    getPlatformHotelBrandLabel(left).localeCompare(getPlatformHotelBrandLabel(right), 'pt-BR')
  );
  const statusEntries = Object.entries(metrics.hotelsByStatus);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-8 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.75)] ring-1 ring-slate-900/10 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
              LibGuest Platform
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              Visão global de hotéis
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-200 md:text-base">
              Indicadores institucionais e acesso seguro ao diretório global, sem expor dados
              operacionais dos hotéis.
            </p>
          </div>
          <Link
            href="/platform/hoteis"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Abrir diretório
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Hotéis cadastrados
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {metrics.totalHotels.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Total atual no contrato global read-only da plataforma.
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Estados de lifecycle
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {statusEntries.length.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Distribuição pelo estado canônico de governança, sem inferência por completude.
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Bandeiras representadas
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {brandEntries.length.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Tags className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Inclui hotéis ainda sem bandeira definida como grupo separado.
          </p>
        </div>
      </section>

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Distribuição por bandeira
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Contagem agregada sem carregar registros operacionais ou dados de hóspedes.
        </p>

        {brandEntries.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brandEntries.map(([brandCode, count]) => (
              <div
                key={brandCode}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4"
              >
                <span className="text-sm font-medium text-slate-700">
                  {getPlatformHotelBrandLabel(brandCode)}
                </span>
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                  {count.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            Nenhum hotel cadastrado para compor as métricas globais.
          </div>
        )}
      </section>

      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Distribuição por lifecycle
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Draft, ativo, suspenso e arquivado são estados explícitos e independentes de bandeira.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <span className="text-sm font-medium text-slate-700">
                {getPlatformHotelStatusLabel(status)}
              </span>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                {count.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
