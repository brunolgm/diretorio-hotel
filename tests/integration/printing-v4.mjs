// Requires an owned empty Docker LAB with all migrations. Never performs Windows I/O.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {seedC1,rpc,rows,literal,labSql} from './fb-c1-fixture.mjs';
import {verifyV4Browser} from './printing-v4-browser.mjs';
const checks=[],check=(ok,name)=>{assert.ok(ok,name);checks.push(name);};
try{
 const x=await seedC1();
 for(const t of x.tenants){
  await x.grant(t,t.admin,'printing.configure');await x.grant(t,t.admin,'printing.test');
  const command=(operation,body,key=randomUUID())=>rpc(t.admin,'execute_current_hotel_fb_commissioning',{p_operation:operation,p_body:body,p_key:key});
  const get=()=>rpc(t.admin,'get_current_hotel_fb_commissioning');
  const sectorKey=randomUUID(),sectorBody={name:'Setor V4 sintético'};
  const sector=await command('sector',sectorBody,sectorKey),replaySector=await command('sector',sectorBody,sectorKey);
  check(sector.id===replaySector.id,'Sector replay uses canonical existing order configuration '+t.slug);
  const forbidden=await t.reader.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'sector',p_body:{name:'Não autorizado'},p_key:randomUUID()});check(forbidden.error?.code==='42501','No automatic configure grant '+t.slug);
  const device=await x.cfg(t,'device',{name:'V4 discovery',active:true}),credential=await x.pair(t,device,'fixture-1.3.2');
  await rpc(x.server,'heartbeat_fb_print_device',x.auth(credential,{p_software_version:'fixture-1.3.2',p_observed_state:'online'}));
  await rpc(x.server,'report_fb_print_queues',x.auth(credential,{p_queues:[{name:'V4 queue',driver:'V4 driver',state:'unknown'}]}));
  const queue=(await get()).queues.find(q=>q.device_id===device.id),destination=await x.cfg(t,'destination',{name:'V4 destination',device_id:device.id,active:true});
  const printer=await command('select_queue',{printer_id:null,revision:0,name:'V4 printer',device_id:device.id,destination_id:destination.id,queue_key:queue.queue_key,queue_revision:queue.revision});
  const route=await x.cfg(t,'route',{sector_id:t.kitchen.id,destination_id:destination.id,active:true});
  t.v4={credential,destination,printer};
  const testBody={p_kind:'test',p_destination_id:destination.id,p_sector_id:t.kitchen.id,p_original_job_id:null,p_reason_code:null,p_key:randomUUID()};
  const test=await rpc(t.admin,'create_current_hotel_fb_print_job',testBody),replayed=await rpc(t.admin,'create_current_hotel_fb_print_job',testBody);
  check(test.job_id===replayed.job_id,'Same test intent is replayed before pending gate '+t.slug);
  const duplicate=await t.admin.client.rpc('create_current_hotel_fb_print_job',{...testBody,p_key:randomUUID()});check(duplicate.error?.code==='PT409','Pending job prevents another test key '+t.slug);
  let job=await x.claim(credential);job={...job,...await x.receipt(credential,job)};job={...job,...await x.dispatch(credential,job)};await x.result(credential,job);
  let c=await get();const visible=c.tests.find(t=>t.job_id===test.job_id);check(visible.printer_id===printer.id&&visible.printer_revision===printer.revision&&visible.state==='submitted','Read exposes exact job context without payload '+t.slug);
  check(!JSON.stringify(visible).includes('snapshot'),'Commissioning test metadata has no payload '+t.slug);
  const laterDenied=await t.admin.client.rpc('create_current_hotel_fb_print_job',{...testBody,p_key:randomUUID()});check(laterDenied.error?.code==='PT409','Spooler alone does not permit another test '+t.slug);
  await command('verify_test',{job_id:test.job_id});check((await get()).human_verifications.some(v=>v.job_id===test.job_id),'Explicit verify_test remains authoritative '+t.slug);
  await x.activate(t,true);
  const settings=rows('select to_jsonb(s) from fb_print_private.settings s where hotel_id='+literal(t.id));
  const orderBefore=rows('select to_jsonb(s) from fb_order_private.hotel_settings s where hotel_id='+literal(t.id));
  const endKey=randomUUID(),endBody={revision:settings.revision};const ended=await command('end_override',endBody,endKey);await command('end_override',endBody,endKey);
  const settingsAfter=rows('select to_jsonb(s) from fb_print_private.settings s where hotel_id='+literal(t.id));
  check(settingsAfter.enabled===settings.enabled&&settingsAfter.revision===settings.revision+1,'End override is independent and replayed once '+t.slug);
  check(!settingsAfter.technical_override_until&&!settingsAfter.technical_override_reason,'Override fields are cleared '+t.slug);
  check(JSON.stringify(orderBefore)===JSON.stringify(rows('select to_jsonb(s) from fb_order_private.hotel_settings s where hotel_id='+literal(t.id))),'Ordering row byte-equivalent after maintenance end '+t.slug);
  const stale=await t.admin.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'end_override',p_body:endBody,p_key:randomUUID()});check(stale.error?.code==='PT409','Override end enforces CAS '+t.slug);
  const foreign=x.tenants.find(o=>o.id!==t.id);const cross=await foreign.admin.client.rpc('execute_current_hotel_fb_commissioning',{p_operation:'verify_test',p_body:{job_id:test.job_id},p_key:randomUUID()});check(Boolean(cross.error),'Cross tenant job verification denied '+t.slug);
  const review={printer_id:printer.id,printer_revision:printer.revision,job_id:test.job_id,route_id:route.id,route_revision:route.revision,settings_revision:ended.revision,device_revision:rows('select revision from fb_print_private.devices where hotel_id='+literal(t.id)+' and id='+literal(device.id)),destination_revision:destination.revision};
  {check(settingsAfter.enabled,'Printing remains enabled after maintenance ends '+t.slug);const key=randomUUID();await command('complete_deployment',review,key);await command('complete_deployment',review,key);check((await get()).completed_reviews.filter(r=>r.job_id===test.job_id).length===1,'Explicit completion is audited and idempotent '+t.slug);}
  labSql('update public.hotel_room_links set is_active=false where hotel_id='+literal(t.id));
  c=await get();check(c.guest_readiness.outlets.filter(o=>o.room_delivery&&!o.pickup).every(o=>!o.room_access),'Exclusive delivery without room links is diagnosed '+t.slug);
  check(c.guest_readiness.journey_verified===false,'Never claims a guest journey was homologated '+t.slug);
 }
 if(process.env.FB_V4_BROWSER==='1')await verifyV4Browser(x,check);
 writeFileSync(join(x.s.dir,'printing-v4-report.json'),JSON.stringify({passed:checks.length,failed:0,checks},null,2));console.log(JSON.stringify({passed:checks.length,failed:0}));
}catch(error){console.error(error);process.exitCode=1;}
