import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import {
  createDepartmentAction,
  deleteDepartmentAction,
  toggleDepartmentAction,
} from './actions';

export default async function AdminDepartmentsPage() {
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: departments, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar departamentos.');
  }

  return (
    <main className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Atendimento</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Departamentos</h1>
        <p className="mt-2 text-sm text-slate-600">Cadastre os setores de contato exibidos ao hóspede.</p>
      </div>

      <form action={createDepartmentAction} className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold">Novo departamento</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Nome</label>
            <input name="name" className="w-full rounded-2xl border px-4 py-3" required />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea name="description" className="min-h-28 w-full rounded-2xl border px-4 py-3" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Horário</label>
            <input name="hours" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Texto do botão</label>
            <input name="action" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Link</label>
            <input name="url" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium md:col-span-2">
            <input type="checkbox" name="enabled" defaultChecked />
            Ativo no diretório
          </label>
        </div>

        <div className="mt-6">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
            Criar departamento
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {departments?.map((item) => (
          <div key={item.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  {!item.enabled ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                      Inativo
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs text-slate-500">{item.hours || 'Sem horário informado'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/departamentos/${item.id}`}
                  className="rounded-2xl border px-4 py-3 text-sm font-medium"
                >
                  Editar
                </Link>

                <form action={toggleDepartmentAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="enabled" value={String(!item.enabled)} />
                  <button className="rounded-2xl border px-4 py-3 text-sm font-medium">
                    {item.enabled ? 'Desativar' : 'Ativar'}
                  </button>
                </form>

                <form action={deleteDepartmentAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="rounded-2xl border px-4 py-3 text-sm font-medium text-red-600">
                    Excluir
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}