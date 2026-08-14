export default function PlatformPage() {
  return (
    <section className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-8 text-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.75)] ring-1 ring-slate-900/10 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
          LibGuest Platform
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
          Administração da Plataforma
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-200 md:text-base">
          Fundação segura de identidade e autorização global. O dashboard de hotéis será
          introduzido na Sprint 46B.
        </p>
      </div>
    </section>
  );
}
