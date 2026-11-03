import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {ORDER_LIMITS,foundationFailure,type FoundationResult,type OrderQuote,type OrderReceipt} from './contracts.ts';
import {deriveOrderAccessSecret,opaqueOrderSecret,orderSecretDigest,validOrderSecret} from './credentials.server.ts';
import {uuid} from '../validation.ts';

type RpcName='begin_fb_order_session'|'admit_fb_order_attempt'|'quote_fb_order'|'confirm_fb_order'|'get_fb_order_status'|'request_fb_order_cancellation';
export interface OrderFoundationClient {
 rpc(name:RpcName,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string}|null}>;
}
function defaultClient():OrderFoundationClient {
 const client=createAdminClient();
 // The legacy Database type belongs to A; keep additive B contracts isolated here.
 return {rpc:client.rpc.bind(client) as unknown as OrderFoundationClient['rpc']};
}
function intentIsBounded(value:unknown):boolean {
 try{return Buffer.byteLength(JSON.stringify(value)??'','utf8')<=ORDER_LIMITS.bodyBytes;}catch{return false;}
}
/** B1 server-only foundation, not an HTTP route or checkout UI.
 * A future B2 handler resolves canonical hotel/domain and room cookie before calling.
 * Only SQL validates/normalizes intent, recalculates price and builds stored snapshots.
 * This module never logs request bodies, credentials, names, room or provider messages.
 */
export function fbOrderFoundation(client:OrderFoundationClient=defaultClient()) {
 async function call<T>(name:RpcName,args:Record<string,unknown>):Promise<FoundationResult<T>> {
  try{const result=await client.rpc(name,args);return result.error?foundationFailure(result.error.code):{ok:true,data:result.data as T};}
  catch{return foundationFailure(undefined);}
 }
 function context(slug:string,session:string,outlet?:string):boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)&&validOrderSecret(session)&&(outlet===undefined||uuid(outlet));
 }
 return {
  async beginSession(slug:string) {
   if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug))return foundationFailure('22023');
   const secret=opaqueOrderSecret();
   const result=await call<{id:string;expires_at:string}>('begin_fb_order_session',{p_hotel_slug:slug,p_secret_digest:orderSecretDigest(secret)});
   return result.ok?{ok:true as const,data:{...result.data,secret}}:result;
  },
  async quote(slug:string,session:string,outlet:string,intent:unknown) {
   if(!context(slug,session,outlet)||!intentIsBounded(intent))return foundationFailure('22023');
   return call<OrderQuote>('quote_fb_order',{p_hotel_slug:slug,p_session_secret:session,p_outlet_id:outlet,p_intent:intent});
  },
  async confirm(input:{slug:string;session:string;outlet:string;key:string;intent:unknown;roomToken:string|null;expectedTotalMinor:number;expectedCurrency:string}) {
   if(!context(input.slug,input.session,input.outlet)||!uuid(input.key)||!intentIsBounded(input.intent)||!Number.isSafeInteger(input.expectedTotalMinor)||input.expectedTotalMinor<0||!/^[A-Z]{3}$/.test(input.expectedCurrency)||(input.roomToken!==null&&(typeof input.roomToken!=='string'||input.roomToken.length>256)))return foundationFailure('22023');
   const access=deriveOrderAccessSecret(input.session,input.slug,input.outlet,input.key);
   const result=await call<OrderReceipt>('confirm_fb_order',{p_hotel_slug:input.slug,p_session_secret:input.session,p_key:input.key,p_outlet_id:input.outlet,p_intent:input.intent,p_room_token:input.roomToken,p_access_digest:orderSecretDigest(access),p_expected_total_minor:input.expectedTotalMinor,p_expected_currency:input.expectedCurrency});
   return result.ok?{ok:true as const,data:{...result.data,accessSecret:access}}:result;
  },
  async status(slug:string,access:string) {
   if(!context(slug,access))return foundationFailure('42501');
   return call<Record<string,unknown>>('get_fb_order_status',{p_hotel_slug:slug,p_access_secret:access});
  },
  async requestCancellation(slug:string,access:string,revision:number) {
   if(!context(slug,access)||!Number.isSafeInteger(revision)||revision<1)return foundationFailure('22023');
   return call<{status:string;request_id?:string;revision?:number}>('request_fb_order_cancellation',{p_hotel_slug:slug,p_access_secret:access,p_expected_revision:revision});
  },
 };
}
