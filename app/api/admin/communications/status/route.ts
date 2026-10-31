import { createClient } from '@supabase/supabase-js';
import { getRequiredEnvVar } from '@/lib/env';
import { recordAdminAuditEvent } from '@/lib/audit';
import { CommunicationStatusError, setCommunicationStatus } from '@/lib/communications/status';
import { isJsonContentType, readUtf8BodyWithLimit } from '@/lib/security/http';
import { revalidatePath } from 'next/cache';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length > 8200) return Response.json({error:'authentication_required'},{status:401,headers});
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'origin_denied'},{status:403,headers});
  if (!isJsonContentType(request.headers.get('content-type'))) return Response.json({error:'invalid_content_type'},{status:415,headers});
  try {
    const body = await readUtf8BodyWithLimit(request,2048);
    if (!body.ok) throw new CommunicationStatusError('invalid_input');
    const input = JSON.parse(body.text);
    if (!input || typeof input !== 'object' || Object.keys(input).some(k=>!['kind','id','expected_updated_at'].includes(k)) || typeof input.expected_updated_at !== 'string') throw new CommunicationStatusError('invalid_input');
    const client = createClient(getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const result = await setCommunicationStatus(client,{kind:input.kind,id:input.id,isActive:false,expectedUpdatedAt:input.expected_updated_at,administratorOnly:true},recordAdminAuditEvent);
    revalidatePath('/','layout');
    return Response.json(result,{headers});
  } catch(error) {
    const e = error instanceof CommunicationStatusError ? error : new CommunicationStatusError('request_unconfirmed',409);
    // Status is already persisted when only its audit confirmation failed.
    if(e.code==='status_changed_audit_unconfirmed')revalidatePath('/','layout');
    return Response.json({status:'interrupted',error:e.code},{status:e.status,headers});
  }
}
