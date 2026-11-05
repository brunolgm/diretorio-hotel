// C1 commissioning contracts in the owned disposable LAB. No Windows I/O.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {seedC1,rpc} from './fb-c1-fixture.mjs';
const checks=[],check=(value,label)=>{assert.ok(value,label);checks.push(label);};let x;
try{
 x=await seedC1();
 for(const t of x.tenants){
  await x.grant(t,t.admin,'printing.configure');await x.grant(t,t.admin,'printing.test');
  const get=()=>rpc(t.admin,'get_current_hotel_fb_commissioning');
  const command=(operation,body,key=randomUUID())=>rpc(t.admin,'execute_current_hotel_fb_commissioning',{p_operation:operation,p_body:body,p_key:key});
  let pre=await get();check(!pre.ready&&pre.blockers>0,'missing operational setup blocks normal preflight '+t.slug);
  const denied=await t.viewer.client.rpc('get_current_hotel_fb_commissioning');check(denied.error?.code==='42501','viewer cannot read technical catalog '+t.slug);
  let deniedActivation=await t.admin.client.rpc('activate_current_hotel_fb_printing',{p_enabled:true,p_expected_revision:1});check(deniedActivation.error?.code==='PT409','explicit historical LAB override does not satisfy normal activation '+t.slug);
  const device=await x.cfg(t,'device',{name:'Discovery fixture',active:true});const credential=await x.pair(t,device,'fixture-1.3.0');
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(credential,{p_software_version:'fixture-1.3.0',p_observed_state:'online'}));
  const report=queues=>rpc(x.server,'report_fb_print_queues',x.auth(credential,{p_queues:queues}));
  const initial=[{name:'Synthetic queue',driver:'Driver fixture v1',state:'unknown'}];
  const first=await report(initial);check(first.physical_ready===null,'queue report never claims physical readiness '+t.slug);
  let q=(await get()).queues[0];check(q.present&&q.driver_name==='Driver fixture v1'&&q.queue_key.length===64,'catalog contains only bounded technical metadata '+t.slug);
  await report(initial);check((await get()).queues[0].revision===q.revision,'heartbeat discovery preserves semantic revision '+t.slug);
  const dest=await x.cfg(t,'destination',{name:'Destination fixture',device_id:device.id,active:true});
  const selection={printer_id:null,revision:0,name:'Printer fixture',device_id:device.id,destination_id:dest.id,queue_key:q.queue_key,queue_revision:q.revision};
  const key=randomUUID(),printer=await command('select_queue',selection,key),replay=await command('select_queue',selection,key);check(replay.id===printer.id&&replay.revision===printer.revision,'same selection intent replay has one effect '+t.slug);
  for(const sector of [t.kitchen,t.bar])await x.cfg(t,'route',{sector_id:sector.id,destination_id:dest.id,active:true});
  pre=await get();check(pre.checks.filter(c=>c.code==='queue').every(c=>c.status==='PASS'),'each native sector has current bound queue '+t.slug);
  check(pre.checks.some(c=>c.code==='test'&&c.status==='BLOCKER'),'missing test remains blocker after discovery '+t.slug);
  const test=await rpc(t.admin,'create_current_hotel_fb_print_job',{p_kind:'test',p_destination_id:dest.id,p_sector_id:t.kitchen.id,p_original_job_id:null,p_reason_code:null,p_key:randomUUID()});
  const notSubmitted=await t.admin.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'verify_test',p_body:{job_id:test.job_id},p_key:randomUUID()});check(Boolean(notSubmitted.error),'human verification cannot precede submitted technical test '+t.slug);
  let job=await x.claim(credential);check(job.job_id===test.job_id,'commissioning test claims while printing remains disabled '+t.slug);job={...job,...await x.receipt(credential,job)};job={...job,...await x.dispatch(credential,job)};await x.result(credential,job);
  pre=await get();check(pre.ready&&pre.warnings>0&&pre.human_verifications.length===0,'submitted test clears blockers but preserves human warning '+t.slug);
  await report([]);pre=await get();check(pre.queues[0].present===false&&!pre.ready,'missing queue is retained as absent and blocks activation '+t.slug);
  await report([{...initial[0],driver:'Driver fixture v2'}]);pre=await get();check(!pre.ready&&pre.queues[0].revision>q.revision,'driver change invalidates selection without changing configured printer '+t.slug);
  const stale=await t.admin.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'select_queue',p_body:{...selection,printer_id:printer.id,revision:printer.revision},p_key:randomUUID()});check(stale.error?.code==='PT409','stale catalog selection cannot bind changed driver '+t.slug);
  q=pre.queues[0];await command('select_queue',{...selection,printer_id:printer.id,revision:printer.revision,queue_revision:q.revision});pre=await get();check(pre.checks.some(c=>c.code==='test'&&c.status==='BLOCKER'),'rebound printer revision requires a new test '+t.slug);
  for(const queues of [[{...initial[0],hotel_id:t.id}],Array.from({length:65},(_,i)=>({...initial[0],name:'Queue '+i})),[initial[0],initial[0]],[{...initial[0],name:'\\\\server\\queue'}]]){
   const invalid=await x.server.client.rpc('report_fb_print_queues',x.auth(credential,{p_queues:queues}));check(Boolean(invalid.error),'invalid discovery cannot mutate technical catalog '+t.slug);
  }
  const current=await get();check(current.queues.length===1&&current.queues[0].driver_name==='Driver fixture v2','invalid reports preserve last catalog '+t.slug);
  await command('mode',{mode:'catalog_only',revision:current.order_revision});
  for(const language of ['pt','en','es']){const offer=await rpc(x.server,'get_fb_order_offer',{p_hotel_slug:t.slug,p_language:language});check(offer.outlets.length===0,'catalog-only omits native cart projection '+language+' '+t.slug);}
  const refreshKey=randomUUID();const refresh=await command('refresh',{device_id:device.id},refreshKey);const heartbeat=await rpc(x.server,'heartbeat_fb_print_device',x.auth(credential,{p_software_version:'fixture-1.3.0',p_observed_state:'online'}));check(Boolean(refresh)&&heartbeat.discovery_requested===true,'Admin refresh reaches authenticated device heartbeat '+t.slug);
  const foreign=x.tenants.find(other=>other.id!==t.id);const foreignRefresh=await foreign.admin.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'refresh',p_body:{device_id:device.id},p_key:randomUUID()});check(Boolean(foreignRefresh.error),'other tenant cannot request own device discovery '+t.slug);
 }
 const report={suite:'fb-commissioning',passed:checks.length,failed:0,checks};writeFileSync(join(x.s.dir,'commissioning-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({suite:report.suite,passed:report.passed,failed:0}));
}catch(error){console.error(error);process.exitCode=1;}
