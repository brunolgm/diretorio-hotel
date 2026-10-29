import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tourismEditorialPlan,applyTourismEditorial,equivalent} from '../../scripts/apply-tourism-editorial-core.mjs';
const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-tourism-v4-20261029.json','utf8'));
function harness(){
 const tables:Record<string,Record<string,unknown>[]>={profiles:[{id:'admin',hotel_id:manifest.hotelId,role:'administrador',is_active:true}],hotels:[{id:manifest.hotelId,platform_status:'suspended',slug:'bugan-recife',subdomain:'buganrecife'}],hotel_public_presentation:[{hotel_id:manifest.hotelId,configuration:tourismEditorialPlan(manifest).expected,revision:2}],hotel_tourism_items:[{id:manifest.updates[0].id,hotel_id:manifest.hotelId,slug:'praca-de-boa-viagem',is_published:true,...manifest.updates[0].expected,short_description:manifest.updates[0].expected.short_description,updated_at:'revision-1'}],hotel_tourism_item_translations:['en','es'].map(language=>({item_id:manifest.updates[0].id,language,...manifest.updates[0].previousTranslations[language]})),hotel_public_experience_media:[{hotel_id:manifest.hotelId,slot:'restaurant',revision:1,title:'Restaurante Filipe'}],hotel_public_experience_media_translations:[{hotel_id:manifest.hotelId,slot:'restaurant',language:'en',title:'Filipe Restaurant',description:'Approved description',alt_text:'Approved alt',cta_label:'Approved CTA'}],hotel_sections:[{id:manifest.translationCorrection.sectionId,hotel_id:manifest.hotelId,title:'Restaurante Filipe'}],hotel_section_translations:[{id:'translation',section_id:manifest.translationCorrection.sectionId,language:'en',title:'Filipe Restaurant',content:'Preserve approved content',updated_at:'translation-1'}]};
 const calls:string[]=[],registered=new Map<string,Record<string,unknown>>();let modules=['core.directory','content.tourism','content.languages','content.services','experience.appearance'];
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async(name:string,p:Record<string,unknown>={})=>{
  calls.push(name);if(name==='get_current_hotel_modules')return {data:modules.map(module_key=>({module_key,is_enabled:true}))};
  if(name==='apply_current_hotel_bootstrap'){
   const entries=(p.p_manifest as {entries:typeof manifest.entries}).entries;
   for(const e of entries){const old=registered.get(e.key);if(old&&!Object.entries(e.values).every(([k,v])=>old[k]===v))throw {code:'PT409'};if(!old&&tables.hotel_tourism_items.some(i=>i.name===e.values.name))throw {code:'PT409'};}
   const data=entries.map((e:typeof manifest.entries[number],i:number)=>{let row=registered.get(e.key);if(!row){row={id:'new-'+i,hotel_id:manifest.hotelId,slug:e.key,...e.values,updated_at:'new-source'};registered.set(e.key,row!);tables.hotel_tourism_items.push(row!);}return {key:e.key,id:row!.id,domain:'tourism'};});return {data};
  }
  if(name==='apply_current_hotel_bootstrap_translation'){const row=registered.get(String(p.p_key))!;tables.hotel_tourism_item_translations.push({item_id:row.id,language:p.p_language,...p.p_fields as object});return {data:true};}
  if(name==='save_current_hotel_tourism_item'){
   const row=tables.hotel_tourism_items.find(i=>i.id===p.p_item_id)!;assert.equal(p.p_expected_updated_at,row.updated_at);
   const patch=p.p_changes as Record<string,unknown>,changed=['name','short_description','full_description','opening_hours','price_info','duration_info'].filter(k=>Object.hasOwn(patch,k)&&row[k]!==patch[k]);
   Object.assign(row,patch,{updated_at:'changed-source'});
   tables.hotel_tourism_item_translations=tables.hotel_tourism_item_translations.filter(t=>t.item_id!==row.id||['name','short_description','full_description','opening_hours','price_info','duration_info'].some(k=>!changed.includes(k)&&t[k]!=null));
   for(const t of tables.hotel_tourism_item_translations.filter(t=>t.item_id===row.id)){for(const k of changed)t[k]=null;t.updated_at='invalidated';}
   return {data:[structuredClone(row)]};
  }
  if(name==='save_current_hotel_tourism_translation'){const row=tables.hotel_tourism_items.find(i=>i.id===p.p_item_id)!;if(p.p_expected_updated_at!==row.updated_at)return {data:false};const existing=tables.hotel_tourism_item_translations.find(t=>t.item_id===row.id&&t.language===p.p_language);if(existing)Object.assign(existing,p.p_changes,{updated_at:'translated'});else tables.hotel_tourism_item_translations.push({item_id:row.id,language:p.p_language,...p.p_changes as object});return {data:true};}
  if(name==='save_current_hotel_experience_media_translation'){assert.equal(p.p_expected_revision,1);Object.assign(tables.hotel_public_experience_media_translations[0],p.p_fields);return {data:true};}
  if(name==='save_current_hotel_public_presentation'){assert.equal(p.p_expected_revision,tables.hotel_public_presentation[0].revision);Object.assign(tables.hotel_public_presentation[0],{configuration:p.p_configuration,revision:3});return {data:3};}
  throw Error('Unexpected RPC');
 },from(table:string){const filters:((r:Record<string,unknown>)=>boolean)[]=[];let single=false,patch:object|undefined;const q={select:()=>q,eq(k:string,v:unknown){filters.push(r=>r[k]===v);return q;},in(k:string,v:unknown[]){filters.push(r=>v.includes(r[k]));return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},update(v:object){patch=v;calls.push('update:'+table);return q;},then(resolve:(value:unknown)=>unknown){const rows=tables[table].filter(r=>filters.every(f=>f(r)));if(patch)rows.forEach(r=>Object.assign(r,patch));return Promise.resolve({data:structuredClone(single?rows[0]??null:rows),error:null}).then(resolve);}};return q;}};
 return {client,tables,calls,setModules:(m:string[])=>{modules=m;}};
}
test('editorial plan has only verified new Tourism, no media, operational hotel patch or fabricated commercial tour',()=>{
 const plan=tourismEditorialPlan(manifest);assert.ok(plan.desired.tourism.cards.every((c:{destination?:unknown})=>c.destination));assert.equal(manifest.entries.length,5);for(const e of manifest.entries){assert.equal(e.domain,'tourism');assert.equal(e.values.type,'PLACE');assert.ok(e.values.official_website_url.startsWith('https:'));assert.ok(!e.values.price_info&&!e.values.opening_hours&&!e.values.main_image_path);}
});
test('authorization, module, presentation, PT source and manual translation conflicts cause zero writes',async()=>{
 for(const conflict of ['role','modules','presentation','source','translation']){const h=harness();if(conflict==='role')h.tables.profiles[0].role='visualizador';if(conflict==='modules')h.setModules([]);if(conflict==='presentation')h.tables.hotel_public_presentation[0].revision=99;if(conflict==='source')h.tables.hotel_tourism_items[0].full_description='Manual edit';if(conflict==='translation')h.tables.hotel_tourism_item_translations[0].short_description='Human translation';await assert.rejects(()=>applyTourismEditorial(h.client,manifest));assert.ok(h.calls.every(c=>c==='get_current_hotel_modules'));}
});
test('canonical flow enriches without replacing records, preserves approved fields and is idempotent',async()=>{
 const h=harness(),id=h.tables.hotel_tourism_items[0].id;const r=await applyTourismEditorial(h.client,manifest);assert.equal(r.status,'tourism_editorial_confirmed');assert.equal(r.translationsPending,0);assert.equal(r.lifecycle,'suspended');assert.equal(h.tables.hotel_tourism_items[0].id,id);assert.equal(h.tables.hotel_sections[0].title,'Restaurante Filipe');assert.equal(h.tables.hotel_section_translations[0].content,'Preserve approved content');
 const before=structuredClone(h.tables);await applyTourismEditorial(h.client,manifest);assert.ok(equivalent(h.tables,before));
 h.tables.hotel_tourism_items[1].full_description='Later human edit';await assert.rejects(()=>applyTourismEditorial(h.client,manifest));assert.equal(h.tables.hotel_tourism_items[1].full_description,'Later human edit');
});
test('a false successful translation response never associates cards before content verification',async()=>{
 const h=harness(),rpc=h.client.rpc;
 h.client.rpc=async(name,p={})=>name==='apply_current_hotel_bootstrap_translation'?{data:true}:rpc(name,p);
 await assert.rejects(()=>applyTourismEditorial(h.client,manifest));
 assert.ok(!h.calls.includes('save_current_hotel_public_presentation'));
 assert.equal(h.tables.hotel_public_presentation[0].revision,2);
});

const resumeCheckpoint=JSON.parse(readFileSync('docs/bootstrap/bugan-tourism-v4-resume-20261029.json','utf8'));
function resumeHarness(){
 const h=harness();
 h.tables.hotel_tourism_items=structuredClone(resumeCheckpoint.items);
 h.tables.hotel_tourism_item_translations=structuredClone(resumeCheckpoint.translations);
 h.tables.hotel_section_translations=[structuredClone(resumeCheckpoint.serviceTranslation)];
 h.tables.hotel_public_experience_media_translations=[structuredClone(resumeCheckpoint.mediaTranslation)];
 return h;
}
const resume=(h:ReturnType<typeof harness>)=>applyTourismEditorial(h.client,manifest,()=>{},{resumeCheckpoint});
const mutations=(calls:string[])=>calls.filter(c=>c!=='get_current_hotel_modules');

test('source RPC mock preserves translation rows and invalidates only the changed PT full_description',async()=>{
 const h=harness(),before=structuredClone(h.tables.hotel_tourism_item_translations);
 await h.client.rpc('save_current_hotel_tourism_item',{p_item_id:manifest.updates[0].id,p_expected_updated_at:'revision-1',p_changes:manifest.updates[0].values});
 assert.equal(h.tables.hotel_tourism_item_translations.length,2);
 for(const [index,row]of h.tables.hotel_tourism_item_translations.entries()){
  assert.equal(row.full_description,null);assert.equal(row.name,before[index].name);assert.equal(row.short_description,before[index].short_description);
 }
});

test('audited selective-invalidation resume writes only two full descriptions, two EN titles and presentation; second run writes nothing',async()=>{
 const h=resumeHarness(),before=structuredClone(h.tables),rpc=h.client.rpc,translationPatches:unknown[]=[];
 h.client.rpc=async(name,p={})=>{if(name==='save_current_hotel_tourism_translation')translationPatches.push(p.p_changes);return rpc(name,p);};
 const result=await resume(h);
 assert.equal(result.status,'tourism_reconciliation_confirmed');assert.equal(result.createdThisRun,0);assert.equal(result.publishedItems,7);assert.equal(result.translationsPending,0);assert.equal(result.revision,3);
 assert.deepEqual(translationPatches,['en','es'].map(lang=>manifest.updates[0].translations[lang]));
 assert.deepEqual(h.tables.hotel_tourism_items,before.hotel_tourism_items);
 assert.deepEqual(h.tables.hotels,before.hotels);assert.deepEqual(h.tables.profiles,before.profiles);assert.deepEqual(h.tables.hotel_public_experience_media,before.hotel_public_experience_media);
 const pracaId=manifest.updates[0].id;
 assert.deepEqual(h.tables.hotel_tourism_item_translations.filter(t=>t.item_id!==pracaId),before.hotel_tourism_item_translations.filter(t=>t.item_id!==pracaId));
 for(const row of h.tables.hotel_tourism_item_translations.filter(t=>t.item_id===pracaId)){
  const old=before.hotel_tourism_item_translations.find(t=>t.id===row.id)!;
  for(const key of Object.keys(old).filter(k=>!['full_description','updated_at'].includes(k)))assert.equal(row[key],old[key]);
 }
 assert.deepEqual(mutations(h.calls),['save_current_hotel_tourism_translation','save_current_hotel_tourism_translation','update:hotel_section_translations','save_current_hotel_experience_media_translation','save_current_hotel_public_presentation']);
 const completed=structuredClone(h.tables);h.calls.length=0;await resume(h);assert.deepEqual(h.tables,completed);assert.deepEqual(mutations(h.calls),[]);
});

test('directed preflight rejects missing, duplicated or edited confirmed data and unexpected presentation revisions before all writes',async()=>{
 for(const conflict of ['missing-item','duplicate-item','new-translation','missing-translation','shopping','praca-name','praca-full','title-content','media-alt','revision','changed-desired-revision','lifecycle','modules']){
  const h=resumeHarness();
  if(conflict==='missing-item')h.tables.hotel_tourism_items.pop();
  if(conflict==='duplicate-item')h.tables.hotel_tourism_items.push(structuredClone(h.tables.hotel_tourism_items[0]));
  if(conflict==='new-translation')h.tables.hotel_tourism_item_translations.find(t=>t.item_id!==manifest.updates[0].id)!.name='Manual edit';
  if(conflict==='missing-translation')h.tables.hotel_tourism_item_translations.pop();
  if(conflict==='shopping')h.tables.hotel_tourism_items.find(i=>i.slug==='shopping-recife')!.updated_at='edited';
  if(conflict==='praca-name')h.tables.hotel_tourism_item_translations[0].name='Manual name';
  if(conflict==='praca-full')h.tables.hotel_tourism_item_translations[0].full_description='Human translation';
  if(conflict==='title-content')h.tables.hotel_section_translations[0].content='Manual content';
  if(conflict==='media-alt')h.tables.hotel_public_experience_media_translations[0].alt_text='Manual alt';
  if(conflict==='revision')h.tables.hotel_public_presentation[0].revision=99;
  if(conflict==='changed-desired-revision')Object.assign(h.tables.hotel_public_presentation[0],{revision:4,configuration:tourismEditorialPlan(manifest).desired});
  if(conflict==='lifecycle')h.tables.hotels[0].platform_status='active';
  if(conflict==='modules')h.setModules([]);
  await assert.rejects(()=>resume(h),conflict);assert.deepEqual(mutations(h.calls),[],conflict);
 }
});

test('ambiguous EN translation response keeps committed data and next directed run skips it without bootstrap',async()=>{
 const h=resumeHarness(),rpc=h.client.rpc;let once=true;
 h.client.rpc=async(name,p={})=>{const r=await rpc(name,p);if(once&&name==='save_current_hotel_tourism_translation'){once=false;return {error:{code:'PT409'},data:null};}return r;};
 await assert.rejects(()=>resume(h));assert.ok(!h.calls.includes('save_current_hotel_public_presentation'));
 const committed=structuredClone(h.tables.hotel_tourism_item_translations.find(t=>t.item_id===manifest.updates[0].id&&t.language==='en'));
 h.calls.length=0;await resume(h);assert.equal(h.calls.filter(c=>c==='save_current_hotel_tourism_translation').length,1);
 assert.deepEqual(h.tables.hotel_tourism_item_translations.find(t=>t.item_id===manifest.updates[0].id&&t.language==='en'),committed);
 assert.ok(!h.calls.some(c=>c.includes('bootstrap')));
});

test('stale parent, false persistence and presentation concurrency never associate cards or compensate destructively',async()=>{
 for(const conflict of ['parent','unconfirmed','presentation']){
  const h=resumeHarness(),rpc=h.client.rpc;
  h.client.rpc=async(name,p={})=>{
   if(name==='save_current_hotel_tourism_translation'&&conflict==='parent'){h.tables.hotel_tourism_items.find(i=>i.id===p.p_item_id)!.updated_at='concurrent';return rpc(name,p);}
   if(name==='save_current_hotel_tourism_translation'&&conflict==='unconfirmed')return {data:true};
   const result=await rpc(name,p);if(name==='save_current_hotel_experience_media_translation'&&conflict==='presentation')h.tables.hotel_public_presentation[0].revision=99;return result;
  };
  await assert.rejects(()=>resume(h));assert.ok(!h.calls.includes('save_current_hotel_public_presentation'));assert.ok(!h.calls.some(c=>/delete|bootstrap/.test(c)));
 }
});
