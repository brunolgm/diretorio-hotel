import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import { updatePolicyAction } from './actions';
import { FeedbackToast } from '@/components/feedback-toast';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function EditPolicyPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const { data: policy, error } = await supabase
    .from('hotel_policies')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !policy) {
    throw new Error('Política não encontrada.');
  }

  const action = updatePolicyAction.bind(null, id);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

      <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
        <p className="text-sm text-slate-500">Editar registro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Editar política
        </h1>
      </div>

      <form
        action={action}
        className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
      >
        <div className="grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Título</label>
            <input
              name="title"
              defaultValue={policy.title || ''}
              className="w-full rounded-2xl border px-4 py-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea
              name="description"
              defaultValue={policy.description || ''}
              className="min-h-28 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={policy.enabled ?? false} />
            Ativa no diretório
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