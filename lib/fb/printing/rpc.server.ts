import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PrintBoundaryError} from './validation.ts';
type Result={data:unknown;error:{code?:string;message?:string}|null};
type Builder=PromiseLike<Result>&{abortSignal(signal:AbortSignal):PromiseLike<Result>};
export async function printRpc<T>(client:SupabaseClient,name:string,args:Record<string,unknown>={}):Promise<T>{
 let r:Result;try{const call=(client.rpc as unknown as (name:string,args:Record<string,unknown>)=>Builder)(name,args);r=await call.abortSignal(AbortSignal.timeout(10000));}catch{throw new PrintBoundaryError(503,'unavailable');}
 if(r.error){const code=r.error.code;const safe=code==='42501'?'forbidden':code==='PT409'?'conflict':code==='PT410'?'expired':code==='PT429'?'rate_limited':['22023','22P02','23514','23503','23505','23502'].includes(code||'')?'invalid_input':'unavailable';throw new PrintBoundaryError(safe==='forbidden'?403:safe==='conflict'?409:safe==='expired'?410:safe==='rate_limited'?429:safe==='invalid_input'?400:503,safe);}
 return r.data as T;
}
