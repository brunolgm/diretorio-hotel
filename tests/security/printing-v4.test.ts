import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {printingV4Fixture,printingId} from '../fixtures/printing-v4.ts';
import {deploymentContext,guestReadiness,readDeploymentDraft,emptyDraft} from '../../lib/fb/printing/deployment.ts';
import {commissioningCommand} from '../../lib/fb/printing/commissioning.ts';
import {PrintBoundaryError} from '../../lib/fb/printing/validation.ts';
const command=(operation:string,body:Record<string,unknown>)=>({operation,body,key:randomUUID(),confirmed:true});

test('V4 preserves historical paper without validating the later job or readiness',()=>{
 const {snapshot:s,data:c}=printingV4Fixture();const x=deploymentContext(s,c,printingId(4));
 assert.equal(x.historical.length,1);assert.equal(x.test?.job_id,printingId(31));assert.equal(x.paper,false);assert.equal(x.ready,false);assert.equal(x.completed,false);
});
test('V4 Spooler states, receipt and dispatch are never physical proof',()=>{
 for(const state of ['queued','leased','dispatching','submitted','ambiguous','blocked','retry_wait','expired','cancelled']){
  const {snapshot:s,data:c}=printingV4Fixture();c.tests[0].state=state;assert.equal(deploymentContext(s,c,printingId(4)).paper,false,state);
 }
});
test('V4 binds proof to exact job, printer and revision and does not mutate history',()=>{
 const {snapshot:s,data:c}=printingV4Fixture('verified');const before=JSON.stringify(c.human_verifications);
 assert.equal(deploymentContext(s,c,printingId(4)).ready,true);
 for(const mutation of ['job','printer','revision']){
  const copy=structuredClone(c);const proof=copy.human_verifications[1];
  if(mutation==='job')proof.job_id=printingId(99);if(mutation==='printer')proof.printer_id=printingId(99);if(mutation==='revision')proof.printer_revision++;
  assert.equal(deploymentContext(s,copy,printingId(4)).paper,false,mutation);
 }
 assert.equal(JSON.stringify(c.human_verifications),before);
});
test('V4 conclusion requires explicit review and all configuration revisions',()=>{
 const {snapshot:s,data:c}=printingV4Fixture('verified');const x=deploymentContext(s,c,printingId(4));
 assert.equal(x.ready,true);assert.equal(x.completed,false);
 c.completed_reviews!.push({...x.reviewBody,completed_at:new Date().toISOString()} as NonNullable<typeof c.completed_reviews>[number]);
 assert.equal(deploymentContext(s,c,printingId(4)).completed,true);
 for(const group of ['settings','printers','routes','devices','destinations'] as const){const copy=structuredClone(s);copy.config[group]![0].revision++;assert.equal(deploymentContext(copy,c,printingId(4)).completed,false,group);}
 const newer=structuredClone(c);newer.tests.unshift({...newer.tests[0],job_id:printingId(90),created_at:'2099-01-01T00:00:00Z'});assert.equal(deploymentContext(s,newer,printingId(4)).completed,false);
});
test('V4 printer, destination, route and heartbeat must refer to the selected infrastructure',()=>{
 const {snapshot:s,data:c}=printingV4Fixture('verified');
 for(const group of ['devices','printers','destinations','routes'] as const){const copy=structuredClone(s);copy.config[group]![0].active=false;assert.equal(deploymentContext(copy,c,printingId(4)).ready,false,group);}
 const other=deploymentContext(s,c,printingId(90));assert.equal(other.paper,false);assert.equal(other.ready,false);
 s.config.devices![0].protocol_version=2;assert.equal(deploymentContext(s,c,printingId(4)).online,false);
});
test('V4 queue disappearance, changed driver/fingerprint and stale observation block readiness',()=>{
 for(const mutation of ['absent','driver','stale','offline']){
  const {snapshot:s,data:c}=printingV4Fixture('verified');const q=c.queues[0];
  if(mutation==='absent')q.present=false;if(mutation==='driver')q.fingerprint='e'.repeat(64);if(mutation==='stale')q.observed_at='2000-01-01T00:00:00Z';if(mutation==='offline')q.observation='offline';
  assert.equal(deploymentContext(s,c,printingId(4)).queueReady,false,mutation);
 }
});
test('V4 reports exclusive room delivery without room access as an explicit journey pending item',()=>{
 const {data:c}=printingV4Fixture();let x=guestReadiness(c);assert.equal(x.configured,true);assert.equal(x.channel,false);assert.ok(x.pending.some(p=>p.includes('sem QR ativo')));
 c.guest_readiness!.outlets[0].pickup=true;x=guestReadiness(c);assert.equal(x.channel,true);assert.equal(c.guest_readiness!.journey_verified,false);
 c.guest_readiness!.outlets[0].open_now=false;assert.equal(guestReadiness(c).channel,false);
});
test('V4 does not infer diagnostic success on missing data or unavailable products',()=>{
 assert.equal(guestReadiness(null).channel,false);const {data:c}=printingV4Fixture();c.guest_readiness!.outlets[0].room_access=true;c.guest_readiness!.outlets[0].products_available=false;
 assert.ok(guestReadiness(c).pending.some(p=>p.includes('produtos')));c.guest_readiness!.ordering=false;assert.equal(guestReadiness(c).configured,false);
});
test('V4 closed command boundary accepts only minimal additive commands',()=>{
 assert.doesNotThrow(()=>commissioningCommand(command('sector',{name:'Cozinha'})));assert.doesNotThrow(()=>commissioningCommand(command('end_override',{revision:4})));
 for(const body of [{revision:4,enabled:false},{revision:'4'},{revision:-1},{revision:4,hotel_id:randomUUID()},{revision:4,ordering:false}])assert.throws(()=>commissioningCommand(command('end_override',body)),PrintBoundaryError);
 for(const name of ['', ' ', '<x>', 'x'.repeat(121), 'a\n'])assert.throws(()=>commissioningCommand(command('sector',{name})),PrintBoundaryError);
});
test('V4 conclusion rejects missing context, scope injection and invalid revisions',()=>{
 const {snapshot:s,data:c}=printingV4Fixture('verified');const body=deploymentContext(s,c,printingId(4)).reviewBody;
 assert.doesNotThrow(()=>commissioningCommand(command('complete_deployment',body)));
 for(const field of Object.keys(body)){const copy={...body};delete copy[field as keyof typeof copy];assert.throws(()=>commissioningCommand(command('complete_deployment',copy)),PrintBoundaryError);}
 for(const value of [-1,0.5,'2',null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>commissioningCommand(command('complete_deployment',{...body,printer_revision:value})),PrintBoundaryError);
 assert.throws(()=>commissioningCommand(command('complete_deployment',{...body,printer_id:null})),PrintBoundaryError);
 assert.throws(()=>commissioningCommand(command('complete_deployment',{...body,hotel_id:randomUUID()})),PrintBoundaryError);
});
test('V4 resumable draft is versioned and excludes credentials from its intended surface',()=>{
 const d=emptyDraft();assert.deepEqual(readDeploymentDraft(JSON.stringify(d)),d);
 assert.equal(readDeploymentDraft(JSON.stringify({...d,one_time_secret:'never-persist'})),null);
 assert.equal(readDeploymentDraft(JSON.stringify({...d,progress:{printer:{id:printingId(4),revision:'2'}}})),null);
 for(const raw of [null,'invalid','{}','{"version":2,"step":1}',JSON.stringify({...d,step:9}),JSON.stringify({...d,name:17})])assert.equal(readDeploymentDraft(raw),null);
});
test('V4 additive SQL retains tenant authorization, CAS, replay and private review ACL',()=>{
 const sql=readFileSync('supabase/migrations/20261111003611_printing_premium_v4_universal.sql','utf8');
 assert.ok(sql.includes("fb_print_private.actor()"));assert.ok(sql.includes("require_cap(h,'orders.supervise')"));assert.ok(sql.includes("require_cap(h,'orders.configure')"));
 assert.ok(sql.includes('force row level security'));assert.ok(sql.includes("'commission_'||p_operation,p_key,b"));assert.ok(sql.includes('printing_revision_conflict'));
 const end=sql.slice(sql.indexOf("elsif p_operation='end_override' then"),sql.indexOf(' else\n  if (b-array'));
 assert.ok(end.includes('technical_override_until=null'));assert.ok(!end.includes('activate_raw'));assert.ok(!end.includes('hotel_settings set'));assert.ok(!end.includes('enabled='));
 assert.ok(sql.includes("j.state in('queued','leased','dispatching','retry_wait','ambiguous')"));
});
