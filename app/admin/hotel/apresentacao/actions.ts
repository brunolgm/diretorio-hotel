'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAdminAccess} from '@/lib/auth';
import {requireHotelModule} from '@/lib/admin-entitlements';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {parsePublicPresentation} from '@/lib/public-presentation';
import {validateImageUpload,IMAGE_UPLOAD_POLICIES,buildHotelAssetStoragePath} from '@/lib/security/image-upload';
import type {Json} from '@/types/database';
export async function savePresentationAction(form:FormData){
 const {profile}=await requireAdminAccess('editor');await requireHotelModule('experience.appearance');
 const finish: (error?:string)=>never = (error)=>redirect('/admin/hotel/apresentacao?'+(error?'error='+encodeURIComponent(error):'saved=1'));
 const client=await createClient();
 const revision=Number(form.get('revision'));
 const previous=await client.from('hotel_public_presentation').select('configuration,revision').eq('hotel_id',profile.hotel_id).maybeSingle();
 if(previous.error||!Number.isSafeInteger(revision)||revision<0||(previous.data?.revision??0)!==revision)finish('A configuração mudou. Recarregue antes de salvar.');
 let raw:unknown;try{raw=JSON.parse(String(form.get('configuration')));}catch{finish('Revise os dados editoriais.');}
 const config=parsePublicPresentation(raw,profile.hotel_id);
 if(!config)finish('Revise os textos, os idiomas e os pontos focais.');
 const prior=parsePublicPresentation(previous.data?.configuration,profile.hotel_id);
 const allowed=new Set(prior?.tourism.cards.map(c=>c.image_path).filter(Boolean));
 const uploads:{path:string;bytes:Uint8Array;mime:string}[]=[];
 for(const [index,card] of config.tourism.cards.entries()){
  if(card.image_path&&!allowed.has(card.image_path))finish('Imagem não pertence à configuração anterior. Envie um arquivo.');
  const file=form.get(`image_${index}`);
  if(file instanceof File&&file.size){
   const image=await validateImageUpload(file,{...IMAGE_UPLOAD_POLICIES.hero,maxBytes:2*1024*1024});
   if(!image.ok)finish('Envie JPEG, PNG ou WebP válido, até 2 MiB e dentro dos limites de imagem.');
   card.image_path=buildHotelAssetStoragePath({hotelId:profile.hotel_id,category:'hero',resourceId:'editorial',extension:image.value.extension});
   uploads.push({path:card.image_path,bytes:image.value.bytes,mime:image.value.mimeType});
  }
 }
 if(uploads.reduce((n,u)=>n+u.bytes.byteLength,0)>2*1024*1024)finish('As imagens deste envio devem somar no máximo 2 MiB.');
 // Server-only, fresh paths, no overwrites. Uncertain outcomes retain files for review.
 const storage=createAdminClient().storage.from('hotel-assets');
 for(const upload of uploads){const r=await storage.upload(upload.path,upload.bytes,{contentType:upload.mime,upsert:false});if(r.error)finish('Envio não confirmado. A configuração anterior foi preservada.');}
 let saved;try{saved=await client.rpc('save_current_hotel_public_presentation',{p_expected_revision:revision,p_configuration:config as unknown as Json});}
 catch{finish('Resposta incerta. Nenhum arquivo anterior foi removido. Recarregue para conferir.');}
 if(saved.error||saved.data!==revision+1)finish('Gravação não confirmada. Recarregue para conferir antes de repetir.');
 revalidatePath('/preview');revalidatePath('/','layout');finish();
}
