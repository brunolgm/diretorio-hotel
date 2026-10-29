import './bootstrap-runtime.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const omitTimestamp=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='updated_at'));
const requireState=(ok,code='PT409')=>{if(!ok)throw {code};};
export async function finalizePublicCopy(client,manifest,progress=()=>{}){
 let writesAttempted=false,updated=0;
 const read=async(operation,query)=>{progress({stage:writesAttempted?'readback':'preflight',operation,writesAttempted});const r=await query;if(r.error)throw r.error;return r.data;};
 requireState(manifest.version===1&&manifest.hotelId==='5eb7d695-ccf7-4594-b9df-fc46aaa25695'&&manifest.corrections.length===3,'INVALID_MANIFEST');
 requireState(manifest.corrections.every(c=>Object.keys(c.changes).length===1&&Object.keys(c.changes).every(k=>['cta','category'].includes(k))),'INVALID_MANIFEST');
 const u=await client.auth.getUser();requireState(!u.error&&u.data?.user,'AUTH_REQUIRED');
 const p=await read('profile.read',client.from('profiles').select('hotel_id,role,is_active').eq('id',u.data.user.id).single());
 requireState(p?.hotel_id===manifest.hotelId&&p.role==='administrador'&&p.is_active,'AUTHORIZATION_REQUIRED');
 const modules=await read('get_current_hotel_modules',client.rpc('get_current_hotel_modules'));
 requireState(['content.services','content.languages'].every(k=>modules?.some(m=>m.module_key===k&&m.is_enabled===true)),'MODULES_REQUIRED');
 const hotel=async()=>{const h=await read('hotel.read',client.from('hotels').select('platform_status,slug,subdomain').eq('id',manifest.hotelId).single());requireState(h?.platform_status==='suspended'&&h.slug==='bugan-recife'&&h.subdomain==='buganrecife','LIFECYCLE_CONFLICT');};
 const inspect=async c=>{
  const source=await read('source.read',client.from('hotel_sections').select('*').eq('id',c.source.id).eq('hotel_id',manifest.hotelId).single());requireState(same(source,c.source));
  const row=await read('translation.read',client.from('hotel_section_translations').select('*').eq('section_id',c.source.id).eq('language',c.translation.language).single());
  const done=same(omitTimestamp(row??{}),omitTimestamp({...c.translation,...c.changes}));requireState(done||same(row,c.translation));return {row,done};
 };
 await hotel();for(const c of manifest.corrections)await inspect(c);
 for(const c of manifest.corrections){
  await hotel();const {row,done}=await inspect(c);if(done)continue;
  writesAttempted=true;progress({stage:'corrections',operation:'service.translation.update',writesAttempted});
  const r=await client.from('hotel_section_translations').update({...c.changes,updated_at:new Date().toISOString()}).eq('id',row.id).eq('section_id',c.source.id).eq('language',row.language).eq('updated_at',row.updated_at).select('id');
  if(r.error)throw r.error;requireState(r.data?.length===1);updated++;
 }
 for(const c of manifest.corrections)requireState((await inspect(c)).done,'WRITE_UNCONFIRMED');await hotel();
 return {status:'public_copy_confirmed',hotelId:manifest.hotelId,checked:3,updated,lifecycle:'suspended',ptPreserved:true,googleUsed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let client,state={stage:'plan',operation:'validate',writesAttempted:false};
 try{
  const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-v4-closure-editorial-20261029.json','utf8'));
  if(process.argv.includes('--plan'))console.log(JSON.stringify({mode:'plan',writes:false,fields:manifest.corrections.map(c=>({language:c.translation.language,changes:c.changes}))}));
  else{
   mkdirSync('out',{recursive:true});process.loadEnvFile('.env.local');requireState(process.env.NEXT_PUBLIC_SUPABASE_URL===`https://${manifest.projectRef}.supabase.co`,'PROJECT_MISMATCH');
   state={stage:'authentication',operation:'auth.signInWithPassword',writesAttempted:false};let input='';for await(const part of process.stdin){input+=part;requireState(input.length<16384,'INPUT_INVALID');}
   let credentials=JSON.parse(input);input='';requireState(credentials.email==='libguestbugan@yahoo.com','ACCOUNT_MISMATCH');
   client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await client.auth.signInWithPassword(credentials);credentials=null;requireState(!auth.error,'AUTH_FAILED');
   const result=await finalizePublicCopy(client,manifest,s=>{state=s;});writeFileSync('out/bugan-v4-public-copy.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }
 }catch(error){console.error(JSON.stringify({status:'interrupted',...state,code:['PT409','42501','AUTH_REQUIRED','AUTHORIZATION_REQUIRED','MODULES_REQUIRED','LIFECYCLE_CONFLICT','AUTH_FAILED','PROJECT_MISMATCH','ACCOUNT_MISMATCH','INVALID_MANIFEST','WRITE_UNCONFIRMED'].includes(error?.code)?error.code:'UNCONFIRMED',message:'Confira por leitura antes de repetir. Nao envie senha ao chat.'}));process.exitCode=1;}
 finally{if(client)await client.auth.signOut({scope:'local'}).catch(()=>{});}
}
