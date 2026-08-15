'use client';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
        className="mt-6 inline-flex rounded-xl bg-[#0b2b50] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#123f70]"
      >
        Tentar novamente
      </button>
    </main>
  );
}
