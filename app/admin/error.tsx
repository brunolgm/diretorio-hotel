'use client';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">LibGuest</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        Não foi possível carregar esta área
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        O painel encontrou uma falha temporária. Tente novamente e, se o problema continuar,
        informe ao responsável pela operação.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Tentar novamente
      </button>
    </main>
  );
}
