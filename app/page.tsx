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
                GuestDesk transforma o diretório digital do hotel em uma experiência mais premium,
                organizada e pronta para encantar o hóspede.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Centralize serviços, contatos, políticas e informações essenciais em uma interface
                elegante para o hóspede e simples para a operação do hotel.
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
                  Conhecer o produto
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Operação</p>
                <p className="mt-2 text-lg font-semibold text-white">Painel administrativo</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Atualize hotel, serviços, departamentos e políticas com mais clareza e agilidade.
                </p>
              </div>

              <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hóspede</p>
                <p className="mt-2 text-lg font-semibold text-white">Experiência pública</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Reúna informações úteis, contatos e acessos rápidos em uma jornada digital mais
                  elegante.
                </p>
              </div>
            </div>
          </div>

          <div
            id="como-funciona"
            className="mt-8 grid gap-4 rounded-[32px] bg-white p-6 text-slate-900 ring-1 ring-slate-200/70 md:grid-cols-3 md:p-8"
          >
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Estruture a operação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Configure dados do hotel, conectividade, links oficiais e apresentação da marca.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Organize a informação</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Publique serviços, departamentos e políticas com linguagem clara e consistência
                visual.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold">Eleve a experiência do hóspede</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Entregue uma navegação móvel mais bonita, direta e alinhada à operação real do
                hotel.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
            <p>GuestDesk é a plataforma digital para hotelaria moderna.</p>
            <p className="font-medium text-slate-200">GuestDesk by BLID Tecnologia</p>
          </div>
        </section>
      </div>
    </main>
  );
}
