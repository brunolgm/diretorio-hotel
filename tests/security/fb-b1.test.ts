import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {ORDER_RETENTION,ORDER_CAPABILITIES,foundationFailure} from '../../lib/fb/orders/contracts.ts';
const {opaqueOrderSecret,orderSecretDigest,deriveOrderAccessSecret,validOrderSecret,orderSessionCookie,orderAccessCookie}=await import('../../lib/fb/orders/credentials.server.ts');
const {fbOrderFoundation}=await import('../../lib/fb/orders/boundary.server.ts');

test('B1 secrets have 256 random bits and only digest crosses session creation',async()=>{
 const secret=opaqueOrderSecret();assert.equal(Buffer.from(secret,'base64url').length,32);assert.equal(validOrderSecret(secret),true);
 assert.equal(orderSecretDigest(secret).length,64);assert.notEqual(secret,orderSecretDigest(secret));
 let calls=0;
 const boundary=fbOrderFoundation({rpc:async(name,args)=>{calls++;assert.equal(name,'begin_fb_order_session');assert.match(String(args.p_secret_digest),/^[a-f0-9]{64}$/);assert.equal('p_secret' in args,false);return {data:{id:randomUUID(),expires_at:'2026-11-04T00:00:00Z'},error:null};}});
 const result=await boundary.beginSession('fixture-hotel');assert.equal(result.ok,true);assert.equal(calls,1);
});
test('B1 HKDF is reproducible for lost-response retry and separated by context',()=>{
 const secret=opaqueOrderSecret(),outlet=randomUUID(),key=randomUUID();
 const access=deriveOrderAccessSecret(secret,'hotel-a',outlet,key);
 assert.equal(access,deriveOrderAccessSecret(secret,'hotel-a',outlet,key));assert.equal(validOrderSecret(access),true);
 for(const other of [deriveOrderAccessSecret(secret,'hotel-b',outlet,key),deriveOrderAccessSecret(secret,'hotel-a',randomUUID(),key),deriveOrderAccessSecret(secret,'hotel-a',outlet,randomUUID()),deriveOrderAccessSecret(opaqueOrderSecret(),'hotel-a',outlet,key)])
  assert.notEqual(access,other);
});
test('B1 credential parser rejects malformed, oversized and noncanonical secrets',()=>{
 for(const value of [null,undefined,'',randomBytes(8).toString('base64url'),'a'.repeat(44),'a'.repeat(42)+'!','../secret',{}]){
  assert.equal(validOrderSecret(value),false);assert.throws(()=>orderSecretDigest(value as string));
 }
 assert.throws(()=>deriveOrderAccessSecret(opaqueOrderSecret(),'../../hotel',randomUUID(),randomUUID()));
});
test('B1 cookies are server-only and scoped, without URL credentials',()=>{
 const secret=opaqueOrderSecret(),expires=new Date('2026-11-04T00:00:00Z'),id=randomUUID();
 const session=orderSessionCookie('hotel-a',secret,expires),order=orderAccessCookie(id,secret,expires);
 for(const cookie of [session,order]){assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'lax');assert.equal(cookie.path.includes(secret),false);}
 assert.equal(session.path,'/api/fb/hotel/hotel-a');assert.equal(order.path,'/api/fb/orders/'+id);
 assert.throws(()=>orderAccessCookie('incremental-1',secret,expires));assert.throws(()=>orderSessionCookie('hotel-a',secret,new Date('invalid')));
});
test('B1 approved retention and capabilities do not introduce financial or printed state',()=>{
 assert.deepEqual(ORDER_RETENTION,{piiDays:7,factsDays:180,accessTerminalHours:24,accessMaxDays:7,idempotencyHours:24});
 assert.deepEqual(ORDER_CAPABILITIES,['orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read','orders.configure']);
});
test('B1 errors expose code classification only, never provider details or PII',async()=>{
 const marker='Guest Name Room-123 secret-body';
 for(const [code,status]of [['PT409',409],['PT410',410],['PT429',429],['42501',403],['P0002',403],['22023',400],['23503',400],['XX000',503]] as const){
  const result=foundationFailure(code);assert.equal(result.status,status);assert.equal(JSON.stringify(result).includes(marker),false);
  const boundary=fbOrderFoundation({rpc:async()=>({data:null,error:{code,message:marker,details:marker}})});
  const actual=await boundary.status('hotel-a',opaqueOrderSecret());assert.equal(actual.ok,false);assert.equal(JSON.stringify(actual).includes(marker),false);
 }
});
test('B1 unavailable transport fails closed without logging request contents',async()=>{
 const boundary=fbOrderFoundation({rpc:async()=>{throw Error('PII and credentials must not escape');}});
 assert.deepEqual(await boundary.beginSession('hotel-a'),{ok:false,error:'unavailable',status:503});
});
test('B1 boundary rejects invalid context and payload limits before RPC',async()=>{
 let calls=0;const boundary=fbOrderFoundation({rpc:async()=>{calls++;return {data:null,error:null};}});
 for(const [slug,session,outlet,intent]of [
  ['../hotel',opaqueOrderSecret(),randomUUID(),{}],['hotel-a','weak',randomUUID(),{}],
  ['hotel-a',opaqueOrderSecret(),'not-an-id',{}],['hotel-a',opaqueOrderSecret(),'',{}],
  ['hotel-a',opaqueOrderSecret(),randomUUID(),{note:'x'.repeat(32769)}]
 ] as [string,string,string,unknown][]){assert.equal((await boundary.quote(slug,session,outlet,intent)).ok,false);}
 const cycle:Record<string,unknown>={};cycle.self=cycle;assert.equal((await boundary.quote('hotel-a',opaqueOrderSecret(),randomUUID(),cycle)).ok,false);
 assert.equal(calls,0);
});
test('B1 confirmation derives server credential and forwards only the RPC contract',async()=>{
 const secret=opaqueOrderSecret(),key=randomUUID(),outlet=randomUUID();
 const boundary=fbOrderFoundation({rpc:async(name,args)=>{
  assert.equal(name,'confirm_fb_order');assert.equal(args.p_access_digest,orderSecretDigest(deriveOrderAccessSecret(secret,'hotel-a',outlet,key)));
  assert.equal('accessSecret' in args,false);
  return {data:{order_id:randomUUID(),status:'registered',revision:1,total_minor:100,currency:'BRL',access_expires_at:'2026-11-10T00:00:00Z',replayed:false},error:null};
 }});
 const result=await boundary.confirm({slug:'hotel-a',session:secret,key,outlet,intent:{},roomToken:null,expectedTotalMinor:100,expectedCurrency:'BRL'});
 assert.equal(result.ok,true);if(result.ok)assert.equal(result.data.accessSecret,deriveOrderAccessSecret(secret,'hotel-a',outlet,key));
});
