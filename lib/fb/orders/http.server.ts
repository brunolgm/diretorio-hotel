import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {createAdminClient} from '../../supabase/admin';
import {resolveDomainContext} from '../../domain-context';
import {parseRoomContext,ROOM_CONTEXT_COOKIE_NAME} from '../../room-context';
import {uuid} from '../validation';
import {deriveOrderAccessSecret,opaqueOrderSecret,orderAccessCookie,orderSecretDigest,orderSessionCookie,validOrderSecret} from './credentials.server';
import {orderRpc,OrderBoundaryError} from './rpc.server';
import {nativeOffer,validRoomContext} from './offer.server';
import type {Language,PublicOrder,QuoteLine} from './journey';
import {fbOrderDiagnostic} from './diagnostics.server';

import {privateOrderHeaders,orderBody,redactedOrderError} from './http-request';
export {privateOrderHeaders,orderBody} from './http-request';
export function orderError(error:unknown){const safe=redactedOrderError(error);const diagnostic=fbOrderDiagnostic(safe.status===429?'rate_limited':safe.body.error==='retry_conflict'?'idempotency_conflict':safe.status===403?'access_denied':safe.status===503?'unavailable':'validation_rejected');return NextResponse.json(safe.body,{status:safe.status,headers:{...privateOrderHeaders,'X-FB-Diagnostic-ID':diagnostic}});}
export async function routeHotel(request:Request,slug:string){
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug))throw new OrderBoundaryError(404,'forbidden');
 const client=createAdminClient();const {data,error}=await client.from('hotels').select('id,slug,subdomain,name,theme_preset,theme_primary_color,brand_code,platform_status').eq('slug',slug).maybeSingle();
 const context=resolveDomainContext(request.headers.get('host'));
 if(error||!data||context.kind==='other-domain'||context.kind==='product-subdomain'&&context.subdomain!==data.subdomain)throw new OrderBoundaryError(403,'forbidden');
 return data;
}
async function admit(request:NextRequest,slug:string,action:string,secret:string|undefined){
 // Session/credential correlation is ephemeral; no IP, raw secret or body enters telemetry.
 const digest=secret?createHash('sha256').update(slug+':'+action+':'+secret).digest('hex'):null;
 if(!await orderRpc<boolean>(createAdminClient(),'admit_fb_order_http',{p_hotel_slug:slug,p_action:action,p_digest:digest}))throw new OrderBoundaryError(429,'rate_limited');
}
function validId(value:unknown):asserts value is string{if(typeof value!=='string'||!uuid(value))throw new OrderBoundaryError(400,'invalid_input');}
function language(value:unknown):Language{if(value!==undefined&&!['pt','en','es'].includes(value as string))throw new OrderBoundaryError(400,'invalid_input');return (value||'pt') as Language;}
function intent(value:unknown,quote:boolean){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!(quote?['lines','fulfilment','language']:['lines','fulfilment','language','first_name','last_name','note']).includes(k)))throw new OrderBoundaryError(400,'invalid_input');
 return value;
}
export async function handleOrderHotel(request:NextRequest,slug:string,operation:string){
 let newSession:ReturnType<typeof orderSessionCookie>|undefined;
 try{
  const client=createAdminClient();
  if(request.method==='GET'&&operation==='offer'){
   if([...request.nextUrl.searchParams.keys()].some(k=>k!=='lang'))throw new OrderBoundaryError(400,'invalid_input');
   const hotel=await routeHotel(request,slug);
   await admit(request,slug,'offer',request.cookies.get('lg_fb_session')?.value);
   return NextResponse.json(await nativeOffer(slug,hotel.id,language(request.nextUrl.searchParams.get('lang')||undefined)),{headers:privateOrderHeaders});
  }
  if(request.method!=='POST'||!['quote','confirm','restart'].includes(operation))throw new OrderBoundaryError(404,'invalid_input');
  const body=await orderBody(request,operation==='quote'?['outlet_id','intent']:operation==='confirm'?['outlet_id','quote_id','quote_reference','key','intent']:[]);
  if(operation!=='restart'){validId(body.outlet_id);intent(body.intent,operation==='quote');}
  const hotel=await routeHotel(request,slug);
  let session=request.cookies.get('lg_fb_session')?.value;let sessionExpires:Date|undefined;
  await admit(request,slug,operation,session);
  if(operation==='quote'&&(body.intent as Record<string,unknown>).fulfilment==='room_delivery'&&!await validRoomContext(hotel.id))throw new OrderBoundaryError(403,'forbidden');
  if(operation==='restart'||!session){
   if(operation==='confirm')throw new OrderBoundaryError(410,'session_expired');
   session=opaqueOrderSecret();
   const created=await orderRpc<{expires_at:string}>(client,'begin_fb_order_session',{p_hotel_slug:slug,p_secret_digest:orderSecretDigest(session)});
   // Preserve the credential beyond admission expiry for the last B1 idempotency window.
   sessionExpires=new Date(new Date(created.expires_at).valueOf()+24*60*60*1000);
   newSession=orderSessionCookie(slug,session,sessionExpires);
  }
  if(!validOrderSecret(session))throw new OrderBoundaryError(403,'forbidden');
  let response:NextResponse;
  if(operation==='restart')response=NextResponse.json({ok:true},{headers:privateOrderHeaders});
  else if(operation==='quote'){
   const reference=opaqueOrderSecret();
   const q=await orderRpc<{quote_id:string;expires_at:string;priced:{currency:string;total_minor:number;lines:PricedLine[]}}>(client,'create_fb_order_quote',{
    p_hotel_slug:slug,p_session_secret:session,p_outlet_id:body.outlet_id,p_intent:body.intent,p_quote_digest:orderSecretDigest(reference)});
   response=NextResponse.json({quote_id:q.quote_id,quote_reference:reference,expires_at:q.expires_at,currency:q.priced.currency,total_minor:q.priced.total_minor,
    available:true,lines:q.priced.lines.map(l=>quoteLine(l))},{headers:privateOrderHeaders});
  }else{
   validId(body.quote_id);validId(body.key);if(!validOrderSecret(body.quote_reference))throw new OrderBoundaryError(400,'invalid_input');
   const access=deriveOrderAccessSecret(session,slug,body.outlet_id as string,body.key);
   const room=parseRoomContext(request.cookies.get(ROOM_CONTEXT_COOKIE_NAME)?.value);
   const receipt=await orderRpc<{order_id:string;status:string;replayed:boolean;access_expires_at:string}>(client,'confirm_fb_order_from_quote',{
    p_hotel_slug:slug,p_session_secret:session,p_outlet_id:body.outlet_id,p_quote_id:body.quote_id,p_quote_secret:body.quote_reference,p_key:body.key,p_intent:body.intent,
    p_room_token:room?.roomToken||null,p_access_digest:orderSecretDigest(access)});
   const lang=language((body.intent as Record<string,unknown>).language);
   const tracking=(resolveDomainContext(request.headers.get('host')).kind==='product-subdomain'?'':'/hotel/'+slug)+'/pedidos/'+receipt.order_id+'?lang='+lang;
   response=NextResponse.json({order_id:receipt.order_id,status:receipt.status,replayed:receipt.replayed,tracking_href:tracking},{headers:privateOrderHeaders});
   response.cookies.set(orderAccessCookie(receipt.order_id,access,new Date(receipt.access_expires_at)));
  }
  if(sessionExpires)response.cookies.set(orderSessionCookie(slug,session,sessionExpires));return response;
 }catch(error){const response=orderError(error);if(newSession)response.cookies.set(newSession);return response;}
}
type PricedLine={origin_id:string;kind:string;name:string;quantity:number;unit_minor:number;total_minor:number;currency:string;extra_minor?:number;options?:{origin_id:string;name:string;group_name:string;unit_minor:number;quantity:number}[];components?:PricedLine[]};
function quoteLine(l:PricedLine,component=false):QuoteLine{return {id:l.origin_id,kind:component?'component':l.kind,name:l.name,quantity:l.quantity,unit_minor:component?0:l.unit_minor,total_minor:component?0:l.total_minor,currency:l.currency,extra_minor:l.extra_minor||0,options:(l.options||[]).map(o=>({id:o.origin_id,name:o.name,group:o.group_name,unit_minor:o.unit_minor,quantity:o.quantity})),components:(l.components||[]).map(c=>quoteLine(c,true))};}
type RawFacts={order_id:string;status:string;revision:number;created_at:string;currency:string;total_minor:number;fulfilment:PublicOrder['fulfilment'];groups:{sector_name:string;status:string}[];lines:{id:string;name:string;quantity:number;total_minor:number;kind:string}[];options:{line_id:string;name:string}[];history:{action:string;status:string|null;at:string}[]};
export async function handleOrderTracking(request:NextRequest,slug:string,id:string){
 try{
  validId(id);await routeHotel(request,slug);const secret=request.cookies.get('lg_fb_access')?.value;
  if(!validOrderSecret(secret))throw new OrderBoundaryError(403,'forbidden');
  let body:Record<string,unknown>|undefined;
  if(request.method==='POST'){body=await orderBody(request,['revision'],1024);if(!Number.isSafeInteger(body.revision)||(body.revision as number)<1)throw new OrderBoundaryError(400,'invalid_input');}
  else if(request.method!=='GET')throw new OrderBoundaryError(405,'invalid_input');
  await admit(request,slug,body?'cancel':'status',secret);
  const client=createAdminClient();const args={p_hotel_slug:slug,p_access_secret:secret};
  const raw=await orderRpc<RawFacts>(client,'get_fb_order_status',args);
  if(raw?.order_id!==id)throw new OrderBoundaryError(403,'forbidden');
  if(body){const result=await orderRpc<{status:string}>(client,'request_fb_order_cancellation',{...args,p_expected_revision:body.revision});return NextResponse.json({status:result.status},{headers:privateOrderHeaders});}
  const cancellation=await orderRpc<PublicOrder['cancellation']>(client,'get_fb_order_cancellation_info',args);
  const safe:PublicOrder={order_id:id,reference:id.slice(0,8).toUpperCase(),status:raw.status,revision:raw.revision,created_at:raw.created_at,currency:raw.currency,total_minor:raw.total_minor,fulfilment:raw.fulfilment,
   groups:raw.groups.map(g=>({label:g.sector_name,status:g.status})),lines:raw.lines.map(l=>({name:l.name,kind:l.kind,quantity:l.quantity,total_minor:l.total_minor,options:raw.options.filter(o=>o.line_id===l.id).map(o=>o.name)})),
   history:raw.history.filter(e=>['orders.registered','orders.accepted','orders.preparing','orders.ready','orders.out_for_delivery','orders.delivered','orders.cancelled','orders.cancellation_requested','orders.cancellation_denied'].includes(e.action)).map(e=>({action:e.action,status:e.status,at:e.at})),cancellation};
  return NextResponse.json(safe,{headers:privateOrderHeaders});
 }catch(error){return orderError(error);}
}
