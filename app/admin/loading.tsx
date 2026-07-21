export default function AdminLoading() {
  return (
    <main className="space-y-6" aria-busy="true" aria-label="Carregando painel administrativo">
      <div className="h-48 animate-pulse rounded-[32px] bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[28px] bg-white ring-1 ring-slate-200" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[32px] bg-white ring-1 ring-slate-200" />
    </main>
  );
}
