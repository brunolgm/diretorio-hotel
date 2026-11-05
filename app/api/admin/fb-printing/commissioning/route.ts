import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {sameOrigin} from '@/lib/fb/orders/http-request';
import {readPrintingBody,printingHeaders,printingFailure} from '@/lib/fb/printing/http.server';
import {printRpc} from '@/lib/fb/printing/rpc.server';
import {PrintBoundaryError} from '@/lib/fb/printing/validation';
import {commissioningCommand} from '@/lib/fb/printing/commissioning';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function authenticated(){const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new PrintBoundaryError(403,'forbidden');return client;}
export async function GET(){try{return NextResponse.json(await printRpc(await authenticated(),'get_current_hotel_fb_commissioning'),{headers:printingHeaders});}catch(e){return printingFailure(e);}}
export async function POST(request:NextRequest){try{
 try{sameOrigin(request);}catch{throw new PrintBoundaryError(403,'forbidden');}const client=await authenticated(),c=commissioningCommand(await readPrintingBody(request));
 return NextResponse.json(await printRpc(client,'execute_current_hotel_fb_commissioning',{p_operation:c.operation,p_body:c.body,p_key:c.key}),{headers:printingHeaders});
}catch(e){return printingFailure(e);}}
