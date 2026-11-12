import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {orderRpc,OrderBoundaryError} from '@/lib/fb/orders/rpc.server';
import {uuid} from '@/lib/fb/validation';
import type {NextRequest} from 'next/server';
import type {KdsAdmin,KdsSnapshot} from './contracts';

export const KDS_COOKIE='lg_kds_screen';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const readKdsAdmin=async()=>orderRpc<KdsAdmin>(await createClient(),'get_current_hotel_fb_kds_admin');
export async function manageKds(body:Record<string,unknown>){
 const client=await createClient();
 if(body.operation==='save'){
  const v=body.screen as Record<string,unknown>|undefined;
  if(!v||Object.keys(v).some(k=>!['id','revision','name','location','mode','active','sector_ids','settings'].includes(k)))throw new OrderBoundaryError(400,'invalid_input');
  return orderRpc(client,'save_current_hotel_fb_kds_screen',{p_id:v.id||null,p_revision:v.revision,p_name:v.name,p_location:v.location,p_mode:v.mode,p_active:v.active,p_sector_ids:v.sector_ids,p_settings:v.settings});
 }
 if(!['pair','revoke'].includes(String(body.operation))||typeof body.id!=='string'||!uuid(body.id)||!Number.isInteger(body.revision))throw new OrderBoundaryError(400,'invalid_input');
 const code=body.operation==='pair'?randomBytes(18).toString('base64url'):null;
 const result=await orderRpc<{expires_at:string|null}>(client,'rotate_current_hotel_fb_kds_access',{p_id:body.id,p_revision:body.revision,p_pair_digest:code?digest(code):null});
 return code?{code,expires_at:result.expires_at}:{ok:true};
}
export function kdsSecret(request:NextRequest){const secret=request.cookies.get(KDS_COOKIE)?.value;if(!secret||!/^[A-Za-z0-9_-]{43}$/.test(secret))throw new OrderBoundaryError(403,'forbidden');return secret;}
export async function pairKds(body:Record<string,unknown>){
 if(typeof body.code!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(body.code)||typeof body.device_name!=='string'||body.device_name.length<1||body.device_name.length>100)throw new OrderBoundaryError(400,'invalid_input');
 const secret=randomBytes(32).toString('base64url');
 await orderRpc(createAdminClient(),'redeem_fb_kds_pairing',{p_code:body.code,p_session_digest:digest(secret),p_device_name:body.device_name});return secret;
}
export async function kdsSnapshot(secret:string):Promise<KdsSnapshot>{
 const data=await orderRpc<KdsSnapshot>(createAdminClient(),'get_fb_kds_snapshot',{p_secret:secret});
 if(data.screen.mode==='monitor')return data;
 // Login can only add actions inside this paired screen's sectors; projection stays minimal.
 try{
  const client=await createClient();await orderRpc(client,'authorize_current_hotel_fb_kds',{p_secret:secret});
  const access=await orderRpc<{capabilities:{capability:string;sector_id:string|null}[]}>(client,'get_current_hotel_fb_order_access');
  const can=(cap:string,sector:string)=>access.capabilities.some(c=>c.capability===cap&&(!c.sector_id||c.sector_id===sector));
  data.tickets=data.tickets.map(t=>({...t,can_transition:can('orders.read',t.sector_id)&&can('orders.transition',t.sector_id)&&(data.screen.mode!=='dispatch'||['ready','out_for_delivery'].includes(t.status))}));
 }catch{/* Paired read-only view stays available without staff login. */}
 return data;
}
export async function kdsTransition(secret:string,body:Record<string,unknown>){
 if(typeof body.group_id!=='string'||!uuid(body.group_id)||!Number.isInteger(body.revision)||!['accepted','preparing','ready','out_for_delivery','delivered'].includes(String(body.status)))throw new OrderBoundaryError(400,'invalid_input');
 return orderRpc(await createClient(),'transition_current_hotel_fb_kds_group',{p_secret:secret,p_group_id:body.group_id,p_revision:body.revision,p_status:body.status});
}
