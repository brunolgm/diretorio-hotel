import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import { createSectionAction, deleteSectionAction, toggleSectionAction } from './actions';
import { FeedbackToast } from '@/components/feedback-toast';

interface AdminServicesPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function AdminServicesPage({
  searchParams,
}: AdminServicesPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;

  const { data: sections, error } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar serviços do hotel.');
  }

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

      <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
        <p className="text-sm text-slate-500">Cadastro dinâmico</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Serviços e seções
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Cadastre os cards exibidos no diretório do hóspede.
        </p>
      </div>

      <form
        action={createSectionAction}
        className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
      >
        <h2 className="text-lg font-semibold">Novo serviço</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Título</label>
            <input name="title" className="w-full rounded-2xl border px-4 py-3" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Ícone</label>
            <input
              name="icon"
              defaultValue="Globe"
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Categoria</label>
            <input name="category" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Descrição</label>
            <textarea
              name="content"
              className="min-h-28 w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Texto do botão</label>
            <input name="cta" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Link</label>
            <input name="url" className="w-full rounded-2xl border px-4 py-3" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Ordem</label>
            <input
              type="number"
              name="sort_order"
              defaultValue="0"
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked />
            Ativo no diretório
          </label>
        </div>

        <div className="mt-6">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
            Criar serviço
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {sections?.map((item) => (
          <div
            key={item.id}
            className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {item.category || 'Sem categoria'}
                  </span>
                  {!item.enabled ? (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                      Inativo
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.content}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Botão: {item.cta || '—'} • Ordem: {item.sort_order ?? 0}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/servicos/${item.id}`}
                  className="rounded-2xl border px-4 py-3 text-sm font-medium"
                >
                  Editar
                </Link>

                <form action={toggleSectionAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="enabled" value={String(!item.enabled)} />
                  <button className="rounded-2xl border px-4 py-3 text-sm font-medium">
                    {item.enabled ? 'Desativar' : 'Ativar'}
                  </button>
                </form>

                <form action={deleteSectionAction}>
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