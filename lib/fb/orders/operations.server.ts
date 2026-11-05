import 'server-only';
import {redirect} from 'next/navigation';
import {createClient} from '../../supabase/server';
import {hasMinimumRole,normalizeAppRole,type AdminProfile} from '../../auth';
import {orderRpc,OrderBoundaryError} from './rpc.server';
import type {OrderAccess,PanelOrder,PanelPage,PrivateOrderView} from './operations';
import {uuid} from '../validation';
import {printRpc} from '../printing/rpc.server';
import type {GroupPrinting} from '../printing/admin';

/** Dedicated shell guard. It is used only on the proxy-stamped exact orders route. */
export async function requireOrderShell(){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:profile,error}=await client.from('profiles').select('*').eq('id',user.id).single();const role=normalizeAppRole(profile?.role);
 if(error||!profile?.is_active||!profile.hotel_id||!role)redirect('/acesso-indisponivel');if(!hasMinimumRole(role,'operador'))redirect('/admin/acesso-negado');
 return {user,profile:{...profile,hotel_id:profile.hotel_id,is_active:true,normalizedRole:role} satisfies AdminProfile};
}
export async function currentOrderAccess():Promise<OrderAccess|null>{try{return await orderRpc<OrderAccess>(await createClient(),'get_current_hotel_fb_order_access');}catch{return null;}}
export async function orderPanelPage(query:URLSearchParams):Promise<PanelPage>{
 if([...query.keys()].some(k=>!['after_created','after_id','history'].includes(k)))throw new OrderBoundaryError(400,'invalid_input');
 const after=query.get('after_created'),id=query.get('after_id'),history=query.get('history');
 if((after===null)!==(id===null)||id&&!uuid(id)||after&&(after.length>64||!Number.isFinite(Date.parse(after)))||history!==null&&!['0','1'].includes(history))throw new OrderBoundaryError(400,'invalid_input');
 const client=await createClient();const access=await orderRpc<OrderAccess>(client,'get_current_hotel_fb_order_access');
 const raw=await orderRpc<PanelOrder[]>(client,'get_current_hotel_fb_order_panel_v2',{p_limit:50,p_after_created:after,p_after_id:id,p_history:history==='1'});
 const orders:PanelOrder[]=raw.map(o=>({order_id:o.order_id,status:o.status,revision:o.revision,created_at:o.created_at,currency:o.currency,fulfilment:o.fulfilment,total_minor:o.total_minor,
  groups:o.groups.map(g=>({id:g.id,sector_id:g.sector_id,sector_name:g.sector_name,status:g.status,revision:g.revision})),
  lines:o.lines.map(l=>({id:l.id,group_id:l.group_id,parent_id:l.parent_id,name:l.name,quantity:l.quantity,kind:l.kind,total_minor:l.total_minor})),options:o.options.map(x=>({line_id:x.line_id,name:x.name,group_name:x.group_name})),history:o.history.map(e=>({action:e.action,at:e.at,status:e.status})),permissions:o.permissions,cancellation_requests:o.cancellation_requests}));
 const ids=orders.flatMap(o=>o.groups.map(g=>g.id));try{const printing:GroupPrinting[]=[];for(let offset=0;offset<ids.length;offset+=500)printing.push(...await printRpc<GroupPrinting[]>(client,'get_current_hotel_fb_print_groups',{p_group_ids:ids.slice(offset,offset+500)}));for(const o of orders)o.printing=printing.filter(p=>o.groups.some(g=>g.id===p.group_id));}catch{for(const o of orders)o.printing_unavailable=true;}
 const last=orders.at(-1);return {access,orders,next:orders.length===50&&last?{created_at:last.created_at,id:last.order_id}:null};
}
export async function privateOrderView(id:unknown){if(typeof id!=='string'||!uuid(id))throw new OrderBoundaryError(400,'invalid_input');return orderRpc<PrivateOrderView>(await createClient(),'get_current_hotel_fb_order_private_view',{p_order_id:id});}
