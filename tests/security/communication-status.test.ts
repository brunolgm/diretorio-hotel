import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setCommunicationStatus} from '../../lib/communications/status.ts';
import {retireTestCommunications} from '../../scripts/retire-bugan-test-communications.mjs';
const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-test-communications-20261030.json','utf8'));
function lab(options: {role?:string; active?:boolean; hotelId?:string; missingModule?:boolean; auditFails?:boolean} = {},sourceManifest=manifest) {
 const h=sourceManifest.hotelId,events:string[]=[],auditRows:Record<string,unknown>[]=[],tables:Record<string,Record<string,unknown>[]>={
 profiles:[{id:'admin',hotel_id:options.hotelId??h,role:options.role??'administrador',is_active:options.active!==false}],
 hotels:[{id:h,platform_status:'active',slug:'bugan-recife',subdomain:'buganrecife'}],
 hotel_promotional_banners:sourceManifest.records.filter((e:{kind:string})=>e.kind==='banner').map((e:{record:unknown})=>structuredClone(e.record)),
 hotel_announcements:sourceManifest.records.filter((e:{kind:string})=>e.kind==='announcement').map((e:{record:unknown})=>structuredClone(e.record)),
 admin_audit_log:auditRows};
 const client={auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},rpc:async()=>({data:options.missingModule?[]:['content.banners','content.announcements'].map(module_key=>({module_key,is_enabled:true})),error:null}),
 from(table:string){const filters:((r:Record<string,unknown>)=>boolean)[]=[];let patch:Record<string,unknown>|undefined,one=false,limit=Infinity;const q={
 select(){return q;},eq(k:string,v:unknown){filters.push(r=>r[k]===v);return q;},gte(k:string,v:unknown){filters.push(r=>Date.parse(String(r[k]))>=Date.parse(String(v)));return q;},limit(n:number){limit=n;return q;},single(){one=true;return q;},maybeSingle(){one=true;return q;},update(v:Record<string,unknown>){assert.ok(['hotel_promotional_banners','hotel_announcements'].includes(table));assert.deepEqual(Object.keys(v).sort(),['is_active','updated_at']);patch=v;return q;},
 then(resolve:(v:unknown)=>void){const rows=(tables[table]??[]).filter(r=>filters.every(f=>f(r))).slice(0,limit);if(patch){if(rows.length)events.push('update');for(const r of rows)Object.assign(r,patch);}return Promise.resolve({data:one?rows[0]??null:rows,error:null}).then(resolve);}
 };return q;}};
 const audit=async(e:{hotelId:string;entityId:string;action:string})=>{events.push('audit');if(options.auditFails)return false;auditRows.push({id:'audit-'+auditRows.length,hotel_id:e.hotelId,entity_id:e.entityId,action:e.action,created_at:new Date(Date.now()+1000).toISOString()});return true;};
 const disable=(input:{kind:'banner'|'announcement';id:string;expected_updated_at:string})=>setCommunicationStatus(client as never,{kind:input.kind,id:input.id,isActive:false,expectedUpdatedAt:input.expected_updated_at,administratorOnly:true},audit);
 return {client,disable,audit,tables,events};
}
test('cleanup touches only five audited test records, preserves contents and is idempotent',async()=>{
 const l=lab();const result=await retireTestCommunications(l.client,manifest,l.disable);
 assert.equal(result.disabledThisRun,5);assert.equal(result.deleted,0);assert.deepEqual(l.events,Array.from({length:5},()=>['update','audit']).flat());
 for(const entry of manifest.records){const row=l.tables[entry.kind==='banner'?'hotel_promotional_banners':'hotel_announcements'].find(r=>r.id===entry.record.id)!;assert.equal(row.is_active,false);for(const key of Object.keys(entry.record).filter(k=>!['is_active','updated_at'].includes(k)))assert.deepEqual(row[key],entry.record[key]);}
 assert.equal((await retireTestCommunications(l.client,manifest,l.disable)).disabledThisRun,0);assert.equal(l.events.length,10);
});
test('all preflight checks complete before any write; mismatched checkpoint never disables anything',async()=>{
 for(const change of ['title','tenant','module','role','active']){
 const l=lab({missingModule:change==='module',role:change==='role'?'visualizador':'administrador',active:change!=='active'});
 if(change==='title')l.tables.hotel_announcements[0].title='Operational notice';
 if(change==='tenant')l.tables.hotel_announcements[0].hotel_id='other';
 await assert.rejects(()=>retireTestCommunications(l.client,manifest,l.disable));assert.deepEqual(l.events,[]);
 }
});
test('canonical status write enforces own role/module/revision before writing and never deletes',async()=>{
 const item=manifest.records[0].record;
 for(const options of [{role:'visualizador'},{active:false},{missingModule:true},{hotelId:'other'}]){
 const l=lab(options);await assert.rejects(()=>l.disable({kind:'banner',id:item.id,expected_updated_at:item.updated_at}));assert.deepEqual(l.events,[]);
 }
 const l=lab();await assert.rejects(()=>l.disable({kind:'banner',id:item.id,expected_updated_at:'2020-01-01T00:00:00Z'}),/PT409/);assert.deepEqual(l.events,[]);
});
test('failed audit or ambiguous response never cause destructive compensation or automatic retry',async()=>{
 const l=lab({auditFails:true});await assert.rejects(()=>retireTestCommunications(l.client,manifest,l.disable),/status_changed_audit_unconfirmed/);assert.deepEqual(l.events,['update','audit']);assert.equal(l.tables.hotel_promotional_banners[0].is_active,false);assert.ok(l.tables.hotel_announcements.every(r=>r.is_active===true));
 let calls=0;const clean=lab();await assert.rejects(()=>retireTestCommunications(clean.client,manifest,async()=>{calls++;return {status:'ambiguous'};}));assert.equal(calls,1);assert.deepEqual(clean.events,[]);
});

import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {readUtf8BodyWithLimit,isJsonContentType} from '../../lib/security/http.ts';
const require=createRequire(import.meta.url);
test('authenticated disable API rejects anonymous/cross-origin/extra tenant or activation fields and uses normal-session core',async()=>{
 const l=lab();let constructed=0,revalidated=0;
 const source=readFileSync('app/api/admin/communications/status/route.ts','utf8');
 const ts=require('typescript'),mod={exports:{} as {POST:(r:Request)=>Promise<Response>}};
 const dependencies:Record<string,unknown>={
 '@supabase/supabase-js':{createClient:()=>{constructed++;return l.client;}},
 '@/lib/env':{getRequiredEnvVar:()=> 'synthetic'},'@/lib/audit':{recordAdminAuditEvent:l.audit},
 '@/lib/communications/status':{setCommunicationStatus,CommunicationStatusError:(await import('../../lib/communications/status.ts')).CommunicationStatusError},
 '@/lib/security/http':{readUtf8BodyWithLimit,isJsonContentType},'next/cache':{revalidatePath:()=>{revalidated++;}}};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports,module:mod,require:(s:string)=>{if(!(s in dependencies))throw Error('Unexpected dependency '+s);return dependencies[s];},Response,Request,URL});
 const invoke=(body:unknown,headers:Record<string,string>={Authorization:'Bearer synthetic','Content-Type':'application/json'})=>mod.exports.POST(new Request('https://libguest.digital/api/admin/communications/status',{method:'POST',headers,body:JSON.stringify(body)}));
 assert.equal((await invoke({},{})).status,401);assert.equal((await invoke({}, {Authorization:'Bearer synthetic',Origin:'https://foreign.test','Content-Type':'application/json'})).status,403);
 const item=manifest.records[0].record,valid={kind:'banner',id:item.id,expected_updated_at:item.updated_at};
 for(const field of ['hotel_id','is_active','administratorOnly'])assert.equal((await invoke({...valid,[field]:'forbidden'})).status,400);
 assert.equal(constructed,0);assert.deepEqual(l.events,[]);
 const response=await invoke(valid);assert.equal(response.status,200);assert.equal((await response.json()).is_active,false);assert.equal(revalidated,1);assert.deepEqual(l.events,['update','audit']);
 (dependencies['@/lib/audit'] as {recordAdminAuditEvent:()=>Promise<boolean>}).recordAdminAuditEvent=async()=>false;
 const persistedVersion=String(l.tables.hotel_promotional_banners[0].updated_at);
 const unconfirmed=await invoke({...valid,expected_updated_at:persistedVersion});
 assert.equal(unconfirmed.status,503);assert.equal(revalidated,2);
 assert.equal(l.tables.hotel_promotional_banners[0].is_active,false);assert.notEqual(l.tables.hotel_promotional_banners[0].updated_at,persistedVersion);

});

test("normal Admin operator toggle stays allowed, while automation requires administrator",async()=>{const item=manifest.records[0].record,l=lab({role:"operador"});await assert.rejects(()=>l.disable({kind:"banner",id:item.id,expected_updated_at:item.updated_at}));assert.deepEqual(l.events,[]);const result=await setCommunicationStatus(l.client as never,{kind:"banner",id:item.id,isActive:false,expectedUpdatedAt:item.updated_at},l.audit);assert.equal(result.is_active,false);assert.deepEqual(l.events,["update","audit"]);});


test('refinement cleanup handles four reactivated/new records and an already audited inactive control',async()=>{
 const m=JSON.parse(readFileSync('docs/bootstrap/bugan-test-communications-20261031.json','utf8')),l=lab({},m),control=m.records.find((e:{record:{id:string}})=>e.record.id==='5babf6c1-dbc1-4821-aa98-8c87a26add8d');
 const inactive=l.tables.hotel_announcements.find(r=>r.id===control.record.id)!;inactive.is_active=false;
 l.tables.admin_audit_log.push({id:'prior',hotel_id:m.hotelId,entity_id:inactive.id,action:'announcement.deactivated',created_at:new Date().toISOString()});
 const result=await retireTestCommunications(l.client,m,l.disable);assert.equal(result.disabledThisRun,4);assert.equal(result.deleted,0);assert.equal(l.events.filter(e=>e==='update').length,4);assert.equal((await retireTestCommunications(l.client,m,l.disable)).disabledThisRun,0);
});
