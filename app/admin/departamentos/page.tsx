import Link from 'next/link';
import {
  Building2,
  Phone,
  Clock3,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Plus,
  ArrowRight,
  Power,
  Pencil,
  Trash2,
  MessageCircle,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import {
  createDepartmentAction,
  deleteDepartmentAction,
  toggleDepartmentAction,
} from './actions';
import { FeedbackToast } from '@/components/feedback-toast';

interface AdminDepartmentsPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

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
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export default async function AdminDepartmentsPage({
  searchParams,
}: AdminDepartmentsPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;

  const { data: departments, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar departamentos.');
  }

  const totalDepartments = departments?.length || 0;
  const activeDepartments = departments?.filter((item) => item.enabled).length || 0;
  const inactiveDepartments = totalDepartments - activeDepartments;

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-8 text-white shadow-sm md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
              <Building2 className="h-3.5 w-3.5" />
              Gestão de departamentos
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
              Departamentos e contatos
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              Gerencie os setores que o hóspede pode acionar diretamente no diretório digital, com
              clareza, organização e resposta rápida.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
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
          icon={Users}
          title="Total de departamentos"
          value={String(totalDepartments)}
          description="Quantidade total de setores cadastrados no painel."
        />
        <StatCard
          icon={Phone}
          title="Ativos"
          value={String(activeDepartments)}
          description="Setores atualmente visíveis para contato no diretório."
        />
        <StatCard
          icon={Power}
          title="Inativos"
          value={String(inactiveDepartments)}
          description="Departamentos cadastrados, mas ocultos no momento."
        />
        <StatCard
          icon={ShieldCheck}
          title="Atendimento"
          value="Organizado"
          description="Os contatos do hotel podem ser mantidos sempre atualizados."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <form
          action={createDepartmentAction}
          className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Cadastro rápido</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Novo departamento
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cadastre setores como Recepção, Reservas, Governança, Eventos e outros canais de
                atendimento do hotel.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-slate-100 p-3 text-slate-700 md:block">
              <Plus className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Nome</label>
              <input
                name="name"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                required
                placeholder="Ex.: Recepção"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Descrição</label>
              <textarea
                name="description"
                className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="Descreva como esse departamento atende o hóspede."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Horário</label>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="hours"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="Ex.: 24 horas"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Texto do botão</label>
              <input
                name="action"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="Ex.: Falar com a Recepção"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Link</label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="url"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://... ou link do WhatsApp"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked />
              Ativo no diretório
            </label>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" />
              Criar departamento
            </button>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              <Sparkles className="h-3.5 w-3.5" />
              Os contatos aparecem automaticamente para o hóspede
            </div>
          </div>
        </form>

        <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Setores cadastrados</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Lista de departamentos
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Edite, ative, desative ou remova os canais de atendimento disponíveis.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              <ArrowRight className="h-3.5 w-3.5" />
              Gestão rápida
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {departments?.length ? (
              departments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 transition hover:bg-white"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                          {item.name}
                        </h3>

                        {!item.enabled ? (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Inativo
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                            Ativo
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.description || 'Sem descrição cadastrada.'}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Horário: {item.hours || 'Não informado'}</span>
                        <span>Botão: {item.action || '—'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/departamentos/${item.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Link>

                      <form action={toggleDepartmentAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="enabled" value={String(!item.enabled)} />
                        <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                          <Power className="mr-2 h-4 w-4" />
                          {item.enabled ? 'Desativar' : 'Ativar'}
                        </button>
                      </form>

                      <form action={deleteDepartmentAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <p className="text-base font-semibold text-slate-900">
                  Nenhum departamento cadastrado ainda
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Crie o primeiro setor de atendimento para exibir canais de contato ao hóspede.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}