const PRODUCT_PILLARS = [
  {
    title: 'Experiência pública premium',
    description:
      'Entregue ao hóspede um diretório digital elegante, claro e responsivo, com serviços, contatos e políticas em um único fluxo.',
  },
  {
    title: 'Operação simples para a equipe',
    description:
      'Atualize conteúdo, links e informações do hotel com um painel administrativo pensado para uso real no dia a dia.',
  },
  {
    title: 'Base pronta para escala',
    description:
      'Estruture a presença do produto em guestdesk.digital hoje, preservando o caminho para subdomínios de clientes no futuro.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Organize o hotel',
    description:
      'Configure identidade, links oficiais, conectividade, horários e informações essenciais do hotel.',
  },
  {
    step: '02',
    title: 'Publique conteúdo operacional',
    description:
      'Cadastre serviços, departamentos e políticas com clareza, consistência visual e atualização rápida.',
  },
  {
    step: '03',
    title: 'Entregue uma jornada melhor',
    description:
      'Ofereça ao hóspede um acesso digital mais bonito, útil e alinhado com a operação real da hospedagem.',
  },
];

const BENEFITS = [
  'Mais clareza para o hóspede em serviços, contatos e orientações importantes.',
  'Menos dependência de mensagens soltas, PDFs e instruções espalhadas.',
  'Melhor apresentação comercial do hotel em demos, propostas e operação diária.',
  'Estrutura preparada para evolução futura com presença por subdomínio.',
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#edf2f7_42%,#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[42px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_50%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 xl:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_30%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  GuestDesk
                </div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium tracking-[0.14em] text-slate-200 backdrop-blur">
                  guestdesk.digital
                </div>
              </div>

              <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl xl:text-[3.55rem] xl:leading-[1.02]">
                A presença digital do hotel, com estrutura de produto pronta para apresentação,
                operação e escala.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                GuestDesk centraliza serviços, contatos, políticas e acessos importantes em uma
                experiência premium para o hóspede e em um painel simples para a equipe. A base em
                `guestdesk.digital` fortalece a marca agora e prepara o caminho para futuras
                expansões por cliente.
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
                  Conhecer a estrutura
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PRODUCT_PILLARS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[30px] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="mt-6 rounded-[36px] bg-white p-6 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 md:p-8"
        >
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Um fluxo simples para hotel, operação e hóspede.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              GuestDesk foi estruturado para ser fácil de apresentar comercialmente e fácil de
              operar no cotidiano. O produto organiza a informação certa, no lugar certo, com mais
              consistência visual e menos atrito operacional.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {item.step}
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
          <div className="rounded-[36px] bg-white p-6 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 md:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Benefícios para hotéis
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Menos ruído operacional, mais clareza para o hóspede.
            </h2>

            <div className="mt-6 space-y-3">
              {BENEFITS.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-[24px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 ring-1 ring-slate-200/70"
                >
                  <span className="mt-2 h-2 w-2 rounded-full bg-slate-900" />
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[36px] bg-[linear-gradient(160deg,#dbeafe_0%,#f8fafc_35%,#ffffff_100%)] p-6 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/80 md:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Estrutura de domínio
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              guestdesk.digital como base da marca e da expansão futura.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Nesta etapa, o domínio principal sustenta a presença pública do produto, o material
              comercial e a narrativa institucional do GuestDesk. Ao mesmo tempo, a comunicação já
              prepara o terreno para futuras estruturas como `cliente.guestdesk.digital`, sem abrir
              agora um sprint de host routing ou multi-tenant por domínio.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Hoje
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">guestdesk.digital</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Marca, landing page, apresentação do produto e entrada comercial.
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Próximo passo
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  cliente.guestdesk.digital
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Presença dedicada por cliente quando chegar o sprint apropriado de subdomínios.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.65)] ring-1 ring-slate-900/10 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                Próximo movimento
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Uma landing pronta para demo, portfólio e proposta comercial.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                A base pública do produto agora fica mais forte para apresentação da marca, avanço
                comercial e evolução futura da presença por cliente.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 shadow-[0_14px_30px_-18px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Acessar o painel
              </a>
              <a
                href="mailto:contato@guestdesk.digital"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Solicitar demonstração
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-sm text-slate-300">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="max-w-2xl">
                GuestDesk posiciona a jornada digital do hotel com mais clareza, melhor
                apresentação e base mais consistente para evoluir.
              </p>
              <p className="font-medium text-slate-100">GuestDesk by BLID Tecnologia</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
