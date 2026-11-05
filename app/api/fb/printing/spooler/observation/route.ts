import {NextResponse,type NextRequest} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {printingHeaders,printingFailure,readPrintingBody,requirePrintingTls} from '@/lib/fb/printing/http.server';
import {parsePrintCredential,printCorrelation} from '@/lib/fb/printing/credentials.server';
import {objectWithKeys,positive,printId,PrintBoundaryError} from '@/lib/fb/printing/validation';
import {printRpc} from '@/lib/fb/printing/rpc.server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
 requirePrintingTls(request);const client=createAdminClient(),authorization=request.headers.get('authorization')||'',credential=authorization.startsWith('Bearer ')?parsePrintCredential(authorization.slice(7)):null;
 for(const [action,digest]of [['bootstrap',printCorrelation('printing-gateway')],['device',printCorrelation(credential?.id||'unidentified-device')]])if(!await printRpc(client,'admit_fb_print_http',{p_action:action,p_digest:digest}))throw new PrintBoundaryError(429,'rate_limited');
 if(!credential)throw new PrintBoundaryError(403,'forbidden');const b=await readPrintingBody(request);objectWithKeys(b,['protocol_version','job_id','fence','printer_id','revision','state']);positive(b.protocol_version);positive(b.fence);positive(b.revision);printId(b.job_id);printId(b.printer_id);if(!['unknown','offline','paper_out','error'].includes(String(b.state)))throw new PrintBoundaryError(400,'invalid_input');
 const result=await printRpc(client,'observe_fb_windows_spooler',{p_credential_id:credential.id,p_digest:credential.digest,p_protocol_version:b.protocol_version,p_job_id:b.job_id,p_fence:b.fence,p_printer_id:b.printer_id,p_revision:b.revision,p_state:b.state});return NextResponse.json(result,{headers:printingHeaders});
}catch(e){return printingFailure(e);}}
