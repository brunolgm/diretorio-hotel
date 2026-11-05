import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {seedC1,rpc,rows,literal,labSql} from './fb-c1-fixture.mjs';
import {cancellationContact} from '../../lib/fb/orders/cancellation-contact.ts';
import {orderCopy} from '../../lib/fb/orders/journey.ts';
import {config} from './fb-b23-seed.mjs';
const checks=[];const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const denied=async(actor,name,args,code='42501')=>{const r=await actor.client.rpc(name,args);check(r.error?.code===code,name+' rejects '+code+' actual '+(r.error?.code||'success'));};
const x=await seedC1();
try{
 for(const t of x.tenants){
  for(const cap of ['printing.configure','printing.test','printing.reprint'])await x.grant(t,t.admin,cap);
  await x.cfg(t,'settings',{ticket_minutes:15});
  const destinations={};
  for(const [key,sector]of [['kitchen',t.kitchen],['bar',t.bar]]){
   const device=await x.cfg(t,'device',{name:'Registration '+key});const credential=await x.pair(t,device);
   const destination=await x.cfg(t,'destination',{name:'Frozen '+key,device_id:device.id});
   const printer=await x.cfg(t,'printer',{name:'Printer '+key,device_id:device.id,destination_id:destination.id,adapter:'windows_spooler',config:{queue_name:'Isolated-'+key}});
   const route=await x.cfg(t,'route',{sector_id:sector.id,destination_id:destination.id});destinations[key]={device,credential,destination,printer,route};
  }
  await x.activate(t,true);
  const a=await x.order(t,x.combo(t));
  const facts=rows('select jsonb_agg(to_jsonb(f)) from fb_print_private.registration_facts f where order_id='+literal(a.order_id));
  check(facts.length===2&&facts.every(f=>f.kind==='order'&&f.order_revision===1),'durable registration per group '+t.name);
  check(!/C1PrivateLineNote|Homolog|accessSecret|first_name|room_label/.test(JSON.stringify(facts)),'outbox has no private guest data '+t.name);
  await Promise.all(Array.from({length:20},()=>x.materialize(t)));let originals=x.jobs(t).filter(j=>j.order_id===a.order_id);
  check(originals.length===2&&originals.every(j=>j.kind==='order'),'20 reconciliations print registered without human acceptance '+t.name);
  check(rows('select to_jsonb(status) from fb_order_private.orders where id='+literal(a.order_id))==='registered','printing leaves registered status '+t.name);
  for(const j of originals)check(j.snapshot.lines.length===1&&j.snapshot.sector_id===j.sector_id,'sector-only commercial snapshot '+t.name);
  await x.accept(t,a.groups.find(g=>g.sector_id===t.kitchen.id));await x.materialize(t);
  check(x.jobs(t).filter(j=>j.order_id===a.order_id).length===2,'human acceptance creates no extra job '+t.name);
  await denied(x.server,'request_fb_order_cancellation',{p_hotel_slug:t.slug,p_access_secret:a.accessSecret,p_expected_revision:1});
  const revision=rows('select revision::text from fb_order_private.orders where id='+literal(a.order_id));
  await denied(t.viewer,'cancel_current_hotel_fb_order_v1',{p_order_id:a.order_id,p_expected_revision:revision,p_reason_code:'guest_request'});
  await denied(x.tenants.find(other=>other.id!==t.id).admin,'cancel_current_hotel_fb_order_v1',{p_order_id:a.order_id,p_expected_revision:revision,p_reason_code:'guest_request'});
  const cancelArgs={p_order_id:a.order_id,p_expected_revision:revision,p_reason_code:'guest_request'};
  await Promise.all(Array.from({length:10},()=>rpc(t.admin,'cancel_current_hotel_fb_order_v1',cancelArgs)));
  await Promise.all(Array.from({length:20},()=>x.materialize(t)));const cancellations=x.jobs(t).filter(j=>j.order_id===a.order_id&&j.kind==='cancellation');
  check(cancellations.length===2,'concurrent staff cancellations create exactly one notice per original '+t.name);
  check(rows("select count(*)::text from fb_print_private.registration_facts where order_id="+literal(a.order_id)+" and kind='cancellation'")===2,'cancellation facts commit exactly once '+t.name);
  for(const c of cancellations){const o=originals.find(j=>j.id===c.original_job_id);check(!!o&&c.destination_id===o.destination_id&&JSON.stringify(c.routing_snapshot)===JSON.stringify(o.routing_snapshot),'destination/printer/copy remain frozen '+t.name);check(JSON.stringify(c.snapshot.lines)===JSON.stringify(o.snapshot.lines)&&c.snapshot.label==='CANCELAMENTO'&&!!c.snapshot.cancelled_at,'new cancellation snapshot preserves own-sector lines '+t.name);}
  check(x.jobs(t).filter(j=>j.order_id===a.order_id&&j.kind==='order').every(j=>originals.some(o=>o.id===j.id&&o.snapshot_hash===j.snapshot_hash)),'original jobs never rewritten '+t.name);
  const kitchen=destinations.kitchen;let stale=await x.claim(kitchen.credential);stale=await x.receipt(kitchen.credential,stale);stale=await x.dispatch(kitchen.credential,stale);
  check(stale.state==='cancelled','persisted cancellation blocks queued original before dispatch '+t.name);
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(kitchen.credential,{p_software_version:'c2-1.1.0',p_observed_state:'online'}));
  check(!(await x.claim(kitchen.credential)).job_id,'legacy bridge cannot consume new cancellation kind '+t.name);
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(kitchen.credential,{p_software_version:'c2-1.2.0',p_observed_state:'online'}));
  let notice=await x.claim(kitchen.credential);check(notice.kind==='cancellation','updated bridge claims independent cancellation '+t.name);notice=await x.receipt(kitchen.credential,notice);notice=await x.dispatch(kitchen.credential,notice);
  check(notice.state==='dispatching'&&notice.snapshot.label==='CANCELAMENTO','cancellation remains dispatchable for cancelled commercial group '+t.name);
  const acknowledged=await x.result(kitchen.credential,notice);check(acknowledged.state==='submitted','cancellation result remains submitted, never physical confirmed '+t.name);
  await rpc(t.admin,'create_current_hotel_fb_print_job',{p_kind:'reprint',p_destination_id:kitchen.destination.id,p_sector_id:null,p_original_job_id:notice.job_id,p_reason_code:'operational',p_key:randomUUID()});
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(kitchen.credential,{p_software_version:'c2-1.1.0',p_observed_state:'online'}));check(!(await x.claim(kitchen.credential)).job_id,'legacy bridge cannot consume cancellation hidden inside reprint '+t.name);
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(kitchen.credential,{p_software_version:'c2-1.2.0',p_observed_state:'online'}));let reprint=await x.claim(kitchen.credential);check(reprint.kind==='reprint'&&reprint.snapshot.document_kind==='cancellation','updated bridge receives both reprint and cancellation identity '+t.name);reprint=await x.receipt(kitchen.credential,reprint);reprint=await x.dispatch(kitchen.credential,reprint);await x.result(kitchen.credential,reprint);
  const contact=await rpc(x.server,'get_fb_order_contact_sources',{p_hotel_slug:t.slug,p_access_secret:a.accessSecret});check(Array.isArray(contact.departments),'token-bound canonical contact projection '+t.name);
  await denied(x.server,'get_fb_order_contact_sources',{p_hotel_slug:x.tenants.find(other=>other.id!==t.id).slug,p_access_secret:a.accessSecret});
  const fast=await x.order(t,x.combo(t));await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:fast.order_id,p_expected_revision:1,p_reason_code:'operational'});await x.materialize(t);await x.materialize(t);
  check(x.jobs(t).filter(j=>j.order_id===fast.order_id).length===4,'fast cancellation before polling retains originals and two notices '+t.name);
  const moved=await x.order(t);await x.materialize(t);const frozen=x.jobs(t).find(j=>j.order_id===moved.order_id&&j.kind==='order');
  await x.cfg(t,'printer',{config:{queue_name:'New-isolated-queue'}},kitchen.printer.id);
  await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:moved.order_id,p_expected_revision:1,p_reason_code:'other'});await x.materialize(t);
  const movedNotice=x.jobs(t).find(j=>j.order_id===moved.order_id&&j.kind==='cancellation');check(JSON.stringify(movedNotice.routing_snapshot)===JSON.stringify(frozen.routing_snapshot)&&movedNotice.routing_snapshot.printer.config.queue_name==='Isolated-kitchen','edited configuration never redirects cancellation '+t.name);
  const terminal=await x.order(t,x.combo(t)),terminalGroup=terminal.groups.find(g=>g.sector_id===t.kitchen.id);
  let groupRevision=1;for(const status of ['accepted','preparing','ready','out_for_delivery'])await rpc(t.admin,'transition_current_hotel_fb_order_group_v2',{p_group_id:terminalGroup.id,p_expected_revision:groupRevision++,p_status:status});
  await config(t.admin,'grant',{user_id:t.operator.id,capability:'orders.cancel',sector_id:t.kitchen.id,active:true});
  await config(t.admin,'grant',{user_id:t.operator.id,capability:'orders.read',sector_id:t.bar.id,active:true});
  await config(t.admin,'grant',{user_id:t.operator.id,capability:'orders.cancel',sector_id:t.bar.id,active:true});
  const deliveryRevision=rows('select revision::text from fb_order_private.orders where id='+literal(terminal.order_id));
  await denied(t.operator,'cancel_current_hotel_fb_order_v1',{p_order_id:terminal.order_id,p_expected_revision:deliveryRevision,p_reason_code:'operational'});
  const supervised=await x.order(t,x.combo(t)),supervisedGroup=supervised.groups.find(g=>g.sector_id===t.kitchen.id);let supervisedRevision=1;
  for(const status of ['accepted','preparing','ready','out_for_delivery'])await rpc(t.admin,'transition_current_hotel_fb_order_group_v2',{p_group_id:supervisedGroup.id,p_expected_revision:supervisedRevision++,p_status:status});
  const supervisedResult=await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:supervised.order_id,p_expected_revision:rows('select revision::text from fb_order_private.orders where id='+literal(supervised.order_id)),p_reason_code:'operational'});
  check(supervisedResult.status==='cancelled'&&rows("select count(*)::text from fb_order_private.order_groups where order_id="+literal(supervised.order_id)+" and status<>'cancelled'")===0,'explicit supervisor can cancel delivery and close all sectors '+t.name);
  await rpc(t.admin,'transition_current_hotel_fb_order_group_v2',{p_group_id:terminalGroup.id,p_expected_revision:groupRevision,p_status:'delivered'});
  await denied(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:terminal.order_id,p_expected_revision:rows('select revision::text from fb_order_private.orders where id='+literal(terminal.order_id)),p_reason_code:'operational'},'22023');
  await x.cfg(t,'settings',{fan_out:true});await x.cfg(t,'route',{sector_id:t.kitchen.id,destination_id:kitchen.destination.id,copy_number:2});const copies=await x.order(t);await x.materialize(t);await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:copies.order_id,p_expected_revision:1,p_reason_code:'operational'});await x.materialize(t);const copyNotices=x.jobs(t).filter(j=>j.order_id===copies.order_id&&j.kind==='cancellation');check(copyNotices.length===2&&new Set(copyNotices.map(j=>j.copy_number)).size===2&&new Set(copyNotices.map(j=>j.original_job_id)).size===2,'fan-out copies each get exactly one independent frozen cancellation '+t.name);
  const originalFact=rows("select to_jsonb(f) from fb_print_private.registration_facts f where order_id="+literal(fast.order_id)+" and kind='order' limit 1");
  let immutable=false;try{labSql('update fb_print_private.registration_facts set snapshot=\'{}\'::jsonb where source_event_id='+literal(originalFact.source_event_id));}catch{immutable=true;}check(immutable,'outbox immutable under direct update '+t.name);
  const before=rows('select count(*)::text from fb_order_private.orders');
  labSql("create function fb_print_private.hotfix_rollback_fixture() returns trigger language plpgsql as $$begin raise exception 'isolated_rollback';end$$;create trigger hotfix_rollback_fixture before insert on fb_print_private.registration_facts for each row execute function fb_print_private.hotfix_rollback_fixture();");
  let rolledBack=false;try{await x.order(t);}catch{rolledBack=true;}finally{labSql('drop trigger hotfix_rollback_fixture on fb_print_private.registration_facts;drop function fb_print_private.hotfix_rollback_fixture();');}
  check(rolledBack&&rows('select count(*)::text from fb_order_private.orders')===before,'outbox failure rolls back order confirmation atomically '+t.name);
 }
 const reception={label:'Reception',description:'+55 81 3333-4444',url:null};const specific={label:'Room Service',description:null,url:'tel:+558133335555'};
 check(cancellationContact({specific,departments:[reception]}).href==='tel:+558133335555','published linked service preferred');
 check(cancellationContact({specific:null,departments:[reception]}).href==='tel:+558133334444','published reception fallback');
 check(cancellationContact({specific:null,departments:[{...reception,label:'Emergency'}]})===null,'no arbitrary department fallback');
 check(cancellationContact({specific:{...specific,url:'tel:33335555'},departments:[]})===null,'no inferred international number');
 for(const language of ['pt','en','es']){const t=orderCopy(language);check(!!t.cancelContactIntro&&!!t.cancelContactCall&&!!t.cancelContactConfirmation&&/CONTACT|CONTATO/.test(t.cancelContactMissing),'localized contact-only tracking '+language);}
 const report={suite:'registration-cancellation',passed:checks.length,failed:0,hotels:6,physicalPrinting:false,remoteWrites:0,checks};writeFileSync(x.s.dir+'/registration-cancellation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:undefined}));
}catch(e){writeFileSync(x.s.dir+'/registration-cancellation-failure.json',JSON.stringify({passed:checks.length,message:e.message,checks},null,2));console.error(e.message);process.exitCode=1;}
