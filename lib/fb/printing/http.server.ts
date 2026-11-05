import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {createClient} from '@/lib/supabase/server';
import {isJsonContentType,readUtf8BodyWithLimit} from '@/lib/security/http';
import {sameOrigin} from '@/lib/fb/orders/http-request';
import {newPrintCredential,parsePrintCredential,printCorrelation} from './credentials.server';
import {PrintBoundaryError,validateDeviceBody,objectWithKeys,printId,positive} from './validation';
import {printRpc} from './rpc.server';
import {printingDiagnostic} from './diagnostics.server';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export {headers as printingHeaders,failure as printingFailure,body as readPrintingBody,tls as requirePrintingTls};
function failure(error:unknown){const e=error instanceof PrintBoundaryError?error:new PrintBoundaryError(503,'unavailable');return NextResponse.json({error:e.code},{status:e.status,headers:{...headers,'X-FB-Print-Diagnostic-ID':printingDiagnostic(e.status)}});}
async function body(request:Request){
 if(!isJsonContentType(request.headers.get('content-type')))throw new PrintBoundaryError(415,'invalid_content_type');
 const controller=new AbortController();const input={headers:request.headers,body:request.body?.pipeThrough(new TransformStream(),{signal:controller.signal})??null};
 let timer:ReturnType<typeof setTimeout>|undefined;try{const r=await Promise.race([readUtf8BodyWithLimit(input,8192),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new PrintBoundaryError(408,'request_timeout'));controller.abort();},10000);})]);if(!r.ok)throw new PrintBoundaryError(r.reason==='too_large'?413:400,'invalid_body');try{return JSON.parse(r.text) as unknown;}catch{throw new PrintBoundaryError(400,'invalid_json');}}finally{clearTimeout(timer);controller.abort();}
}
function tls(request:NextRequest){if(request.nextUrl.protocol!=='https:'&&!(process.env.FB_LOCAL_LAB==='1'&&['localhost','127.0.0.1'].includes(request.nextUrl.hostname)))throw new PrintBoundaryError(403,'https_required');}
export async function devicePrintingHttp(request:NextRequest,operation:string){try{
 tls(request);const client=createAdminClient();const authorization=request.headers.get('authorization')||'';
 const parsed=authorization.startsWith('Bearer ')?parsePrintCredential(authorization.slice(7)):null;
 const bootstrap=await printRpc<boolean>(client,'admit_fb_print_http',{p_action:'bootstrap',p_digest:printCorrelation('printing-gateway')});if(!bootstrap)throw new PrintBoundaryError(429,'rate_limited');
 if(operation!=='exchange'){const permitted=await printRpc<boolean>(client,'admit_fb_print_http',{p_action:'device',p_digest:printCorrelation(parsed?.id||'unidentified-device')});if(!permitted)throw new PrintBoundaryError(429,'rate_limited');}
 if(operation!=='exchange'&&!parsed)throw new PrintBoundaryError(403,'forbidden');
 const {operation:op,body:b}=validateDeviceBody(operation,await body(request));
 const auth={p_credential_id:parsed?.id,p_digest:parsed?.digest,p_protocol_version:b.protocol_version};let result:unknown;
 if(op==='exchange'){
  const pairing=parsePrintCredential(b.pairing_token);if(!pairing)throw new PrintBoundaryError(403,'forbidden');
  const allowed=await printRpc<boolean>(client,'admit_fb_print_http',{p_action:'pair',p_digest:printCorrelation(pairing.id)});if(!allowed)throw new PrintBoundaryError(429,'rate_limited');
  const credential=newPrintCredential();const r=await printRpc<Record<string,unknown>>(client,'exchange_fb_print_pairing',{p_pairing_id:pairing.id,p_pairing_digest:pairing.digest,p_device_id:b.device_id,p_credential_id:credential.id,p_credential_digest:credential.digest,p_protocol_version:b.protocol_version,p_software_version:b.software_version});
  result={...r,credential:credential.token};
 }else if(op==='heartbeat')result=await printRpc(client,'heartbeat_fb_print_device',{...auth,p_software_version:b.software_version,p_observed_state:b.observed_state||'online'});
 else if(op==='claim')result=await printRpc(client,'claim_fb_print_job',{...auth,p_key:b.key});
 else {
  const job={...auth,p_job_id:b.job_id,p_fence:b.fence,p_expected_revision:b.revision};
  if(op==='receipt'||op==='dispatch')result=await printRpc(client,op==='receipt'?'receipt_fb_print_job':'authorize_fb_print_dispatch',{...job,p_snapshot_hash:b.snapshot_hash});
  else result=await printRpc(client,'report_fb_print_result',{...job,p_key:b.key,p_result:b.result,p_code:b.code,p_no_io:b.no_io});
 }
 return NextResponse.json(result,{headers});
}catch(error){return failure(error);}}

export async function adminPrintingHttp(request:NextRequest){try{
 try{sameOrigin(request);}catch{throw new PrintBoundaryError(403,'forbidden');}const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new PrintBoundaryError(403,'forbidden');
 const value=await body(request);objectWithKeys(value,['operation','kind','id','revision','values','user_id','capability','sector_id','active','enabled','device_id','destination_id','original_job_id','reason','key','batch','limit','after_created','after_id']);
 const adminKeys:Record<string,string[]>={grant:['user_id','capability','sector_id','active','revision'],config:['kind','id','revision','values'],activate:['enabled','revision'],pairing:['device_id'],rotate:['device_id'],revoke:['device_id','revision'],reconcile:['batch'],test:['destination_id','sector_id','key'],reprint:['destination_id','original_job_id','reason','key'],read:['limit','after_created','after_id'],read_config:[]};
 if(typeof value.operation!=='string'||!Object.hasOwn(adminKeys,value.operation))throw new PrintBoundaryError(400,'invalid_operation');objectWithKeys(value,['operation',...adminKeys[value.operation]]);
 const b=value;let result:unknown;
 switch(b.operation){
  case 'grant':printId(b.user_id);if(!['printing.configure','printing.test','printing.reprint'].includes(String(b.capability))||typeof b.active!=='boolean')throw new PrintBoundaryError(400,'invalid_input');if(b.sector_id!==null)printId(b.sector_id);if(!Number.isSafeInteger(b.revision)||(b.revision as number)<0)throw new PrintBoundaryError(400,'invalid_input');result=await printRpc(client,'grant_current_hotel_fb_print_capability',{p_user_id:b.user_id,p_capability:b.capability,p_sector_id:b.sector_id,p_active:b.active,p_expected_revision:b.revision});break;
  case 'config':if(typeof b.kind!=='string'||!['settings','device','destination','printer','route'].includes(b.kind)||!Number.isSafeInteger(b.revision)||(b.revision as number)<0)throw new PrintBoundaryError(400,'invalid_input');if(b.id!==null)printId(b.id);result=await printRpc(client,'save_current_hotel_fb_print_config',{p_kind:b.kind,p_id:b.id,p_expected_revision:b.revision,p_values:b.values});break;
  case 'activate':if(typeof b.enabled!=='boolean')throw new PrintBoundaryError(400,'invalid_input');positive(b.revision);result=await printRpc(client,'activate_current_hotel_fb_printing',{p_enabled:b.enabled,p_expected_revision:b.revision});break;
  case 'pairing':{printId(b.device_id);const code=newPrintCredential();const r=await printRpc<Record<string,unknown>>(client,'create_current_hotel_fb_print_pairing',{p_device_id:b.device_id,p_pairing_id:code.id,p_pairing_digest:code.digest});result={...r,pairing_token:code.token};break;}
  case 'rotate':{printId(b.device_id);const code=newPrintCredential();const r=await printRpc<Record<string,unknown>>(client,'rotate_current_hotel_fb_print_credential',{p_device_id:b.device_id,p_credential_id:code.id,p_digest:code.digest});result={...r,credential:code.token};break;}
  case 'revoke':printId(b.device_id);positive(b.revision);result=await printRpc(client,'revoke_current_hotel_fb_print_device',{p_device_id:b.device_id,p_expected_revision:b.revision});break;
  case 'reconcile':positive(b.batch);result=await printRpc(client,'reconcile_current_hotel_fb_printing',{p_batch:b.batch});break;
  case 'test':case 'reprint':printId(b.destination_id);printId(b.key);if(b.operation==='test')printId(b.sector_id);else printId(b.original_job_id);result=await printRpc(client,'create_current_hotel_fb_print_job',{p_kind:b.operation,p_destination_id:b.destination_id,p_sector_id:b.sector_id||null,p_original_job_id:b.original_job_id||null,p_reason_code:b.reason||null,p_key:b.key});break;
  case 'read':{const limit=b.limit??50;positive(limit);if(limit>50||(b.after_created===undefined)!==(b.after_id===undefined))throw new PrintBoundaryError(400,'invalid_input');if(b.after_id!==undefined){printId(b.after_id);if(typeof b.after_created!=='string'||b.after_created.length>64||!Number.isFinite(Date.parse(b.after_created)))throw new PrintBoundaryError(400,'invalid_input');}result=await printRpc(client,'get_current_hotel_fb_print_jobs',{p_limit:limit,p_after_created:b.after_created??null,p_after_id:b.after_id??null});break;}
  case 'read_config':result=await printRpc(client,'get_current_hotel_fb_print_config');break;
  default:throw new PrintBoundaryError(400,'invalid_operation');
 }
 return NextResponse.json(result,{headers});
}catch(error){return failure(error);}}
