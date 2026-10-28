import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as media from '../../lib/public-experience-media.ts';
import * as image from '../../lib/security/image-upload.ts';
const require=createRequire(import.meta.url);
const ts=require('typescript') as typeof import('typescript');
const source=ts.transpileModule(readFileSync('app/admin/hotel/experience-media-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const hotel='b0600000-0000-4000-8000-000000000001';
const old=`${hotel}/hero/hero/b0600000-0000-4000-8000-000000000002.png`;
function harness(mode:'ok'|'conflict'|'ambiguous'|'transport'|'stale'|'cleanup-failure'|'malformed'|'translation-failure'='ok'){
  const events:{op:string;value?:unknown}[]=[];
  let newPath:string|undefined;
  const previous={image_path:old,mobile_image_path:null,revision:1};
  const client={from:()=>{const q={select:()=>q,eq:(key:string,value:unknown)=>{events.push({op:key,value});return q;},maybeSingle:async()=>({data:{...previous,revision:mode==='stale'?2:1},error:null})};return q;},rpc:async(name:string,args:{p_values:{image_path:string}})=>{
    events.push({op:'rpc',value:name}); newPath=args.p_values.image_path;
    if(mode==='transport')throw Error('transport');
    if(mode==='malformed')return {data:[{}],error:null};
    return mode==='conflict'?{data:null,error:{code:'PT409'}}:mode==='ambiguous'?{data:null,error:null}:{data:[{revision:2,previous_image_path:old,previous_mobile_image_path:null}],error:null};
  }};
  const storage={upload:async(path:string,_bytes:unknown,options:object)=>{events.push({op:'upload',value:{path,options}});return {error:null};},remove:async(paths:string[])=>{events.push({op:'remove',value:paths});return {error:mode==='cleanup-failure'?Error('storage'):null};}};
  const m={exports:{}};
  runInNewContext(source,{exports:m.exports,module:m,File,console:{error:()=>{}},require:(name:string)=>{
    if(name==='next/cache')return {revalidatePath:()=>{}};
    if(name==='next/navigation')return {redirect:(url:string)=>{throw Error(url);}};
    if(name==='@/lib/auth')return {requireAdminAccess:async(role:string)=>{assert.equal(role,'editor');return {profile:{hotel_id:hotel}};}};
    if(name==='@/lib/admin-entitlements')return {requireHotelModule:async(key:string)=>assert.equal(key,'experience.appearance')};
    if(name==='@/lib/supabase/server')return {createClient:async()=>client};
    if(name==='@/lib/supabase/admin')return {createAdminClient:()=>({storage:{from:(bucket:string)=>{assert.equal(bucket,'hotel-assets');return storage;}}})};
    if(name==='@/lib/security/image-upload')return image;
    if(name==='@/lib/public-experience-media')return media;
    if(name==='@/lib/services/experience-media-translations')return {syncExperienceMediaTranslations:async()=>mode==='translation-failure'?'failed':'skipped'};
    throw Error(name);
  }});
  const form=new FormData();
  for(const [k,v]of Object.entries({slot:'hero',revision:'1',focal_x:'25',focal_y:'50',mobile_focal_x:'70',mobile_focal_y:'40',title:'Source PT',alt_text:'Synthetic photo',is_published:'on',hotel_id:'foreign-hotel',image_path:'arbitrary/path'}))form.set(k,v);
  const bytes=new Uint8Array(33); bytes.set([137,80,78,71,13,10,26,10]);bytes[11]=13;bytes.set([73,72,68,82],12);bytes[19]=1;bytes[23]=1;bytes[24]=8;bytes[25]=2;
  form.set('desktop_image',new File([bytes],'image.png',{type:'image/png'}));
  return {events,form,run:()=> (m.exports as {updateExperienceMediaAction:(form:FormData)=>Promise<void>}).updateExperienceMediaAction(form),newPath:()=>newPath};
}
test('media action validates/scopes/uploads then associates before removing previous file',async()=>{
  const h=harness();await assert.rejects(h.run(),/success=/);
  assert.ok(h.events.some(e=>e.op==='hotel_id'&&e.value===hotel));
  assert.deepEqual(h.events.filter(e=>['upload','rpc','remove'].includes(e.op)).map(e=>e.op),['upload','rpc','remove']);
  assert.deepEqual([...(h.events.find(e=>e.op==='remove')?.value as string[])],[old]);
  const upload=h.events.find(e=>e.op==='upload')?.value as {path:string;options:{upsert:boolean}};
  assert.equal(upload.options.upsert,false); assert.ok(media.ownedExperienceMediaPath(upload.path,hotel,'hero'));
});
test('media action compensates only the new upload after definitive PT409',async()=>{
  const h=harness('conflict');await assert.rejects(h.run(),/error=/);
  assert.deepEqual([...(h.events.find(e=>e.op==='remove')?.value as string[])],[h.newPath()]);
});
for(const mode of ['ambiguous','transport','malformed'] as const)test(`media action retains all files on ${mode}`,async()=>{
  const h=harness(mode);await assert.rejects(h.run(),/error=/);assert.equal(h.events.filter(e=>e.op==='remove').length,0);
});
test('media stale revision and malformed file fail before any Storage or RPC mutation',async()=>{
  for(const stale of [true,false]){
    const h=harness(stale?'stale':'ok');if(!stale)h.form.set('desktop_image',new File(['<svg/>'],'image.svg',{type:'image/svg+xml'}));
    await assert.rejects(h.run(),/error=/);assert.equal(h.events.filter(e=>['upload','rpc','remove'].includes(e.op)).length,0);
  }
});
test('media cleanup failure retries twice and reports saved state requiring cleanup',async()=>{
  const h=harness('cleanup-failure');await assert.rejects(h.run(),/error=/);assert.equal(h.events.filter(e=>e.op==='remove').length,2);
});
test('media aggregate upload budget stays below the existing Server Action transport limit',async()=>{
  const h=harness();
  const bytes=new Uint8Array(1_100_000); bytes.set([137,80,78,71,13,10,26,10]);bytes[11]=13;bytes.set([73,72,68,82],12);bytes[19]=1;bytes[23]=1;bytes[24]=8;bytes[25]=2;
  h.form.set('desktop_image',new File([bytes],'desktop.png',{type:'image/png'}));
  h.form.set('mobile_image',new File([bytes],'mobile.png',{type:'image/png'}));
  await assert.rejects(h.run(),/error=/);
  assert.equal(h.events.filter(e=>['upload','rpc','remove'].includes(e.op)).length,0);
});

test('media translation failure warns after confirmed association and never compensates the committed image',async()=>{
 const h=harness('translation-failure');await assert.rejects(h.run(),/fallback%20permanece%20PT/);
 assert.deepEqual(h.events.filter(e=>['upload','rpc','remove'].includes(e.op)).map(e=>e.op),['upload','rpc','remove']);
 assert.deepEqual([...(h.events.find(e=>e.op==='remove')?.value as string[])],[old]);
});
