import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <main className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">LibGuest</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        Recurso não encontrado
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Este item não está disponível para o acesso atual.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Voltar ao painel
      </Link>
    </main>
  );
}
