'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { getAdminHotel } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import { readTrimmedString } from '@/lib/form-utils';
import { syncSectionTranslations, buildFeedbackRedirect } from '@/lib/services/translation-admin';
import { SERVICE_EDITORIAL_FIELDS, eligibleServiceTranslationFields, serviceManualReviewChanges } from '@/lib/services/service-editorial-fields';

async function context(form:FormData){
  await requireAdminAccess('operador');await requireHotelModule('content.services');await requireHotelModule('content.languages');
  const hotel=await getAdminHotel(),supabase=await createClient(),id=readTrimmedString(form,'id'),language=readTrimmedString(form,'language');
  if(!isUuid(id)||!['en','es'].includes(language))redirect('/admin/servicos?error=Serviço%20ou%20idioma%20inválido');
  const {data:source,error}=await supabase.from('hotel_sections').select('*').eq('id',id).eq('hotel_id',hotel.id).single();
  if(error||!source)redirect('/admin/servicos?error=Serviço%20indisponível');
  return {hotel,supabase,id,language:language as 'en'|'es',source};
}
export async function reviewServiceTranslationAction(form:FormData){
  const {supabase,id,language,source}=await context(form);
  const {data:row,error:readError}=await supabase.from('hotel_section_translations').select('*').eq('section_id',id).eq('language',language).maybeSingle();
  if(readError||source.updated_at!==readTrimmedString(form,'source_version')||(row?.updated_at||null)!==(readTrimmedString(form,'translation_version')||null))redirect(buildFeedbackRedirect('/admin/servicos/'+id,{warning:'O conteúdo ou a tradução mudou. Recarregue antes de salvar sua revisão.'}));
  const submitted=Object.fromEntries(SERVICE_EDITORIAL_FIELDS.filter(field=>form.has(field)).map(field=>[field,readTrimmedString(form,field)||null]));
  const changes=serviceManualReviewChanges(source,row||undefined,language,submitted,SERVICE_EDITORIAL_FIELDS.filter(field=>form.get('review_'+field)==='1'));
  if(!Object.keys(changes).length)redirect(buildFeedbackRedirect('/admin/servicos/'+id,{warning:'Nenhum texto foi alterado. Para confirmar um texto sem modificá-lo, marque a revisão desse campo.'}));
  const {data,error}=await supabase.rpc('save_current_hotel_service_translation',{p_section_id:id,p_language:language,p_expected_source_version:readTrimmedString(form,'source_version'),p_expected_translation_version:readTrimmedString(form,'translation_version')||null,p_fields:changes,p_origin:'manual',p_replace_manual:false});
  revalidatePath('/admin/servicos');revalidatePath('/admin/servicos/'+id);revalidatePath('/','layout');
  redirect(buildFeedbackRedirect('/admin/servicos/'+id,error?{error:'Não foi possível salvar a revisão. Verifique os limites dos campos.'}:!data?{warning:'O conteúdo ou a tradução mudou. Recarregue antes de salvar sua revisão.'}:{success:`Revisão ${language.toUpperCase()} salva.`}));
}
export async function translateServiceLanguageAction(form:FormData){
  const {supabase,id,language,hotel}=await context(form);
  const result=await syncSectionTranslations({supabase,sectionId:id,hotelId:hotel.id,languages:[language],force:form.get('force')==='1',replaceManual:form.get('replace_manual')==='1'});
  revalidatePath('/admin/servicos');revalidatePath('/admin/servicos/'+id);revalidatePath('/','layout');
  redirect(buildFeedbackRedirect('/admin/servicos/'+id,{success:result.status==='complete'?'Idioma atualizado.':undefined,warning:result.status==='complete'?null:'Português preservado. Há campos pendentes ou que precisam de revisão manual; consulte a situação abaixo.'}));
}

/** Explicit, bounded backfill of this operator's hotel; never runs on load or public access. */
export async function translatePendingHotelServicesAction(){
  await requireAdminAccess('operador');await requireHotelModule('content.services');await requireHotelModule('content.languages');
  const hotel=await getAdminHotel(),supabase=await createClient();
  const {data:sections,error}=await supabase.from('hotel_sections').select('*').eq('hotel_id',hotel.id).order('id').limit(1000);
  if(error)redirect('/admin/servicos?error=Não%20foi%20possível%20identificar%20as%20pendências');
  const {data:rows,error:rowError}=sections?.length?await supabase.from('hotel_section_translations').select('*').in('section_id',sections.map(s=>s.id)):{data:[],error:null};
  if(rowError)redirect('/admin/servicos?error=Não%20foi%20possível%20carregar%20as%20traduções');
  const pending=(sections||[]).filter(source=>(['en','es'] as const).some(language=>eligibleServiceTranslationFields(source,rows?.find(row=>row.section_id===source.id&&row.language===language),language).length));
  let complete=0;
  for(const source of pending.slice(0,5)){const result=await syncSectionTranslations({supabase,sectionId:source.id,hotelId:hotel.id});if(result.status==='complete')complete++;}
  revalidatePath('/admin/servicos');revalidatePath('/','layout');
  redirect(buildFeedbackRedirect('/admin/servicos',{success:`Pendências: ${Math.min(5,pending.length)} serviços verificados; ${complete} concluídos.`,warning:pending.length>complete?'Há pendências ou traduções manuais para revisar. Cada execução processa no máximo cinco serviços e preserva conteúdo manual.':null}));
}
