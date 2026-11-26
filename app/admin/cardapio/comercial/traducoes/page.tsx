import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {orderRpc,OrderBoundaryError} from '@/lib/fb/orders/rpc.server';
import {roomNameEditorRows,type RoomNameRow} from '@/lib/fb/room-name-translations';
import {AdminPageHero} from '@/components/admin/ui';
import {FbRoomNameTranslations} from '@/components/admin/fb-room-name-translations';

export default async function RoomNameTranslationsPage() {
  await requireAdminAccess('editor');
  let rows:RoomNameRow[];
  try{rows=await orderRpc<RoomNameRow[]>(await createClient(),'get_current_bugan_room_texts');}
  catch(error){if(error instanceof OrderBoundaryError&&error.status===403)redirect('/admin/acesso-negado');throw error;}
  return <main className="space-y-4">
    <Link className="underline" href="/admin/cardapio/comercial">Voltar a combos e adicionais</Link>
    <AdminPageHero eyebrow="Bugan Recife · Room Service" title="Traduções do Room Service"
      description="Edite nomes, descrições de produtos e títulos de categorias em inglês e espanhol."/>
    <p className="text-sm text-[var(--admin-muted)]">Ao salvar, os textos são atualizados para os hóspedes do Room Service. Os textos originais, os preços e as regras comerciais são preservados.</p>
    <FbRoomNameTranslations rows={roomNameEditorRows(rows)}/>
  </main>;
}
