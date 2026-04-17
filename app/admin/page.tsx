import Link from 'next/link';
import {
  LayoutDashboard,
  Hotel,
  ConciergeBell,
  Building2,
  ShieldCheck,
  ArrowRight,
  Eye,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';

function StatCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-700" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </Link>
  );
}

export default async function AdminPage() {
  await requireUser();
  const hotel = await getAdminHotel();

  return (
    <main className="space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-8 text-white shadow-sm md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Painel administrador
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
              {hotel.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              Gerencie o diretório digital do hotel com uma experiência moderna, organizada e
              preparada para operação diária.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Cidade</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {hotel.city || 'Não informada'}
              </p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Status</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Operacional
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Hotel}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Horário padrão configurado para entrada dos hóspedes."
        />
        <StatCard
          icon={Clock3}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Horário padrão configurado para saída dos hóspedes."
        />
        <StatCard
          icon={Eye}
          title="Diretório público"
          value="Online"
          description="A versão pública do diretório está publicada e acessível."
        />
        <StatCard
          icon={ShieldCheck}
          title="Admin"
          value="Protegido"
          description="Área administrativa com autenticação e rotas restritas."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <QuickLink
          href="/admin/hotel"
          icon={Hotel}
          title="Informações do hotel"
          text="Atualize nome, cidade, horários, Wi-Fi, links institucionais e logo."
        />
        <QuickLink
          href="/admin/servicos"
          icon={ConciergeBell}
          title="Serviços"
          text="Cadastre e organize os cards de serviços e informações do diretório."
        />
        <QuickLink
          href="/admin/departamentos"
          icon={Building2}
          title="Departamentos"
          text="Gerencie os setores de contato exibidos para os hóspedes."
        />
        <QuickLink
          href="/admin/politicas"
          icon={ShieldCheck}
          title="Políticas"
          text="Mantenha regras, orientações e políticas sempre atualizadas."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Acesso rápido</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Próximas ações recomendadas
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Revisar conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verifique descrições, textos dos botões, horários e links finais do hotel.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Validar identidade visual</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confira logo oficial, cores, favicon e consistência visual da operação.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Testar jornada do hóspede</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Navegue pela rota pública e simule o uso do diretório no celular.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Gerar QR Code</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Prepare a distribuição do acesso público para quartos, recepção e áreas comuns.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-sm text-slate-500">Resumo do ambiente</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Situação atual
          </h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Diretório publicado</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O sistema já está online e o painel administrativo está acessível.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">CRUD operacional</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Serviços, departamentos e políticas podem ser criados, editados e removidos.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">Logo e conteúdo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O hotel já pode ajustar identidade visual e finalizar os textos do diretório.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}