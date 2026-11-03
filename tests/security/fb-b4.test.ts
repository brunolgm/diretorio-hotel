import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {fbOrderDiagnostic}=await import('../../lib/fb/orders/diagnostics.server.ts');
const {maintenanceJob}=await import('../../scripts/fb-order-maintenance.mjs');
test('F&B diagnostics accept only minimal technical metadata',()=>{
 const previous=console.info;const lines:string[]=[];console.info=(value:unknown)=>{lines.push(String(value));};
 try{const id=fbOrderDiagnostic('validation_rejected','Private identity, room token and observations');assert.match(id,/^[0-9a-f-]{36}$/);const entry=JSON.parse(lines[0]);assert.deepEqual(Object.keys(entry).sort(),['code','diagnostic_id','scope']);assert.ok(!lines[0].includes('Private'));fbOrderDiagnostic('order_created','53000000-0000-4000-8000-000000000001');assert.equal(JSON.parse(lines[1]).order_id,'53000000-0000-4000-8000-000000000001');}finally{console.info=previous;}
});
test('F&B maintenance refuses insecure or credential-bearing targets before transport',async()=>{
 let calls=0;const transport=async()=>{calls++;return new Response('{}');};
 for(const url of ['http://example.invalid','https://user:secret@example.invalid','https://example.invalid/private','https://example.invalid/?key=private'])await assert.rejects(()=>maintenanceJob({url,key:'opaque',transport}));assert.equal(calls,0);
});
test('maintenance validates bounded batch/pass limits',async()=>{
 for(const [batch,passes]of [[0,1],[1001,1],[100,0],[100,11],[1.5,1]])await assert.rejects(()=>maintenanceJob({url:'http://127.0.0.1:54347',key:'opaque',batch,passes,transport:async()=>{throw Error('must not call');}}));
});
test('maintenance defaults to status and forbids redirects',async()=>{
 let requested='';const result=await maintenanceJob({url:'http://127.0.0.1:54347',key:'opaque',transport:async(url:unknown,init?:RequestInit)=>{requested=String(url);assert.equal(init?.redirect,'error');assert.equal(init?.body,'{}');return Response.json({last_success_at:null,last_run:null});}});assert.ok(requested.endsWith('/get_fb_order_maintenance_status'));assert.equal(result.length,1);
});
test('maintenance discards unexpected provider fields on execution',async()=>{
 const result=await maintenanceJob({url:'http://127.0.0.1:54347',key:'opaque',execute:true,transport:async()=>Response.json({status:'failed',first_name:'private',counts:{pii:2,private:'room secret'},message:'private'})});assert.equal(result[0].code,'maintenance_failed');assert.equal(result[0].counts.pii,2);assert.ok(!JSON.stringify(result).includes('private'));
});
test('maintenance aborts passes on failure and reports no provider text',async()=>{
 let calls=0;const result=await maintenanceJob({url:'http://127.0.0.1:54347',key:'opaque',execute:true,passes:10,transport:async()=>{calls++;return Response.json({status:'failed',counts:{}});}});assert.equal(calls,1);assert.equal(result.length,1);await assert.rejects(()=>maintenanceJob({url:'http://127.0.0.1:54347',key:'opaque',execute:true,transport:async()=>new Response('private provider error',{status:503})}),/maintenance_unavailable/);
});
