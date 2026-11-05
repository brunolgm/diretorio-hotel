import {NextResponse,type NextRequest} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {printingHeaders,printingFailure,readPrintingBody,requirePrintingTls} from '@/lib/fb/printing/http.server';
import {parsePrintCredential,printCorrelation} from '@/lib/fb/printing/credentials.server';
import {objectWithKeys,positive,PrintBoundaryError} from '@/lib/fb/printing/validation';
import {printRpc} from '@/lib/fb/printing/rpc.server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
 requirePrintingTls(request);const client=createAdminClient(),authorization=request.headers.get('authorization')||'',credential=authorization.startsWith('Bearer ')?parsePrintCredential(authorization.slice(7)):null;
 for(const [action,digest]of [['bootstrap',printCorrelation('printing-gateway')],['device',printCorrelation(credential?.id||'unidentified-device')]])if(!await printRpc(client,'admit_fb_print_http',{p_action:action,p_digest:digest}))throw new PrintBoundaryError(429,'rate_limited');
 if(!credential)throw new PrintBoundaryError(403,'forbidden');const b=await readPrintingBody(request,60000);objectWithKeys(b,['protocol_version','queues']);positive(b.protocol_version);
 if(!Array.isArray(b.queues)||b.queues.length>64)throw new PrintBoundaryError(400,'invalid_input');
 for(const q of b.queues){objectWithKeys(q,['name','driver','state']);if(typeof q.name!=='string'||!q.name.length||q.name.length>120||q.name.trim()!==q.name||/[\x00-\x1f\x7f\\/<>]/.test(q.name)||typeof q.driver!=='string'||q.driver.length>160||/[\x00-\x1f\x7f]/.test(q.driver)||!['unknown','offline','paper_out','error','unavailable'].includes(String(q.state)))throw new PrintBoundaryError(400,'invalid_input');}
 const result=await printRpc(client,'report_fb_print_queues',{p_credential_id:credential.id,p_digest:credential.digest,p_protocol_version:b.protocol_version,p_queues:b.queues});return NextResponse.json(result,{headers:printingHeaders});
}catch(e){return printingFailure(e);}}
