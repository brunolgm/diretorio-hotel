import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import { updateDepartmentAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDepartmentPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: department, error } = await supabase
    .from('hotel_departments')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !department) {
    throw new Error('Departamento não encontrado.');
  }

  const action = updateDepartmentAction.bind(null, id);

  return (
    <main className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">Editar registro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Editar departamento</h1>
      </div>

      <form action={action} className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Nome</label>
            <input
              name="name"
              defaultValue={department.name || ''}
              className="w-full rounded-2xl border px-4 py-3"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea
              name="description"
              defaultValue={department.description || ''}
              className="min-h-28 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Horário</label>
            <input
              name="hours"
              defaultValue={department.hours || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Texto do botão</label>
            <input
              name="action"
              defaultValue={department.action || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Link</label>
            <input
              name="url"
              defaultValue={department.url || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium md:col-span-2">
            <input type="checkbox" name="enabled" defaultChecked={department.enabled ?? false} />
            Ativo no diretório
          </label>
        </div>

        <div className="mt-6">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
            Salvar alterações
          </button>
        </div>
      </form>
    </main>
  );
}