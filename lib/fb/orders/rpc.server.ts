import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fbOrderDiagnostic} from './diagnostics.server.ts';
export class OrderBoundaryError extends Error {readonly status:number;readonly code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code;}}
type RpcResult={data:unknown;error:{code?:string;message?:string}|null};
/** The generated catalogue types predate B. Keep the new RPC adaptation in one place. */
export async function orderRpc<T>(client:SupabaseClient,name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await (client.rpc as unknown as (n:string,a:Record<string,unknown>)=>Promise<RpcResult>)(name,args);
 if(error){const code=error.message==='orders_idempotency_expired'?'confirmation_expired':error.message==='orders_quote_expired'?'quote_expired':error.message==='orders_session_expired'?'session_expired':error.message==='orders_intent_conflict'?'retry_conflict':error.code==='PT409'?'review_required':error.code==='PT410'?'session_expired':error.code==='PT429'?'rate_limited':error.code==='42501'?'forbidden':['22023','22P02','23514','23503','P0002'].includes(error.code||'')?'invalid_input':'unavailable';throw new OrderBoundaryError(code==='forbidden'?403:code==='review_required'||code==='retry_conflict'?409:code.endsWith('expired')?410:code==='rate_limited'?429:code==='invalid_input'?400:503,code);}
 if(name==='confirm_fb_order_from_quote'){const receipt=data as {order_id?:string;replayed?:boolean};fbOrderDiagnostic(receipt?.replayed?'order_recovered':'order_created',receipt?.order_id);}
 else if(name.startsWith('transition_'))fbOrderDiagnostic('transition_confirmed');
 else if(name==='request_fb_order_cancellation'||name.startsWith('decide_'))fbOrderDiagnostic('cancellation_confirmed');
 return data as T;
}
