import{randomUUID}from'node:crypto';
import{seedB23,rpc,fullIntent}from'./fb-b23-seed.mjs';
import{labSql}from'../../scripts/fb-local-lab.mjs';import{literal}from'./fb-local-seed.mjs';
export function rows(sql){const value=labSql(sql,true);return value==='t'?true:value==='f'?false:JSON.parse(value||'null');}
const{newPrintCredential}=await import('../../lib/fb/printing/credentials.server.ts');
const{fbOrderFoundation}=await import('../../lib/fb/orders/boundary.server.ts');
export{rpc,literal,labSql,newPrintCredential};
export async function seedC1(){const x=await seedB23();const core=fbOrderFoundation(x.project);x.server={client:x.project};const one=q=>{const text=labSql(q,true);return text?JSON.parse(text):null;};
 x.cfg=async(t,kind,values,id=null)=>{const prior=kind==='settings'?one('select (select to_jsonb(s) from fb_print_private.settings s where hotel_id='+literal(t.id)+')'):id?one('select (select to_jsonb(s) from fb_print_private.'+({device:'devices',destination:'destinations',printer:'printers',route:'routes'}[kind])+' s where hotel_id='+literal(t.id)+' and id='+literal(id)+')'):null;return rpc(t.admin,'save_current_hotel_fb_print_config',{p_kind:kind,p_id:id,p_expected_revision:prior?.revision||0,p_values:values});};
 x.grant=async(t,actor,cap,sector=null,active=true)=>{const prior=one('select (select to_jsonb(g) from fb_print_private.grants g where hotel_id='+literal(t.id)+' and user_id='+literal(actor.id)+' and capability='+literal(cap)+' and sector_id is not distinct from '+literal(sector)+'::uuid)');return rpc(t.admin,'grant_current_hotel_fb_print_capability',{p_user_id:actor.id,p_capability:cap,p_sector_id:sector,p_active:active,p_expected_revision:prior?.revision||0});};
 x.order=async(t,intent=fullIntent(t))=>{const s=await core.beginSession(t.slug);if(!s.ok)throw Error('Own B session failed');const q=await core.quote(t.slug,s.data.secret,t.outlet.id,intent);if(!q.ok)throw Error('Own B quote failed');const r=await core.confirm({slug:t.slug,session:s.data.secret,outlet:t.outlet.id,key:randomUUID(),intent,roomToken:intent.fulfilment==='room_delivery'?t.roomTokens.valid:null,expectedTotalMinor:q.data.total_minor,expectedCurrency:q.data.currency});if(!r.ok)throw Error('Own B confirmation failed');const groups=rows("select jsonb_agg(to_jsonb(g) order by g.sector_id) from fb_order_private.order_groups g where order_id="+literal(r.data.order_id));return {...r.data,groups};};
 x.accept=async(t,g)=>rpc(t.admin,'transition_current_hotel_fb_order_group_v2',{p_group_id:g.id,p_expected_revision:g.revision,p_status:'accepted'});
 x.activate=async(t,enabled)=>{const s=rows('select to_jsonb(s) from fb_print_private.settings s where hotel_id='+literal(t.id));return rpc(t.admin,'activate_current_hotel_fb_printing',{p_enabled:enabled,p_expected_revision:s.revision});};
 x.pair=async(t,device)=>{const code=newPrintCredential(),credential=newPrintCredential();await rpc(t.admin,'create_current_hotel_fb_print_pairing',{p_device_id:device.id,p_pairing_id:code.id,p_pairing_digest:code.digest});const r=await rpc(x.server,'exchange_fb_print_pairing',{p_pairing_id:code.id,p_pairing_digest:code.digest,p_device_id:device.id,p_credential_id:credential.id,p_credential_digest:credential.digest,p_protocol_version:1,p_software_version:'fixture-1'});return {...credential,device,issued:r};};
 x.auth=(c,extra={})=>({p_credential_id:c.id,p_digest:c.digest,p_protocol_version:1,...extra});
 x.claim=async c=>rpc(x.server,'claim_fb_print_job',x.auth(c,{p_key:randomUUID()}));
 x.receipt=async(c,j)=>rpc(x.server,'receipt_fb_print_job',x.auth(c,{p_job_id:j.job_id,p_fence:j.fence,p_expected_revision:j.revision,p_snapshot_hash:j.snapshot_hash}));
 x.dispatch=async(c,j)=>rpc(x.server,'authorize_fb_print_dispatch',x.auth(c,{p_job_id:j.job_id,p_fence:j.fence,p_expected_revision:j.revision,p_snapshot_hash:j.snapshot_hash}));
 x.result=async(c,j,result='submitted',extra={})=>rpc(x.server,'report_fb_print_result',x.auth(c,{p_job_id:j.job_id,p_fence:j.fence,p_expected_revision:j.revision,p_key:randomUUID(),p_result:result,p_code:result==='submitted'?'spooler_accepted':result==='ambiguous'?'unknown_after_send':'no_io',p_no_io:result==='pre_send_failed',...extra}));
 x.combo=t=>fullIntent(t,{fulfilment:'room_delivery',lines:[{kind:'combo',id:t.combo.id,menu_id:t.menu.id,quantity:2,choices:[{id:t.foodChoice.id,options:[t.requiredOption.id]},{id:t.drinkChoice.id,options:[]}],note:'C1PrivateLineNote'}]});
 x.jobs=t=>rows("select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at,j.id),'[]') from fb_print_private.jobs j where hotel_id="+literal(t.id));
 x.materialize=t=>rpc(t.admin,'reconcile_current_hotel_fb_printing',{p_batch:100});
 x.capless=async(t)=>{const denied=await t.admin.client.rpc('get_current_hotel_fb_print_config');return denied.error?.code==='42501';};
 return x;
}
