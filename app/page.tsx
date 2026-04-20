export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 md:px-6">
        <section className="relative w-full overflow-hidden rounded-[40px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_28%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[1.2fr,0.8fr] xl:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                GuestDesk
              </div>

              <h1 className="mt-7 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl xl:text-[3.35rem] xl:leading-[1.02]">
                O diretório digital do hotel com apresentação premium e operação simples.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Organize serviços, contatos, políticas e informações essenciais em uma experiência
                elegante para o hóspede e fácil de atualizar para a equipe do hotel.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 shadow-[0_14px_30px_-18px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Entrar no painel
                </a>
                <a
                  href="#como-funciona"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Conhecer o produto
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[30px] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Operação</p>
                <p className="mt-3 text-lg font-semibold text-white">Painel administrativo</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Atualize hotel, serviços, departamentos e políticas com mais clareza e ritmo de
                  operação.
                </p>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hóspede</p>
                <p className="mt-3 text-lg font-semibold text-white">Experiência pública</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Reúna informações úteis, contatos e acessos rápidos em uma jornada digital mais
                  elegante.
                </p>
              </div>
            </div>
          </div>

          <div
            id="como-funciona"
            className="relative mt-10 grid gap-4 rounded-[34px] bg-white p-6 text-slate-900 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 md:grid-cols-3 md:p-8"
          >
            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold">Estruture a operação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Configure dados do hotel, conectividade, links oficiais e apresentação da marca.
              </p>
            </div>

            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold">Organize a informação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Publique serviços, departamentos e políticas com linguagem clara e consistência
                visual.
              </p>
            </div>

            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70">
              <p className="text-sm font-semibold">Eleve a jornada do hóspede</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Entregue uma navegação móvel mais bonita, direta e alinhada à operação real do
                hotel.
              </p>
            </div>
          </div>

          <div className="relative mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
            <p className="max-w-xl">
              GuestDesk organiza a jornada digital do hóspede com mais clareza, presença de marca
              e consistência operacional.
            </p>
            <p className="font-medium text-slate-100">GuestDesk by BLID Tecnologia</p>
          </div>
        </section>
      </div>
    </main>
  );
}
