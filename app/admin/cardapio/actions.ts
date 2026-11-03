'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule, hasHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { fbAdminHref } from '@/lib/fb/admin';
import { translateFbFields } from '@/lib/services/translation-service';
import { syncFbTranslations } from '@/lib/fb/translations';
import { FB_TABLES, isFbKind, type FbKind, type FbRecord } from '@/lib/fb/types';
import { fbAdminError, fbFormPatch, uuid } from '@/lib/fb/validation';
import { cleanupFbImage } from '@/lib/fb/media';

export type FbFormState = {error?:string};
async function context() {
  const {profile} = await requireAdminAccess('operador'); await requireHotelModule('fb.menu');
  return {profile,client:await createClient()};
}
function identity(form:FormData) {
  const kind=form.get('kind'), id=String(form.get('id')||''), revision=Number(form.get('revision'));
  if (!isFbKind(kind) || (id&&!uuid(id)) || !Number.isSafeInteger(revision) || revision<0 || !form.has('revision')) throw new Error('fb_revision_conflict');
  return {kind,id,revision};
}
function finish(kind:FbKind, feedback:{success?:string;warning?:string;error?:string},id?:string,parent?:string):never {
  revalidatePath('/admin/cardapio'); revalidatePath('/admin/idiomas');
  revalidatePath('/hotel/[slug]','layout'); revalidatePath('/explorar/cardapio'); revalidatePath('/preview','layout');
  redirect(fbAdminHref(kind,feedback,id,parent));
}
export async function saveFbAction(_state:FbFormState,form:FormData):Promise<FbFormState> {
  const {client,profile}=await context(); let ids;let values;
  try { ids=identity(form); values=fbFormPatch(ids.kind,form); } catch(error) { return {error:fbAdminError(error as Error)}; }
  const {data,error}=await client.rpc('save_current_hotel_fb',{p_kind:ids.kind,p_id:ids.id||null,p_expected_revision:ids.revision,p_values:values});
  if (error || !data || typeof data!=='object' || Array.isArray(data)) return {error:fbAdminError(error||{})};
  const row=data as unknown as FbRecord;
  if(typeof row.id!=='string'||!uuid(row.id)||row.hotel_id!==profile.hotel_id||(ids.id&&row.id!==ids.id)||row.revision!==ids.revision+1||!Number.isInteger(row.source_revision)||row.source_revision<1||typeof row.name!=='string')return {error:'Resposta da gravação não confirmada. Recarregue a lista antes de tentar novamente.'};
  let warning:string|undefined;
  try {
    const translated=await syncFbTranslations(ids.kind,row,{
      languagesEnabled:()=>hasHotelModule('content.languages'),translate:translateFbFields,
      save:async(language,revision,fields)=>{
        const result=await client.rpc('save_current_hotel_fb_translation',{p_kind:ids.kind,p_id:row.id,p_language:language,p_source_revision:revision,p_fields:fields});
        if(result.error)throw new Error('fb_translation_failed');return result.data===true;
      },
    });
    if (Object.values(translated).some(v=>v==='stale'||v==='failed')) warning='Português salvo. Traduções incompletas ou desatualizadas; o público mantém fallback em PT.';
  } catch { warning='Português salvo. Não foi possível confirmar as traduções.'; }
  finish(ids.kind,{success:'Conteúdo gastronômico salvo.',warning},row.id);
}
export async function deleteFbAction(form:FormData) {
  const {client,profile}=await context();const ids=identity(form);
  if (!ids.id || form.get('confirm_delete')!=='yes') finish(ids.kind,{error:'Confirme a exclusão definitiva.'},ids.id);
  const result=await client.rpc('delete_current_hotel_fb',{p_kind:ids.kind,p_id:ids.id,p_expected_revision:ids.revision});
  const data=result.data as {deleted_id?:string;images?:{kind:FbKind;id:string;path:string}[]}|null;
  if(result.error || data?.deleted_id!==ids.id) finish(ids.kind,{error:fbAdminError(result.error||{})},ids.id);
  let warning:string|undefined;
  if(data.images?.length) {
    try {
      const {createAdminClient}=await import('@/lib/supabase/admin');const storage=createAdminClient().storage.from('hotel-assets');
      for(const image of data.images) {
        const clean=await cleanupFbImage({remove:path=>storage.remove([path]),log:()=>console.error('F&B deleted-image cleanup needs review')},profile.hotel_id,image.kind,image.id,image.path,null);
        if(!clean)warning='Conteúdo excluído. Há mídia pendente de limpeza.';
      }
    }catch{warning='Conteúdo excluído. Há mídia pendente de limpeza.';}
  }
  finish(ids.kind,{success:'Conteúdo excluído definitivamente.',warning});
}
export async function moveFbAction(form:FormData) {
  const {client}=await context();const ids=identity(form);let rows:{id:string;revision:number}[];
  try{rows=JSON.parse(String(form.get('rows')));}catch{finish(ids.kind,{error:'Recarregue a lista.'});}
  if(!Array.isArray(rows)||rows.length>5000||rows.some(r=>!r||!uuid(r.id)||!Number.isInteger(r.revision)||r.revision<1))finish(ids.kind,{error:'Recarregue a lista.'});
  const index=rows.findIndex(r=>r.id===ids.id);const direction=form.get('direction');
  if(!['up','down'].includes(String(direction))||index<0)finish(ids.kind,{error:'Ordem inválida.'});
  const next=index+(direction==='up'?-1:1);if(next<0||next>=rows.length)finish(ids.kind,{});
  [rows[index],rows[next]]=[rows[next],rows[index]];
  const parent=String(form.get('parent_id')||'');if(parent&&!uuid(parent))finish(ids.kind,{error:'Associação inválida.'});
  const result=await client.rpc('reorder_current_hotel_fb',{p_kind:ids.kind,p_parent_id:parent||null,p_rows:rows});
  finish(ids.kind,result.error?{error:fbAdminError(result.error)}:{success:'Ordem atualizada.'},undefined,parent||undefined);
}
export async function uploadFbImageAction(form:FormData) { await changeImage(form,false); }
export async function removeFbImageAction(form:FormData) { await changeImage(form,true); }
async function changeImage(form:FormData,remove:boolean) {
  const {client,profile}=await context();const ids=identity(form);
  if(!ids.id||!['outlet','item'].includes(ids.kind))finish(ids.kind,{error:'Imagem indisponível.'},ids.id);
  const read=async()=>{
    const result=await client.from(FB_TABLES[ids.kind]).select('*').eq('hotel_id',profile.hotel_id).eq('id',ids.id).maybeSingle();
    if(result.error||!result.data||!('main_image_path' in result.data))throw new Error('fb_not_found');const path=result.data.main_image_path;if(path!==null&&typeof path!=='string')throw new Error('fb_image_invalid');return path;
  };
  let oldPath:string|null;
  try{oldPath=await read();}catch{finish(ids.kind,{error:'Conteúdo não encontrado.'},ids.id);}
  const {buildHotelAssetStoragePath,validateImageUpload,IMAGE_UPLOAD_POLICIES}=await import('@/lib/security/image-upload');
  const {isOwnedFbImagePath}=await import('@/lib/fb/media');
  let validated:Awaited<ReturnType<typeof validateImageUpload>>|undefined;let path:string|null=null;
  if(!remove){
    const file=form.get('image');if(!(file instanceof File)||!file.size)finish(ids.kind,{error:'Selecione uma imagem.'},ids.id);
    validated=await validateImageUpload(file,IMAGE_UPLOAD_POLICIES.tourism);
    if(!validated.ok)finish(ids.kind,{error:'Envie JPEG, PNG ou WebP válido, até 2 MiB, 6000 × 4000 e 24 milhões de pixels.'},ids.id);
    path=buildHotelAssetStoragePath({hotelId:profile.hotel_id,category:'fb',resourceId:ids.kind+'/'+ids.id,extension:validated.value.extension});
  }
  const {createAdminClient}=await import('@/lib/supabase/admin');const storage=createAdminClient().storage.from('hotel-assets');
  if(path&&validated?.ok){const upload=await storage.upload(path,validated.value.bytes,{contentType:validated.value.mimeType,upsert:false});if(upload.error)finish(ids.kind,{error:'Falha no upload. Imagem anterior preservada.'},ids.id);}
  const {associateTourismImage}=await import('@/lib/tourism/image');
  const feedback=await associateTourismImage({hotelId:profile.hotel_id,itemId:ids.id,oldPath,newPath:path,revision:String(ids.revision),errorMessage:fbAdminError,
    ownsPath:(p,h,id)=>isOwnedFbImagePath(p,h,ids.kind,id),
    io:{read,remove:p=>storage.remove([p]),log:()=>console.error('F&B image association needs reconciliation'),associate:async(p,revision)=>{
      const result=await client.rpc('set_current_hotel_fb_image',{p_kind:ids.kind,p_id:ids.id,p_expected_revision:Number(revision),p_path:p});
      return {data:result.data as unknown as import('@/lib/tourism/image').ImageAssociation|null,error:result.error};
    }},
  });
  finish(ids.kind,feedback,ids.id);
}
