'use server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {orderRpc,OrderBoundaryError} from '@/lib/fb/orders/rpc.server';
import {uuid} from '@/lib/fb/validation';
import type {OperationResult} from '@/lib/fb/orders/operations';
import {fbOrderDiagnostic} from '@/lib/fb/orders/diagnostics.server';
async function values(form:FormData,keys:string[]){
 const h=await headers();let origin:URL;try{origin=new URL(h.get('origin')||'');}catch{throw new OrderBoundaryError(403,'forbidden');}
 if(origin.host!==h.get('host'))throw new OrderBoundaryError(403,'forbidden');
 let size=0;const result:Record<string,string>={};for(const [key,value]of form){if(key.startsWith('$ACTION_'))continue;if(!keys.includes(key)||typeof value!=='string'||key in result)throw new OrderBoundaryError(400,'invalid_input');size+=Buffer.byteLength(value);result[key]=value;}
 if(size>1024||keys.some(k=>!result[k]))throw new OrderBoundaryError(400,'invalid_input');return result;
}
function revision(v:string){if(!/^[1-9][0-9]{0,8}$/.test(v))throw new OrderBoundaryError(400,'invalid_input');return Number(v);}
function failure(e:unknown,kind:'transition_rejected'|'cancellation_rejected'):OperationResult{fbOrderDiagnostic(kind);return {ok:false,error:e instanceof OrderBoundaryError?e.code:'unavailable'};}
export async function transitionOrderGroup(form:FormData):Promise<OperationResult>{try{
 const v=await values(form,['group_id','revision','status']);if(!uuid(v.group_id)||!['accepted','preparing','ready','out_for_delivery','delivered'].includes(v.status))throw new OrderBoundaryError(400,'invalid_input');
 await orderRpc(await createClient(),'transition_current_hotel_fb_order_group_v2',{p_group_id:v.group_id,p_expected_revision:revision(v.revision),p_status:v.status});return {ok:true};
}catch(e){return failure(e,'transition_rejected');}}
export async function decideOrderCancellation(form:FormData):Promise<OperationResult>{try{
 const v=await values(form,['request_id','revision','order_revision','approve','reason']);if(!uuid(v.request_id)||!['true','false'].includes(v.approve)||!['guest_request','unavailable','operational','other'].includes(v.reason))throw new OrderBoundaryError(400,'invalid_input');
 await orderRpc(await createClient(),'decide_current_hotel_fb_order_cancellation_v2',{p_request_id:v.request_id,p_expected_revision:revision(v.revision),p_order_revision:revision(v.order_revision),p_approve:v.approve==='true',p_reason_code:v.reason});return {ok:true};
}catch(e){return failure(e,'cancellation_rejected');}}
export async function cancelOrderByStaff(form:FormData):Promise<OperationResult>{try{
 const v=await values(form,['order_id','revision','reason','confirmed']);if(!uuid(v.order_id)||v.confirmed!=='true'||!['guest_request','unavailable','operational','other'].includes(v.reason))throw new OrderBoundaryError(400,'invalid_input');
 await orderRpc(await createClient(),'cancel_current_hotel_fb_order_v1',{p_order_id:v.order_id,p_expected_revision:revision(v.revision),p_reason_code:v.reason});return {ok:true};
}catch(e){return failure(e,'cancellation_rejected');}}
