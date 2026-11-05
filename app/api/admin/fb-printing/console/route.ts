import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/fb/orders/http-request';
import {isJsonContentType,readUtf8BodyWithLimit} from '@/lib/security/http';
import {printRpc} from '@/lib/fb/printing/rpc.server';
import {PrintBoundaryError,printId} from '@/lib/fb/printing/validation';
import {consoleArguments,validateConsoleCommand} from '@/lib/fb/printing/admin.server';
import {newPrintCredential} from '@/lib/fb/printing/credentials.server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function failure(error:unknown){const e=error instanceof PrintBoundaryError?error:new PrintBoundaryError(503,'unavailable');return NextResponse.json({error:e.code},{status:e.status,headers});}
async function authenticated(){const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new PrintBoundaryError(403,'forbidden');return client;}
export async function GET(request:NextRequest){try{const client=await authenticated();const q=request.nextUrl.searchParams;let result:unknown;if(q.has('job_id')){if(q.size!==1)throw new PrintBoundaryError(400,'invalid_input');const id=q.get('job_id');printId(id);result=await printRpc(client,'get_current_hotel_fb_print_detail',{p_job_id:id});}else result=await printRpc(client,'get_current_hotel_fb_print_console',consoleArguments(q));return NextResponse.json(result,{headers});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){try{
 try{sameOrigin(request);}catch{throw new PrintBoundaryError(403,'forbidden');}const client=await authenticated();if(!isJsonContentType(request.headers.get('content-type')))throw new PrintBoundaryError(415,'invalid_content_type');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let raw:Awaited<ReturnType<typeof readUtf8BodyWithLimit>>;
 try{raw=await Promise.race([readUtf8BodyWithLimit({headers:request.headers,body:request.body?.pipeThrough(new TransformStream(),{signal:controller.signal})??null},8192),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new PrintBoundaryError(408,'request_timeout'));},10000);})]);}finally{clearTimeout(timer);controller.abort();}
 if(!raw.ok)throw new PrintBoundaryError(raw.reason==='too_large'?413:400,'invalid_body');let input:unknown;try{input=JSON.parse(raw.text);}catch{throw new PrintBoundaryError(400,'invalid_json');}
 const command=validateConsoleCommand(input);const secret=['pairing','rotate'].includes(command.operation)?newPrintCredential():null;
 const result=await printRpc<Record<string,unknown>>(client,'execute_current_hotel_fb_print_admin',{p_operation:command.operation,p_body:{...command.body,...(secret?{secret_id:secret.id,digest:secret.digest}:{})},p_key:command.key});
 return NextResponse.json({...result,...(secret?{one_time_secret:secret.token,secret_kind:command.operation}:{})},{headers});
}catch(e){return failure(e);}}
