import {readFileSync} from 'node:fs';
import {parsePublicPresentation} from '../lib/public-presentation.ts';
import {normalizeTourismPatch} from '../lib/tourism/validation.ts';
const fields=['name','short_description','full_description','opening_hours','price_info','duration_info'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const equivalent=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const match=(row,patch)=>Object.entries(patch).every(([k,v])=>row?.[k]===v);
const must=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
export function tourismEditorialPlan(manifest){
 must(manifest.version===1&&/^[0-9a-f-]{36}$/.test(manifest.hotelId)&&/^[a-z0-9-]{1,64}$/.test(manifest.namespace),'INVALID_MANIFEST');
 must(manifest.expectedStatus==='suspended'&&manifest.entries?.length<=32&&manifest.destinations?.length===4,'INVALID_MANIFEST');
 for(const e of manifest.entries){must(e.domain==='tourism'&&e.key&&e.values?.name,'INVALID_MANIFEST');normalizeTourismPatch(e.values);for(const lang of ['en','es'])must(fields.every(k=>!e.values[k]||e.translations?.[lang]?.[k]?.trim()),'TRANSLATIONS_REQUIRED');}
 const expected={...JSON.parse(readFileSync('docs/bootstrap/bugan-public-v3-refinement-20261028.json','utf8')).configuration,experienceVersion:'v4'};
 const desired=structuredClone(expected);desired.tourism.cards.forEach((c,i)=>{c.destination=manifest.destinations[i];});
 must(parsePublicPresentation(desired,manifest.hotelId),'INVALID_MANIFEST');
 return {expected,desired};
}
export async function applyTourismEditorial(client,manifest,onProgress=()=>{}){
 const {expected,desired}=tourismEditorialPlan(manifest);let writesAttempted=false;
 const progress=(stage,operation)=>onProgress({stage,operation,writesAttempted});
 const read=async(operation,promise)=>{progress(writesAttempted?'readback':'preflight',operation);const r=await promise;if(r.error)throw r.error;return r.data;};
 progress('authorization','auth.getUser');const user=await client.auth.getUser();must(!user.error&&user.data?.user,'AUTH_REQUIRED');
 const profile=await read('profile.read',client.from('profiles').select('hotel_id,role,is_active').eq('id',user.data.user.id).single());
 must(profile?.hotel_id===manifest.hotelId&&profile.is_active&&['administrador','admin','owner'].includes(profile.role),'AUTHORIZATION_REQUIRED');
 const checkHotel=async()=>{const h=await read('hotel.read',client.from('hotels').select('id,platform_status,slug,subdomain').eq('id',manifest.hotelId).single());must(h?.platform_status==='suspended'&&h.slug==='bugan-recife'&&h.subdomain==='buganrecife','LIFECYCLE_CONFLICT');return h;};
 await checkHotel();
 const modules=await read('get_current_hotel_modules',client.rpc('get_current_hotel_modules'));
 must(['core.directory','content.tourism','content.languages','content.services','experience.appearance'].every(k=>modules?.some(m=>m.module_key===k&&m.is_enabled===true)),'MODULES_REQUIRED');
 const presentation=await read('presentation.read',client.from('hotel_public_presentation').select('configuration,revision').eq('hotel_id',manifest.hotelId).single());
 const already=equivalent(presentation?.configuration,desired);
 must(already||(presentation?.revision===manifest.expectedPresentationRevision&&equivalent(presentation.configuration,expected)),'PT409');
 const updates=[];
 for(const update of manifest.updates??[]){
  const source=await read('tourism.source.read',client.from('hotel_tourism_items').select('*').eq('hotel_id',manifest.hotelId).eq('id',update.id).single());
  const stable=Object.fromEntries(Object.entries(update.expected).filter(([key])=>!Object.hasOwn(update.values,key)));
  const done=match(source,update.values);must(source&&match(source,stable)&&(done||match(source,update.expected)),'PT409');
  const translations=await read('tourism.translations.read',client.from('hotel_tourism_item_translations').select('*').eq('item_id',update.id));
  for(const lang of ['en','es']){const current=translations.find(t=>t.language===lang),before=update.previousTranslations[lang],after={...before,...update.translations[lang]};must((!current&&done)||match(current,before)||match(current,after),'PT409');}
  updates.push({update,source,done});
 }
 const correction=manifest.translationCorrection;
 const restaurant=await read('service.source.read',client.from('hotel_sections').select('id,title').eq('hotel_id',manifest.hotelId).eq('id',correction.sectionId).single());
 must(restaurant?.title===correction.title,'PT409');
 const titleRow=await read('service.translation.read',client.from('hotel_section_translations').select('*').eq('section_id',correction.sectionId).eq('language',correction.language).single());
 must(titleRow&&[correction.expectedTitle,correction.title].includes(titleRow.title),'PT409');
 const mediaCorrection=manifest.mediaTranslationCorrection;
 const mediaSource=await read('media.source.read',client.from('hotel_public_experience_media').select('revision,title').eq('hotel_id',manifest.hotelId).eq('slot',mediaCorrection.slot).single());
 const mediaTranslation=await read('media.translation.read',client.from('hotel_public_experience_media_translations').select('*').eq('hotel_id',manifest.hotelId).eq('slot',mediaCorrection.slot).eq('language',mediaCorrection.language).single());
 must(mediaSource?.title===mediaCorrection.title&&mediaTranslation&&[mediaCorrection.title,mediaCorrection.expectedTitle].includes(mediaTranslation.title),'PT409');
 // All source, translation and presentation checks above complete before the first mutation.
 await checkHotel();writesAttempted=true;progress('content','apply_current_hotel_bootstrap');
 const applied=await client.rpc('apply_current_hotel_bootstrap',{p_hotel_id:manifest.hotelId,p_namespace:manifest.namespace,p_manifest:{entries:manifest.entries.map(({key,domain,values})=>({key,domain,values}))}});
 if(applied.error)throw applied.error;must(Array.isArray(applied.data)&&applied.data.length===manifest.entries.length,'WRITE_UNCONFIRMED');
 for(const entry of manifest.entries){
  const record=applied.data.find(r=>r.key===entry.key);must(record,'WRITE_UNCONFIRMED');
  for(const lang of ['en','es']){
   await checkHotel();const values=Object.fromEntries(fields.map(k=>[k,entry.translations[lang][k]??null]));
   const existing=await read('new.translation.read',client.from('hotel_tourism_item_translations').select('*').eq('item_id',record.id).eq('language',lang).maybeSingle());
   if(existing){must(match(existing,values),'PT409');continue;}
   progress('translations','apply_current_hotel_bootstrap_translation');
   const r=await client.rpc('apply_current_hotel_bootstrap_translation',{p_hotel_id:manifest.hotelId,p_namespace:manifest.namespace,p_key:entry.key,p_language:lang,p_fields:values});if(r.error)throw r.error;must(r.data===true,'WRITE_UNCONFIRMED');
  }
 }
 for(const {update,source,done} of updates){
  await checkHotel();let current=source;
  if(!done){progress('enrichment','save_current_hotel_tourism_item');const r=await client.rpc('save_current_hotel_tourism_item',{p_item_id:update.id,p_changes:update.values,p_expected_updated_at:source.updated_at});if(r.error)throw r.error;must(r.data?.[0],'WRITE_UNCONFIRMED');current=r.data[0];}
  for(const lang of ['en','es']){
   const values={...update.previousTranslations[lang],...update.translations[lang]};
   const translation=await read('enrichment.translation.read',client.from('hotel_tourism_item_translations').select('*').eq('item_id',update.id).eq('language',lang).maybeSingle());
   if(match(translation,values))continue;
   must(!translation||match(translation,update.previousTranslations[lang]),'PT409');
   progress('enrichment','save_current_hotel_tourism_translation');const r=await client.rpc('save_current_hotel_tourism_translation',{p_item_id:update.id,p_language:lang,p_expected_updated_at:current.updated_at,p_changes:values});if(r.error)throw r.error;must(r.data===true,'WRITE_UNCONFIRMED');
  }
 }
 if(titleRow.title!==correction.title){
  progress('editorial','service.translation.update');const r=await client.from('hotel_section_translations').update({title:correction.title,updated_at:new Date().toISOString()}).eq('section_id',correction.sectionId).eq('language',correction.language).eq('updated_at',titleRow.updated_at).select('id');if(r.error)throw r.error;must(r.data?.length===1,'PT409');
 }
 if(mediaTranslation.title!==mediaCorrection.title){
  const current=await read('media.translation.recheck',client.from('hotel_public_experience_media_translations').select('*').eq('hotel_id',manifest.hotelId).eq('slot',mediaCorrection.slot).eq('language',mediaCorrection.language).single());
  must(equivalent(current,mediaTranslation),'PT409');progress('editorial','save_current_hotel_experience_media_translation');
  const r=await client.rpc('save_current_hotel_experience_media_translation',{p_slot:mediaCorrection.slot,p_language:mediaCorrection.language,p_expected_revision:mediaSource.revision,p_fields:{title:mediaCorrection.title,description:mediaTranslation.description,alt_text:mediaTranslation.alt_text,cta_label:mediaTranslation.cta_label}});if(r.error)throw r.error;must(r.data===true,'WRITE_UNCONFIRMED');
 }
 const items=await read('tourism.verify',client.from('hotel_tourism_items').select('*').eq('hotel_id',manifest.hotelId));
 const translations=await read('translations.verify',client.from('hotel_tourism_item_translations').select('*').in('item_id',items.map(i=>i.id)));
 let pending=0;for(const item of items)for(const lang of ['en','es']){const row=translations.find(t=>t.item_id===item.id&&t.language===lang);if(fields.some(k=>item[k]?.trim()&&!row?.[k]?.trim()))pending++;}
 must(!pending,'TRANSLATIONS_REQUIRED');for(const e of manifest.entries)must(items.some(i=>i.slug===e.key&&i.is_published),'WRITE_UNCONFIRMED');
 for(const entry of manifest.entries){const item=items.find(i=>i.slug===entry.key);must(item&&match(item,entry.values),'WRITE_UNCONFIRMED');for(const lang of ['en','es'])must(match(translations.find(t=>t.item_id===item.id&&t.language===lang),Object.fromEntries(fields.map(k=>[k,entry.translations[lang][k]??null]))),'WRITE_UNCONFIRMED');}
 for(const {update,source} of updates){const item=items.find(i=>i.id===update.id);must(match(item,update.values)&&item.short_description===source.short_description,'WRITE_UNCONFIRMED');for(const lang of ['en','es'])must(match(translations.find(t=>t.item_id===update.id&&t.language===lang),{...update.previousTranslations[lang],...update.translations[lang]}),'WRITE_UNCONFIRMED');}
 const finalTitle=await read('service.translation.verify',client.from('hotel_section_translations').select('title').eq('section_id',correction.sectionId).eq('language',correction.language).single());must(finalTitle?.title===correction.title,'WRITE_UNCONFIRMED');
 const finalMedia=await read('media.translation.verify',client.from('hotel_public_experience_media_translations').select('*').eq('hotel_id',manifest.hotelId).eq('slot',mediaCorrection.slot).eq('language',mediaCorrection.language).single());must(match(finalMedia,{title:mediaCorrection.title,description:mediaTranslation.description,alt_text:mediaTranslation.alt_text,cta_label:mediaTranslation.cta_label}),'WRITE_UNCONFIRMED');
 await checkHotel();const latest=await read('presentation.recheck',client.from('hotel_public_presentation').select('configuration,revision').eq('hotel_id',manifest.hotelId).single());
 if(!equivalent(latest.configuration,desired)){
  must(latest.revision===manifest.expectedPresentationRevision&&equivalent(latest.configuration,expected),'PT409');
  progress('presentation','save_current_hotel_public_presentation');const r=await client.rpc('save_current_hotel_public_presentation',{p_expected_revision:latest.revision,p_configuration:desired});if(r.error)throw r.error;must(r.data===latest.revision+1,'WRITE_UNCONFIRMED');
 }
 const after=await read('presentation.verify',client.from('hotel_public_presentation').select('configuration,revision').eq('hotel_id',manifest.hotelId).single());must(equivalent(after.configuration,desired),'WRITE_UNCONFIRMED');await checkHotel();
 return {status:'tourism_editorial_confirmed',hotelId:manifest.hotelId,revision:after.revision,lifecycle:'suspended',newItems:manifest.entries.length,createdThisRun:applied.data.filter(r=>r.status==='created').length,publishedItems:items.filter(i=>i.is_published).length,translationsPending:pending,googleUsed:false,storageWrites:false,airportWrites:false};
}
