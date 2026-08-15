export default function AdminLoading() {
  return (
    <main className="space-y-6" aria-busy="true" aria-label="Carregando painel administrativo">
      <div className="h-40 animate-pulse rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]" />
    </main>
  );
}
