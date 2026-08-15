import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--admin-muted)]">LibGuest</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--admin-text-strong)]">
        Acesso n&atilde;o autorizado
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
        Seu perfil n&atilde;o possui permiss&atilde;o para concluir esta opera&ccedil;&atilde;o.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex rounded-xl bg-[var(--admin-accent)] px-5 py-3 text-sm font-medium text-[var(--admin-accent-text)] transition hover:bg-[var(--admin-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
      >
        Voltar ao painel
      </Link>
    </section>
  );
}
