import { notFound } from 'next/navigation';
import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { getRequestDomainContext, isHotelSubdomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySubdomain } from '@/lib/public-hotel-data';
import { normalizePublicLanguage } from '@/lib/public-language';

const HERO_METRICS = [
  { label: 'Experiência', value: 'Diretório digital premium' },
  { label: 'Operação', value: 'Painel simples para a equipe' },
  { label: 'Presença', value: 'Base pública em guestdesk.digital' },
];

const PRODUCT_STORIES = [
  {
    eyebrow: 'O que é',
    title: 'Uma base digital elegante para a jornada do hóspede.',
    description:
      'LibGuest organiza serviços, contatos, políticas e links importantes em uma experiência pública mais clara, útil e alinhada à operação real do hotel.',
  },
  {
    eyebrow: 'Como funciona',
    title: 'Painel administrativo + experiência pública no mesmo produto.',
    description:
      'A equipe atualiza conteúdo com ritmo operacional. O hóspede acessa uma jornada mais bonita, responsiva e consistente com a marca do hotel.',
  },
  {
    eyebrow: 'Por que importa',
    title:
      'Menos retrabalho operacional, mais clareza para o hóspede e uma apresentação digital mais consistente.',
    description:
      'LibGuest reduz a dispersão de informações, facilita o acesso a orientações e serviços importantes e melhora a forma como o hotel se apresenta no dia a dia da hospedagem.',
  },
];

const BENEFITS = [
  'Centraliza informações importantes em um único fluxo digital para o hóspede.',
  'Facilita a atualização operacional de serviços, departamentos e políticas.',
  'Melhora a experiência digital do hóspede com informações mais claras e acessos mais úteis.',
  'Fortalece a operação com uma base digital mais organizada, simples de manter e consistente.',
];

const USE_CASES = [
  {
    title: 'Para hotéis independentes',
    description:
      'Uma presença digital mais organizada, elegante e fácil de operar sem depender de soluções improvisadas.',
  },
  {
    title: 'Para operação interna',
    description:
      'Menos retrabalho com instruções soltas e mais consistência na gestão de conteúdo útil para a hospedagem.',
  },
  {
    title: 'Para experiência do hóspede',
    description:
      'Uma jornada mais clara para acessar serviços, contatos, políticas e informações essenciais durante a estadia.',
  },
];

function LandingPageContent() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#edf2f7_40%,#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[42px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 xl:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_30%)]" />

          <div className="relative grid gap-8 xl:grid-cols-[1.08fr,0.92fr] xl:items-end">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  LibGuest
                </div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium tracking-[0.14em] text-slate-200 backdrop-blur">
                  guestdesk.digital
                </div>
              </div>

              <h1 className="mt-7 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl xl:text-[3.6rem] xl:leading-[1.02]">
                A plataforma que transforma a presença digital do hotel em uma experiência mais
                clara, premium e pronta para escala.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                LibGuest conecta operação e apresentação em um único produto: painel administrativo
                para a equipe, diretório digital elegante para o hóspede e uma base pública forte
                para demos, propostas e evolução comercial da marca.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 shadow-[0_14px_30px_-18px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Entrar no painel
                </a>
                <a
                  href="mailto:contato@guestdesk.digital"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Solicitar demonstração
                </a>
                <a
                  href="#produto"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/12 bg-transparent px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Entender o produto
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300">
                  Estrutura comercial
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Marca, produto e domínio no mesmo discurso
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  LibGuest agora se apresenta com mais clareza como produto real de hospitalidade
                  digital, sustentado por guestdesk.digital.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {HERO_METRICS.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[26px] border border-white/10 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="produto"
          className="mt-6 rounded-[36px] bg-white p-6 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.32)] ring-1 ring-slate-200/80 md:p-8"
        >
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Produto
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Um SaaS orientado à hospitalidade, com valor claro para operação, equipe e hóspede.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              LibGuest centraliza serviços, contatos, políticas e informações essenciais em uma
              experiência digital mais clara, elegante e fácil de manter no dia a dia do hotel.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PRODUCT_STORIES.map((item) => (
              <div
                key={item.title}
                className="rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {item.eyebrow}
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
              Benefícios
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Mais maturidade de produto, menos improviso operacional.
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
              Para quem é
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Uma base mais forte para hotelaria digital com apresentação comercial convincente.
            </h2>

            <div className="mt-6 grid gap-3">
              {USE_CASES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.18)]"
                >
                  <p className="text-base font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.65)] ring-1 ring-slate-900/10 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
                PRÓXIMO PASSO
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Leve uma experiência digital mais clara, elegante e profissional para o seu hotel.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                LibGuest reúne operação e experiência pública em uma base digital simples de
                atualizar, organizada para a equipe e mais útil para o hóspede.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 shadow-[0_14px_30px_-18px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Entrar no painel
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
                LibGuest ajuda hotéis a organizar melhor sua presença digital, com mais clareza
                operacional e uma experiência pública mais consistente.
              </p>
              <p className="font-medium text-slate-100">LibGuest</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

interface HomePageProps {
  searchParams?: Promise<{
    lang?: string;
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const domainContext = await getRequestDomainContext();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = normalizePublicLanguage(resolvedSearchParams?.lang);

  if (isHotelSubdomainContext(domainContext)) {
    const pageData = await getPublicHotelPageDataBySubdomain(domainContext.subdomain, language);

    if (!pageData) {
      notFound();
    }

    return (
      <HotelPublicPageContent
        hotel={pageData.hotel}
        announcements={pageData.announcements}
        sections={pageData.sections}
        departments={pageData.departments}
        policies={pageData.policies}
        language={language}
        domainContext={domainContext}
        hasFallbackContent={pageData.hasFallbackContent}
        preferSubdomainRoot
      />
    );
  }

  return <LandingPageContent />;
}
