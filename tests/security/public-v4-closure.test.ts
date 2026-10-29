import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {breakfastPeriods,getPublicEssentials} from '../../lib/public-essentials.ts';
import {finalizePublicCopy} from '../../scripts/finalize-bugan-public-copy.mjs';
import type {PublicHotelPageData} from '../../lib/public-hotel-data';
const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-v4-closure-editorial-20261029.json','utf8'));
function harness(){
 const sources=[...new Map(manifest.corrections.map((c:{source:{id:string}})=>[c.source.id,structuredClone(c.source)])).values()];
 const tables:Record<string,Record<string,unknown>[]>={profiles:[{id:'admin',hotel_id:manifest.hotelId,role:'administrador',is_active:true}],hotels:[{id:manifest.hotelId,platform_status:'suspended',slug:'bugan-recife',subdomain:'buganrecife'}],hotel_sections:sources as Record<string,unknown>[],hotel_section_translations:manifest.corrections.map((c:{translation:unknown})=>structuredClone(c.translation))};
 const writes:Record<string,unknown>[]=[],modules=['content.languages','content.services'];
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>({data:modules.map(module_key=>({module_key,is_enabled:true}))}),from(table:string){
  const filters:((r:Record<string,unknown>)=>boolean)[]=[];let patch:Record<string,unknown>|undefined,single=false;
  const q={select:()=>q,eq(k:string,v:unknown){filters.push(r=>r[k]===v);return q;},single(){single=true;return q;},update(v:Record<string,unknown>){patch=v;return q;},then(resolve:(value:unknown)=>unknown){const rows=tables[table].filter(r=>filters.every(f=>f(r)));if(patch){writes.push(patch);rows.forEach(r=>Object.assign(r,patch));}return Promise.resolve({data:structuredClone(single?rows[0]??null:rows),error:null}).then(resolve);}};return q;
 }};return {client,tables,writes,modules};
}
test('canonical breakfast days are localised without changing times; unknown or invalid schedules remain verbatim',()=>{
 const text='Seg–Sex 06:00–10:00; sábados, domingos e feriados 06:00–10:30';
 for(const lang of ['pt','en','es'] as const){const periods=breakfastPeriods(text,lang);assert.equal(periods.length,2);assert.deepEqual(periods.map(p=>p.hours),['06:00–10:00','06:00–10:30']);}
 assert.equal(breakfastPeriods(text,'en')[0].days,'Monday to Friday');assert.equal(breakfastPeriods(text,'es')[1].days,'Sábados, domingos y festivos');assert.deepEqual(breakfastPeriods('Special seasonal timetable','en'),[]);assert.deepEqual(breakfastPeriods('Seg–Sex 26:00–10:00','en'),[]);
});
test('Home and internal essentials use the same published own-hotel Wifi; disabled modules and foreign rows cannot supply instructions',()=>{
 const d={hotel:{id:'own',wifi_name:'Synthetic network',wifi_password:null,breakfast_hours:'Special hours',checkin_time:'14:00',checkout_time:'12:00'},layout:[{blockKey:'quick_info',isEnabled:true},{blockKey:'services',isEnabled:true}],sections:[{hotel_id:'other',enabled:true,icon:'Wifi',content:'Foreign'},{hotel_id:'own',enabled:false,icon:'Wifi',content:'Disabled'},{hotel_id:'own',enabled:true,icon:'Wifi',content:'Approved instructions'}]} as PublicHotelPageData;
 assert.equal(getPublicEssentials(d,'es').wifi?.instructions,'Approved instructions');assert.equal(getPublicEssentials(d,'es').breakfast,'Special hours');d.layout=d.layout.filter(b=>b.blockKey!=='services');assert.equal(getPublicEssentials(d,'es').wifi?.instructions,null);d.layout=[];assert.equal(getPublicEssentials(d,'es').wifi,null);
});
test('minimal authenticated editorial correction changes three fields only and is idempotent',async()=>{
 const h=harness(),before=structuredClone(h.tables);const r=await finalizePublicCopy(h.client,manifest);assert.equal(r.updated,3);assert.equal(r.lifecycle,'suspended');assert.deepEqual(h.tables.hotels,before.hotels);assert.deepEqual(h.tables.profiles,before.profiles);assert.deepEqual(h.tables.hotel_sections,before.hotel_sections);
 for(const [i,row]of h.tables.hotel_section_translations.entries())for(const key of Object.keys(row).filter(k=>k!=='updated_at'&&!Object.hasOwn(manifest.corrections[i].changes,k)))assert.equal(row[key],before.hotel_section_translations[i][key]);
 assert.ok(h.writes.every(p=>Object.keys(p).length===2&&Object.keys(p).includes('updated_at')));assert.equal((await finalizePublicCopy(h.client,manifest)).updated,0);assert.equal(h.writes.length,3);
});
test('editorial role, lifecycle, module, PT source and human translation conflicts cause zero writes',async()=>{
 for(const issue of ['role','lifecycle','modules','source','translation']){const h=harness();if(issue==='role')h.tables.profiles[0].role='visualizador';if(issue==='lifecycle')h.tables.hotels[0].platform_status='active';if(issue==='modules')h.modules.length=0;if(issue==='source')h.tables.hotel_sections[0].content='Changed source';if(issue==='translation')h.tables.hotel_section_translations[2].content='Manual edit';await assert.rejects(()=>finalizePublicCopy(h.client,manifest));assert.deepEqual(h.writes,[]);}
});
