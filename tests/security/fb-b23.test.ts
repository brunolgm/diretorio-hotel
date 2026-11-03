import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
const {orderBody,redactedOrderError,privateOrderHeaders,sameOrigin}=await import('../../lib/fb/orders/http-request.ts');
const {orderRpc,OrderBoundaryError}=await import('../../lib/fb/orders/rpc.server.ts');
const {money,orderCopy,publicOrderStatus,orderStates}=await import('../../lib/fb/orders/journey.ts');
const {nextGroupStatus}=await import('../../lib/fb/orders/operations.ts');
const request=(body:string,headers:Record<string,string>={})=>new Request('http://localhost:4317/api/fb/hotel/fixture/quote',{method:'POST',headers:{origin:'http://localhost:4317','content-type':'application/json',...headers},body});
test('B23 HTTP requires same origin and rejects cross-site/missing-origin writes',()=>{
 assert.doesNotThrow(()=>sameOrigin(request('{}')));
 for(const h of [{origin:'https://attacker.invalid'},{origin:''},{'sec-fetch-site':'cross-site'}] as Record<string,string>[])assert.throws(()=>sameOrigin(request('{}',h)),(e:unknown)=>e instanceof OrderBoundaryError&&e.status===403);
});
test('B23 HTTP rejects unrecognized authority fields before a database operation',async()=>{
 for(const key of ['price','total','hotel_id','sector','currency','name','__proto__'])await assert.rejects(orderBody(request('{"'+key+'":1}'),['outlet_id','intent']),(e:unknown)=>e instanceof OrderBoundaryError&&e.status===400);
});
test('B23 HTTP rejects non-object and malformed JSON',async()=>{for(const body of ['[]','null','42','{"bad":'])await assert.rejects(orderBody(request(body),[]));});
test('B23 bounded stream measures UTF-8 bytes, not characters',async()=>{await assert.rejects(orderBody(request(JSON.stringify({note:'á'.repeat(50)})),['note'],60),(e:unknown)=>e instanceof OrderBoundaryError&&e.status===413);assert.deepEqual(await orderBody(request('{"intent":{}}'),['intent']),{intent:{}});});
test('B23 declared oversize and wrong media type fail closed',async()=>{await assert.rejects(orderBody(request('{}',{'content-length':'999999'}),[],1024));await assert.rejects(orderBody(request('{}',{'content-type':'text/plain'}),[]));});
test('B23 provider errors are reduced to stable safe codes',async()=>{
 for(const [code,message,status,expected]of [['PT409','private arbitrary input',409,'review_required'],['PT410','orders_quote_expired',410,'quote_expired'],['PT410','orders_session_expired',410,'session_expired'],['PT409','orders_intent_conflict',409,'retry_conflict'],['PT429','private arbitrary input',429,'rate_limited'],['42501','private arbitrary input',403,'forbidden'],['23514','private arbitrary input',400,'invalid_input'],['XX000','private arbitrary input',503,'unavailable']] as const){
  const client={rpc:async()=>({data:null,error:{code,message,details:'private details'}})} as unknown as SupabaseClient;
  await assert.rejects(orderRpc(client,'fixture'),(e:unknown)=>e instanceof OrderBoundaryError&&e.status===status&&e.message===expected&&!JSON.stringify(e).includes('private'));
 }
});
test('B23 unexpected HTTP errors never return raw server details',()=>{const response=redactedOrderError(new Error('private name, room, cookie'));assert.equal(response.status,503);assert.deepEqual(response.body,{error:'unavailable'});assert.match(privateOrderHeaders['Cache-Control'],/no-store/);assert.equal(privateOrderHeaders['Referrer-Policy'],'no-referrer');});
test('B23 all public states have distinct PT/EN/ES copy without printing or premature acceptance',()=>{for(const lang of ['pt','en','es'] as const){const labels=orderStates.map(s=>publicOrderStatus(s,lang));assert.equal(new Set(labels).size,7);assert.match(orderCopy(lang).received,/LibGuest/);assert.doesNotMatch(labels.join(' '),/printed|impresso|impreso/i);assert.notEqual(publicOrderStatus('registered',lang),publicOrderStatus('accepted',lang));}});
test('B23 currency minor units respect zero, two and three decimal currencies',()=>{assert.match(money(1,'JPY','en'),/1/);assert.match(money(100,'BRL','pt'),/1,00/);assert.match(money(1234,'KWD','en'),/1\.234/);});
test('B23 operations offer only the next B1 state including pickup exception',()=>{assert.equal(nextGroupStatus('registered','pickup'),'accepted');assert.equal(nextGroupStatus('ready','pickup'),'delivered');assert.equal(nextGroupStatus('ready','room_delivery'),'out_for_delivery');assert.equal(nextGroupStatus('out_for_delivery','room_delivery'),'delivered');for(const s of ['delivered','cancelled','printed','unknown'])assert.equal(nextGroupStatus(s,'pickup'),null);});
