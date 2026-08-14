'use client';

export default function PlatformError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="rounded-[30px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        LibGuest Platform
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        Não foi possível carregar os dados globais
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        A consulta segura da plataforma falhou temporariamente. Nenhum dado operacional foi
        carregado.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Tentar novamente
      </button>
    </section>
  );
}
