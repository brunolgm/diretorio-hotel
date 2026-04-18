export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 md:px-6">
        <section className="w-full overflow-hidden rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-6 text-white shadow-sm md:p-10">
          <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr] xl:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
                GuestDesk
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                Diretório digital premium para experiências de hotel mais organizadas.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Centralize serviços, contatos, políticas e informações essenciais em uma
                experiência elegante para o hóspede e simples para a operação.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Entrar no painel
                </a>
                <a
                  href="#como-funciona"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Conhecer a plataforma
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Operação</p>
                <p className="mt-2 text-lg font-semibold text-white">Painel administrativo</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Atualize logo, serviços, departamentos e políticas com rapidez.
                </p>
              </div>

              <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hóspede</p>
                <p className="mt-2 text-lg font-semibold text-white">Diretório público</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Consulte informações úteis, contatos e acessos rápidos em um só lugar.
                </p>
              </div>
            </div>
          </div>

          <div
            id="como-funciona"
            className="mt-8 grid gap-4 rounded-[32px] bg-white p-6 text-slate-900 ring-1 ring-slate-200/70 md:grid-cols-3 md:p-8"
          >
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Configure o hotel</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ajuste informações institucionais, conectividade, branding e links oficiais.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Organize o diretório</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Publique serviços, departamentos e políticas com uma linguagem clara e visual consistente.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Entregue uma experiência premium</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ofereça uma jornada móvel mais bonita, direta e alinhada à operação real do hotel.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
