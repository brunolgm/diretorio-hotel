import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { orderRpc, OrderBoundaryError } from '@/lib/fb/orders/rpc.server';
import type { RoomCommercial } from '@/lib/fb/room-commercial';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHero } from '@/components/admin/ui';
import { FbRoomCommercial } from '@/components/admin/fb-room-commercial';

const path = '/admin/cardapio/comercial';

export default async function RoomCommercialPage({ searchParams }: {
  searchParams: Promise<{ tipo?: string; editar?: string; salvo?: string }>;
}) {
  await requireAdminAccess('editor');
  const params = await searchParams;
  let data: RoomCommercial;
  try {
    data = await orderRpc<RoomCommercial>(await createClient(), 'get_current_bugan_room_commercial');
  } catch (error) {
    if (error instanceof OrderBoundaryError && error.status === 403) redirect('/admin/acesso-negado');
    throw error;
  }
  const kind = params.tipo === 'combo' || params.tipo === 'group' ? params.tipo : null;
  const draft = kind === 'combo' ? data.combos.find(row => row.id === params.editar)
    : kind === 'group' ? data.groups.find(row => row.id === params.editar) : undefined;
  if (params.editar && (!draft || draft.active)) redirect(path);

  return <main className="space-y-4">
    <Link className="underline" href="/admin/cardapio">Voltar a Gastronomia</Link>
    <AdminPageHero eyebrow="Bugan Recife · Room Service" title="Combos e adicionais"
      description="Prepare rascunhos comerciais exclusivos do Room Service. Salvar aqui não ativa a oferta para o hóspede."/>
    {params.salvo === '1' ? <p role="status">Rascunho salvo para revisão.</p> : null}
    <FbRoomCommercial key={kind + ':' + (draft?.id ?? 'novo')} data={data} kind={kind} draft={draft}/>
  </main>;
}
