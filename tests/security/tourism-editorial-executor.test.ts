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
  if(name==='save_current_hotel_tourism_item'){const row=tables.hotel_tourism_items.find(i=>i.id===p.p_item_id)!;assert.equal(p.p_expected_updated_at,row.updated_at);Object.assign(row,p.p_changes,{updated_at:'changed-source'});tables.hotel_tourism_item_translations=tables.hotel_tourism_item_translations.filter(t=>t.item_id!==row.id);return {data:[row]};}
  if(name==='save_current_hotel_tourism_translation'){const row=tables.hotel_tourism_items.find(i=>i.id===p.p_item_id)!;assert.equal(p.p_expected_updated_at,row.updated_at);tables.hotel_tourism_item_translations=tables.hotel_tourism_item_translations.filter(t=>!(t.item_id===row.id&&t.language===p.p_language));tables.hotel_tourism_item_translations.push({item_id:row.id,language:p.p_language,...p.p_changes as object});return {data:true};}
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
