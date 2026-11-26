'use server';
import {revalidatePath} from 'next/cache';
import {requireAdminAccess} from '@/lib/auth';
import {requireHotelModule} from '@/lib/admin-entitlements';
import {createClient} from '@/lib/supabase/server';
import {orderRpc,OrderBoundaryError} from '@/lib/fb/orders/rpc.server';
import {parseRoomNameForm,type RoomNameActionState} from '@/lib/fb/room-name-translations';

export async function saveRoomNameTranslation(_:RoomNameActionState,form:FormData):Promise<RoomNameActionState> {
  await requireAdminAccess('editor');
  await requireHotelModule('fb.menu');
  let args:ReturnType<typeof parseRoomNameForm>;
  try{args=parseRoomNameForm(form);}catch{return {error:'Confira os dois nomes, com até 160 caracteres por idioma.'};}
  let revision:number;
  try {
    revision=await orderRpc<number>(await createClient(),'save_current_bugan_room_name_translation',args);
    if(revision!==args.p_revision+1)throw Error('unconfirmed');
  }catch(error){
    if(error instanceof OrderBoundaryError){
      if(error.status===409)return {error:'O nome original ou a tradução mudou. Recarregue a página e revise antes de salvar.'};
      if(error.status===403)return {error:'Este acesso não pode editar as traduções do Room Service do Bugan.'};
      if(error.status===400)return {error:'Confira o conteúdo e os nomes informados.'};
    }
    return {error:'Não foi possível confirmar a gravação. Recarregue a página para conferir antes de tentar novamente.'};
  }
  revalidatePath('/admin/cardapio/comercial/traducoes');
  revalidatePath('/room-service');
  revalidatePath('/hotel/[slug]/room-service','page');
  return {success:'Traduções salvas.',revision,saved_en:args.p_name_en,saved_es:args.p_name_es};
}
