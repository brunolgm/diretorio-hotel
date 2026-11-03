// Restricted F&B job; no .env loading, scheduler, tenant activation or provider calls.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const countKeys=['pii','notes','alerts','facts','tokens','idempotency','sessions','correlators','quotes'];
const safeCounts=value=>Object.fromEntries(countKeys.map(k=>[k,Number.isSafeInteger(value?.[k])&&value[k]>=0?value[k]:0]));
const safeId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:undefined;
const safeTime=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export async function maintenanceJob({url,key,execute=false,batch=100,passes=1,transport=fetch}){
 const target=new URL(url);if((target.protocol!=='https:'&&!(['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&target.protocol==='http:'))||target.username||target.password||target.search||target.hash||target.pathname!=='/'||!key||!Number.isInteger(batch)||batch<1||batch>1000||!Number.isInteger(passes)||passes<1||passes>10)throw Error('maintenance_configuration_invalid');
 const results=[];
 for(let n=0;n<(execute?passes:1);n++){
  const response=await transport(new URL('/rest/v1/rpc/'+(execute?'run_fb_order_maintenance':'get_fb_order_maintenance_status'),target),{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(execute?{p_batch:batch}:{})});
  if(!response.ok)throw Error('maintenance_unavailable');const data=await response.json();
  if(!execute){const r=data.last_run;results.push({last_success_at:safeTime(data.last_success_at),last_run:r?{id:safeId(r.id),started_at:safeTime(r.started_at),finished_at:safeTime(r.finished_at),status:['succeeded','failed','skipped'].includes(r.status)?r.status:'failed',batch_size:Number.isInteger(r.batch_size)&&r.batch_size>=1&&r.batch_size<=1000?r.batch_size:null,counts:safeCounts(r.counts),error_code:typeof r.error_code==='string'&&/^[0-9A-Z]{5}$/.test(r.error_code)?r.error_code:null}:null});break;}
  // Do not echo provider bodies. Only the closed service RPC result is accepted.
  if(!['succeeded','failed','skipped'].includes(data.status))throw Error('maintenance_unavailable');
  results.push({run_id:safeId(data.run_id),status:data.status,code:data.status==='failed'?'maintenance_failed':data.status==='skipped'?'maintenance_busy':'maintenance_completed',counts:safeCounts(data.counts)});
  if(data.status!=='succeeded')break;
 }
 return results;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const args=process.argv.slice(2);if(args.some(a=>a!=='--execute'&&!/^--(?:batch|passes)=[0-9]+$/.test(a)))throw Error('maintenance_configuration_invalid');
  const result=await maintenanceJob({url:process.env.FB_MAINTENANCE_SUPABASE_URL,key:process.env.FB_MAINTENANCE_SERVICE_KEY,execute:args.includes('--execute'),batch:Number(args.find(a=>a.startsWith('--batch='))?.split('=')[1]||100),passes:Number(args.find(a=>a.startsWith('--passes='))?.split('=')[1]||1)});
  console.log(JSON.stringify({scope:'fb.orders.maintenance',result}));if(result.some(r=>r.status==='failed'))process.exitCode=1;
 }catch{console.error(JSON.stringify({scope:'fb.orders.maintenance',code:'maintenance_unavailable'}));process.exitCode=1;}
}
