export default function PlatformLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando administração da plataforma">
      <div className="h-64 animate-pulse rounded-[34px] bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-[28px] bg-white ring-1 ring-slate-200" />
        <div className="h-40 animate-pulse rounded-[28px] bg-white ring-1 ring-slate-200" />
      </div>
      <div className="h-72 animate-pulse rounded-[30px] bg-white ring-1 ring-slate-200" />
    </div>
  );
}
