import './bootstrap-runtime.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const stable=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['is_active','updated_at'].includes(k)));
const check=(value,code='PT409')=>{if(!value)throw {code};};
export async function retireTestCommunications(client,manifest,disable,progress=()=>{}){
 let attempted=false,changed=0;
 const read=async(operation,query)=>{progress({stage:attempted?'readback':'preflight',operation,writesAttempted:attempted});const r=await query;if(r.error)throw {code:'READ_UNCONFIRMED'};return r.data;};
 check(manifest.version===1&&manifest.hotelId==='5eb7d695-ccf7-4594-b9df-fc46aaa25695'&&manifest.records.length===5,'INVALID_MANIFEST');
 check(new Set(manifest.records.map(x=>x.record.id)).size===5&&manifest.records.every(x=>['banner','announcement'].includes(x.kind)&&x.record.hotel_id===manifest.hotelId&&/^TESTE(?: [234]| MANUTENÇÃO)?$/.test(x.record.title)&&x.record.is_active===true),'INVALID_MANIFEST');
 const u=await client.auth.getUser();check(!u.error&&u.data?.user,'AUTH_REQUIRED');
 const p=await read('profile.read',client.from('profiles').select('hotel_id,role,is_active').eq('id',u.data.user.id).single());
 check(p?.hotel_id===manifest.hotelId&&p.role==='administrador'&&p.is_active===true,'AUTHORIZATION_REQUIRED');
 const modules=await read('get_current_hotel_modules',client.rpc('get_current_hotel_modules'));
 check(['content.banners','content.announcements'].every(k=>modules?.some(m=>m.module_key===k&&m.is_enabled===true)),'MODULES_REQUIRED');
 const hotel=async()=>{const h=await read('hotel.read',client.from('hotels').select('platform_status,slug,subdomain').eq('id',manifest.hotelId).single());check(h?.platform_status==='active'&&h.slug==='bugan-recife'&&h.subdomain==='buganrecife','LIFECYCLE_CONFLICT');};
 const inspect=async entry=>{const table=entry.kind==='banner'?'hotel_promotional_banners':'hotel_announcements';const row=await read('communication.read',client.from(table).select('*').eq('id',entry.record.id).eq('hotel_id',manifest.hotelId).single());check(row&&same(stable(row),stable(entry.record)));check(row.is_active===false||same(row,entry.record));return row;};
 const confirmAudit=async(entry,row)=>{const rows=await read('audit.read',client.from('admin_audit_log').select('id').eq('hotel_id',manifest.hotelId).eq('entity_id',row.id).eq('action',(entry.kind==='banner'?'banner':'announcement')+'.deactivated').gte('created_at',row.updated_at).limit(1));check(rows?.length>0,'AUDIT_UNCONFIRMED');};
 await hotel();for(const entry of manifest.records)await inspect(entry);
 for(const entry of manifest.records){await hotel();const row=await inspect(entry);if(row.is_active===false){await confirmAudit(entry,row);continue;}attempted=true;progress({stage:'deactivation',operation:'canonical.communication.disable',writesAttempted:true});const result=await disable({kind:entry.kind,id:row.id,expected_updated_at:row.updated_at});check(result?.status==='communication_status_confirmed'&&result.id===row.id&&result.is_active===false,'WRITE_UNCONFIRMED');changed++;}
 for(const entry of manifest.records){const row=await inspect(entry);check(row.is_active===false,'WRITE_UNCONFIRMED');await confirmAudit(entry,row);}await hotel();
 return {status:'test_communications_retired',hotelId:manifest.hotelId,checked:5,disabledThisRun:changed,lifecycle:'active',deleted:0,googleUsed:false,airlabsUsed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let client,state={stage:'plan',operation:'manifest.read',writesAttempted:false};
 try{
  const manifest=JSON.parse(readFileSync(process.argv.includes('--refinement-package')?'docs/bootstrap/bugan-test-communications-20261031.json':'docs/bootstrap/bugan-test-communications-20261030.json','utf8'));
  if(process.argv.includes('--plan'))console.log(JSON.stringify({mode:'plan',writes:false,records:manifest.records.map(e=>({kind:e.kind,id:e.record.id,title:e.record.title}))}));
  else{
   process.loadEnvFile('.env.local');check(process.env.NEXT_PUBLIC_SUPABASE_URL==='https://'+manifest.projectRef+'.supabase.co','PROJECT_MISMATCH');
   state={stage:'authentication',operation:'auth.signInWithPassword',writesAttempted:false};
   let raw='';for await(const part of process.stdin){raw+=part;check(raw.length<16384,'INPUT_INVALID');}
   let credentials=JSON.parse(raw);raw='';check(credentials.email==='libguestbugan@yahoo.com','ACCOUNT_MISMATCH');
   client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await client.auth.signInWithPassword(credentials);credentials=null;check(!auth.error&&auth.data.session,'AUTH_FAILED');
   const disable=async payload=>{const response=await fetch(manifest.origin+'/api/admin/communications/status',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+auth.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw {code:['authentication_required','authorization_required','hotel_unavailable','module_required','record_unavailable','PT409','status_update_unconfirmed','status_changed_audit_unconfirmed','request_unconfirmed'].includes(data?.error)?data.error:'WRITE_UNCONFIRMED',httpStatus:response.status};return data;};
   const result=await retireTestCommunications(client,manifest,disable,p=>{state=p;});mkdirSync('out',{recursive:true});writeFileSync(process.argv.includes('--refinement-package')?'out/bugan-test-communications-retired-20261031.json':'out/bugan-test-communications-retired.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }
 }catch(error){const allowed=['PT409','AUTH_REQUIRED','AUTHORIZATION_REQUIRED','MODULES_REQUIRED','LIFECYCLE_CONFLICT','AUTH_FAILED','PROJECT_MISMATCH','ACCOUNT_MISMATCH','INVALID_MANIFEST','READ_UNCONFIRMED','WRITE_UNCONFIRMED','AUDIT_UNCONFIRMED','authentication_required','authorization_required','hotel_unavailable','module_required','record_unavailable','status_update_unconfirmed','status_changed_audit_unconfirmed','request_unconfirmed'];console.error(JSON.stringify({status:'interrupted',...state,httpStatus:Number.isInteger(error?.httpStatus)&&error.httpStatus>=400&&error.httpStatus<600?error.httpStatus:undefined,code:allowed.includes(error?.code)?error.code:'UNCONFIRMED',message:'Confira por leitura antes de repetir; nao envie senha ou token ao chat.'}));process.exitCode=1;}
 finally{if(client)await client.auth.signOut({scope:'local'}).catch(()=>{});}
}
