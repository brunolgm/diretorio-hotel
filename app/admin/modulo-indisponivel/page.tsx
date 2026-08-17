import Link from 'next/link';
import { Puzzle } from 'lucide-react';

export default function ModuleUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-[28px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-7 text-center shadow-sm sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
          <Puzzle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--admin-text-strong)]">Recurso indisponível</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-text-muted)]">Este recurso não está disponível para este hotel.</p>
        <Link href="/admin" className="mt-6 inline-flex h-11 items-center rounded-2xl bg-[var(--admin-primary)] px-5 text-sm font-semibold text-white">Voltar ao painel</Link>
      </section>
    </main>
  );
}
