import {NextResponse,type NextRequest} from 'next/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {printingHeaders,printingFailure,readPrintingBody,requirePrintingTls} from '@/lib/fb/printing/http.server';
import {parsePrintCredential,printCorrelation} from '@/lib/fb/printing/credentials.server';
import {validateDeviceBody,PrintBoundaryError} from '@/lib/fb/printing/validation';
import {printRpc} from '@/lib/fb/printing/rpc.server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
 requirePrintingTls(request);const client=createAdminClient();const header=request.headers.get('authorization')||'',credential=header.startsWith('Bearer ')?parsePrintCredential(header.slice(7)):null;
 for(const [action,digest]of [['bootstrap',printCorrelation('printing-gateway')],['device',printCorrelation(credential?.id||'unidentified-device')]])if(!await printRpc(client,'admit_fb_print_http',{p_action:action,p_digest:digest}))throw new PrintBoundaryError(429,'rate_limited');
 if(!credential)throw new PrintBoundaryError(403,'forbidden');const {body:b}=validateDeviceBody('dispatch',await readPrintingBody(request));
 const result=await printRpc(client,'authorize_fb_windows_spooler_dispatch',{p_credential_id:credential.id,p_digest:credential.digest,p_protocol_version:b.protocol_version,p_job_id:b.job_id,p_fence:b.fence,p_expected_revision:b.revision,p_snapshot_hash:b.snapshot_hash});
 return NextResponse.json(result,{headers:printingHeaders});
}catch(e){return printingFailure(e);}}
