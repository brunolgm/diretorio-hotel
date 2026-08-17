import Link from 'next/link';
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import {
  listPlatformHotels,
  normalizePlatformDirectoryParams,
} from '@/lib/platform-queries';
import {
  getPlatformHotelBrandLabel,
  getPlatformHotelStatusLabel,
} from '@/lib/platform-governance';

type DirectorySearchParams = Promise<Record<string, string | string[] | undefined>>;

function buildPageHref({
  search,
  page,
  pageSize,
}: {
  search: string | null;
  page: number;
  pageSize: number;
}) {
  const query = new URLSearchParams();
  if (search) query.set('busca', search);
  if (page > 1) query.set('pagina', String(page));
  query.set('limite', String(pageSize));
  return `/platform/hoteis?${query.toString()}`;
}

export default async function PlatformHotelsPage({
  searchParams,
}: {
  searchParams: DirectorySearchParams;
}) {
  const rawParams = await searchParams;
  const params = normalizePlatformDirectoryParams({
    busca: rawParams.busca,
    pagina: rawParams.pagina,
    limite: rawParams.limite,
  });
  const directory = await listPlatformHotels(params);
  const firstResult = directory.total ? (directory.page - 1) * directory.pageSize + 1 : 0;
  const lastResult = Math.min(directory.total, directory.page * directory.pageSize);
  const hasPrevious = directory.page > 1;
  const hasNext = lastResult < directory.total;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          LibGuest Platform
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Diretório de hotéis</h1><Link href="/platform/hoteis/novo" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Novo hotel</Link></div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Consulta global read-only com dados institucionais mínimos. Credenciais, conteúdo
          operacional, usuários, tokens e analytics não fazem parte deste contrato.
        </p>

        <form method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar hotéis</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="busca"
              defaultValue={params.search || ''}
              maxLength={100}
              placeholder="Nome, slug, subdomínio ou cidade"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200"
            />
          </label>
          <input type="hidden" name="limite" value={params.pageSize} />
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Buscar
          </button>
        </form>
      </section>

      <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 md:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Hotéis</h2>
            <p className="mt-1 text-sm text-slate-600">
              {directory.total
                ? `${firstResult}–${lastResult} de ${directory.total}`
                : 'Nenhum resultado'}
            </p>
          </div>
          {params.search ? (
            <Link href="/platform/hoteis" className="text-sm font-medium text-slate-700 hover:text-slate-950">
              Limpar busca
            </Link>
          ) : null}
        </div>

        {directory.items.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {directory.items.map((hotel) => (
              <article
                key={hotel.id}
                className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-5"
              >
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                    {hotel.logoUrl ? (
                      <img
                        src={hotel.logoUrl}
                        alt=""
                        className="h-full w-full object-contain p-2"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                      {hotel.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{hotel.city || 'Cidade não informada'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-950 px-3 py-1 font-medium text-white">
                        {getPlatformHotelBrandLabel(hotel.brandCode)}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200">
                        {getPlatformHotelStatusLabel(hotel.platformStatus)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                        Tema: {hotel.themePreset || 'padrão'}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Slug</dt>
                    <dd className="mt-1 break-all font-medium text-slate-700">{hotel.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">Subdomínio</dt>
                    <dd className="mt-1 break-all font-medium text-slate-700">
                      {hotel.subdomain || 'Não configurado'}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/platform/hoteis/${hotel.id}`}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Abrir governança
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="font-semibold text-slate-900">Nenhum hotel encontrado</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ajuste a busca ou remova os filtros para consultar o diretório completo.
            </p>
          </div>
        )}

        {directory.total ? (
          <nav aria-label="Paginação do diretório" className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            {hasPrevious ? (
              <Link
                href={buildPageHref({ ...params, page: directory.page - 1 })}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-slate-500">Página {directory.page}</span>
            {hasNext ? (
              <Link
                href={buildPageHref({ ...params, page: directory.page + 1 })}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Próxima
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
