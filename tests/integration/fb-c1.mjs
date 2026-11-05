import '../../scripts/bootstrap-runtime.mjs';
import assert from'node:assert/strict';import{randomUUID,createHash}from'node:crypto';import{mkdirSync,writeFileSync,readFileSync}from'node:fs';import{join}from'node:path';
import{seedC1,rpc,rows,literal,labSql}from'./fb-c1-fixture.mjs';
const checks=[],check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
let x;const expectedError=async(actor,name,args,code='42501')=>{const r=await actor.client.rpc(name,args);check(r.error?.code===code,name+' denies '+code+' (actual '+(r.error?.code||'success')+')');return r;};
try{
 check(rows('select count(*)::text from fb_print_private.settings')===0,'migration creates no enabled hotel or settings');
 check(rows('select count(*)::text from fb_print_private.grants')===0,'migration creates no printing grants');
 x=await seedC1();const {tenants,server,cfg,grant,order,accept,activate,pair,auth,claim,receipt,dispatch,result,jobs,materialize}=x;const dir=join(x.s.dir,'c1');mkdirSync(dir,{recursive:true});
 const sql=labSql(readFileSync('supabase/tests/53_c1_print_cloud_matrix.sql','utf8'));writeFileSync(join(dir,'53_c1_print_cloud_matrix.sql.log'),sql);const sqlResult=JSON.parse(sql.split('\n').find(l=>l.includes('"suite"')));check(sqlResult.failed===0,'actual C1 SQL metadata/ACL/RLS '+sqlResult.passed);console.log(JSON.stringify(sqlResult));

 for(const t of tenants){
  for(const actor of [t.admin,t.operator,t.viewer,t.reader,x.platform])await expectedError(actor,'get_current_hotel_fb_print_config',{});
  for(const cap of ['printing.configure','printing.test','printing.reprint'])await grant(t,t.admin,cap);
  t.printSettings=await cfg(t,'settings',{ticket_minutes:15});check(!t.printSettings.enabled&&!t.printSettings.allow_name,'settings disabled and name OFF '+t.name);
  const historical=await order(t);await accept(t,historical.groups[0]);
  t.printDevices={};t.printDest={};t.printRoute={};
  for(const [label,sector]of [['kitchen',t.kitchen],['bar',t.bar]]){
   const device=await cfg(t,'device',{name:'C1 '+label+' fixture'});t.printDevices[label]=await pair(t,device);
   const dest=await cfg(t,'destination',{name:'C1 '+label+' destination',device_id:device.id});t.printDest[label]=dest;
   await cfg(t,'printer',{name:'C1 '+label+' logical printer',device_id:device.id,destination_id:dest.id,adapter:'windows_spooler',config:{queue_name:'Fixture-'+label}});
   t.printRoute[label]=await cfg(t,'route',{sector_id:sector.id,destination_id:dest.id});
  }
  const active=await activate(t,true);check(active.enabled&&!!active.activation_id,'explicit activation has a baseline '+t.name);await materialize(t);check(jobs(t).length===0,'historical accepted group does not materialize '+t.name);
  const made=await order(t,x.combo(t));t.c1Order=made;check(made.groups.length===2,'real B combo splits into two sectors '+t.name);
  await accept(t,made.groups.find(g=>g.sector_id===t.kitchen.id));
  await Promise.all(Array.from({length:50},()=>materialize(t)));check(jobs(t).length===2,'50 reconciliations yield one job per registered sector '+t.name);
  check(rows('select to_jsonb(status) from fb_order_private.orders where id='+literal(made.order_id))==='registered','group prints before aggregate accepted '+t.name);
  await accept(t,made.groups.find(g=>g.sector_id===t.bar.id));await materialize(t);const all=jobs(t);check(all.length===2,'one job per registered group/destination '+t.name);
  const kitchen=all.find(j=>j.sector_id===t.kitchen.id),bar=all.find(j=>j.sector_id===t.bar.id);t.c1Jobs={kitchen,bar};
  check(kitchen.snapshot.lines.length===1&&kitchen.snapshot.lines[0].quantity===2&&kitchen.snapshot.lines[0].name===t.custom.name,'kitchen receives only its expanded combo component '+t.name);
  check(bar.snapshot.lines.length===1&&bar.snapshot.lines[0].quantity===4&&bar.snapshot.lines[0].name===t.drink.name,'bar receives only its expanded quantity without re-multiplication '+t.name);
  check(kitchen.snapshot.lines[0].combo_context===t.combo.name&&!JSON.stringify(kitchen.snapshot).includes(t.drink.name),'combo parent context never contains other sector lines '+t.name);
  check(kitchen.snapshot.order_id===made.order_id&&kitchen.snapshot.group_id===kitchen.group_id&&kitchen.snapshot.sector_id===t.kitchen.id,'immutable payload explicitly identifies its order/group/sector '+t.name);
  check(!/Homologação|C1PrivateLineNote|first_name|room_label|accessSecret/.test(JSON.stringify(all)),'commercial jobs contain no guest identity or observations '+t.name);
  const claims=await Promise.all(Array.from({length:50},()=>claim(t.printDevices.kitchen)));const winners=claims.filter(j=>j.job_id);check(winners.length===1&&winners[0].job_id===kitchen.id,'50 claims have one owner and fence '+t.name);let j=winners[0];
  check(createHash('sha256').update(j.snapshot_canonical,'utf8').digest('hex')===j.snapshot_hash&&JSON.stringify(JSON.parse(j.snapshot_canonical))===JSON.stringify(j.snapshot),'canonical UTF-8 bytes match payload hash without renderer JSON reserialization '+t.name);
  await expectedError(server,'authorize_fb_print_dispatch',auth(t.printDevices.kitchen,{p_job_id:j.job_id,p_fence:j.fence,p_expected_revision:j.revision,p_snapshot_hash:j.snapshot_hash}),'PT410');
  const receipts=await Promise.all(Array.from({length:20},()=>receipt(t.printDevices.kitchen,j)));check(new Set(receipts.map(r=>r.revision)).size===1,'concurrent receipt ACK has one effect '+t.name);j=receipts[0];
  await expectedError(server,'authorize_fb_print_dispatch',auth(t.printDevices.kitchen,{p_job_id:j.job_id,p_fence:j.fence,p_expected_revision:j.revision,p_snapshot_hash:'0'.repeat(64)}),'PT409');
  j=await dispatch(t.printDevices.kitchen,j);check(j.state==='dispatching'&&j.private.room_label==='F-01'&&!j.private.first_name,'dispatch projects only permitted live PII '+t.name);check(j.private.line_notes.length===1&&j.private.line_notes[0].note==='C1PrivateLineNote','private combo parent note reaches only relevant group '+t.name);
  check(!JSON.stringify(rows("select jsonb_agg(to_jsonb(e)) from fb_print_private.events e where hotel_id="+literal(t.id))).includes('C1PrivateLineNote'),'machine trail never copies ticket content '+t.name);
  const key=randomUUID();const outcomes=await Promise.all(Array.from({length:20},()=>result(t.printDevices.kitchen,j,'submitted',{p_key:key})));check(new Set(outcomes.map(o=>o.revision)).size===1&&outcomes.every(o=>o.state==='submitted'),'concurrent result ACK has one logical effect '+t.name);
  check(rows("select count(*)::text from fb_print_private.events where job_id="+literal(j.job_id)+" and action='submitted'")===1,'one submission event '+t.name);
  check(rows('select to_jsonb(status) from fb_order_private.order_groups where id='+literal(kitchen.group_id))==='accepted','printing never changes B status '+t.name);
  t.printSubmitted=outcomes[0];
  const requests=await Promise.all(Array.from({length:2},()=>rpc(t.admin,'create_current_hotel_fb_print_job',{p_kind:'reprint',p_destination_id:kitchen.destination_id,p_sector_id:null,p_original_job_id:kitchen.id,p_reason_code:'operational',p_key:key})));check(requests[0].job_id===requests[1].job_id&&requests[0].duplicate_risk,'concurrent same-intent reprint creates one separate marked job '+t.name);
  check(jobs(t).find(r=>r.id===requests[0].job_id).snapshot.label==='REIMPRESSÃO','reprint is explicitly labelled '+t.name);
  const test=await rpc(t.admin,'create_current_hotel_fb_print_job',{p_kind:'test',p_destination_id:t.printDest.bar.id,p_sector_id:t.bar.id,p_original_job_id:null,p_reason_code:null,p_key:randomUUID()});check(jobs(t).find(r=>r.id===test.job_id).order_id===null,'test job creates no fake order '+t.name);
  for(const actor of [t.operator,t.viewer,t.reader,x.platform])await expectedError(actor,'create_current_hotel_fb_print_job',{p_kind:'test',p_destination_id:t.printDest.bar.id,p_sector_id:t.bar.id,p_original_job_id:null,p_reason_code:null,p_key:randomUUID()});
  console.log('C1 transactional materialization/claim/receipt/dispatch/result: '+t.name);
 }
 const{verifyC1Adversarial}=await import('./fb-c1-adversarial.mjs');await verifyC1Adversarial({...x,check,expectedError});
 const{verifyC1Concurrency}=await import('./fb-c1-concurrency.mjs');await verifyC1Concurrency({...x,check,expectedError});
 const{verifyC1Temporal}=await import('./fb-c1-temporal.mjs');await verifyC1Temporal({...x,check,expectedError});
 if(!process.argv.includes('--rpc-only')){const{verifyC1Http}=await import('./fb-c1-http.mjs');await verifyC1Http({...x,check});}
 const report={suite:'fb-c1',mode:process.argv.includes('--rpc-only')?'rpc-only':'full',passed:checks.length,failed:0,identities:6,externalRequests:0,physicalPrinting:false,checks};writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:undefined,directory:dir}));
}catch(e){const error=typeof e.status==='number'?'owned_sql_fixture_failure: '+(e.message.match(/constraint "([a-z0-9_]+)"/i)?.[1]||'subprocess'):e.message;if(x)writeFileSync(join(x.s.dir,'c1-failure.json'),JSON.stringify({passed:checks.length,error,checks},null,2));console.error(error+'\n'+String(e.stack).split('\n').filter(l=>/^\s+at /.test(l)).join('\n'));process.exitCode=1;}
