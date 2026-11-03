import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {MODULE_CATALOG,BASELINE_MODULE_KEYS} from '../../lib/modules/catalog.ts';
import {FB_CURRENCIES,fbCurrencyDigits} from '../../lib/fb/currencies.ts';
import {readFbRows} from '../../lib/fb/pagination.ts';
import {FB_IDENTITIES,fbFixture} from '../fixtures/fb.ts';
import {fbAdminHref} from '../../lib/fb/admin.ts';
const {eligibleFbGraph,fbOutletDestination,fbPrice}=await import('../../lib/fb/public.ts');
import {normalizeFbPatch,safeFbUrl,fbFormPatch,parseFbPrice,fbPriceInput} from '../../lib/fb/validation.ts';
import {fbTranslationFields,fbTranslationStatus,syncFbTranslations} from '../../lib/fb/translations.ts';
import {isOwnedFbImagePath,fbImageUrl,cleanupFbImage} from '../../lib/fb/media.ts';
const {getUniversalMobileHome}=await import('../../lib/public-experience-v4.ts');
import {associateTourismImage} from '../../lib/tourism/image.ts';
import type {DomainContext} from '../../lib/domain-context';
const domain={productRootDomain:'libguest.digital',kind:'product-subdomain'} as DomainContext;

test('administrative reads exhaust capped Data API pages instead of truncating at 1000',async()=>{
 const source=Array.from({length:1005},(_,id)=>({id:String(id)})),offsets:number[]=[];
 const result=await readFbRows(async(from,to)=>{offsets.push(from);return {data:source.slice(from,Math.min(to+1,from+100)),error:null,count:source.length};},5000,r=>r.id);
 assert.deepEqual(result.data,source);assert.ok(offsets.includes(1000));
});
test('partial pages and changing snapshots never become successful administrative reads',async()=>{
 await assert.rejects(()=>readFbRows(async()=>({data:[],error:null,count:2}),50,r=>String(r)));
 let reads=0;await assert.rejects(()=>readFbRows(async()=>({data:[{id:String(reads)}],error:null,count:++reads===1?3:4}),50,r=>r.id));
 await assert.rejects(()=>readFbRows(async()=>({data:[{id:'same'}],error:null,count:2}),50,r=>r.id));
 await assert.rejects(()=>readFbRows(async()=>({data:null,error:{code:'42501'},count:null}),50,r=>String(r)));
 await assert.rejects(()=>readFbRows(async()=>({data:[],error:null,count:5001}),5000,r=>String(r)));
});

test('controlled currencies match SQL and preserve each currency minor unit',()=>{
 const sql=readFileSync('supabase/migrations/20261102223413_sprint_53_fb_foundation.sql','utf8');
 const codes=sql.match(/currency = any\(array\[([^\]]+)\]/)![1].match(/[A-Z]{3}/g);
 assert.deepEqual(codes,[...FB_CURRENCIES]);
 for(const invalid of ['ZZZ','XXX','brl','BTC','','US','USDD'])assert.throws(()=>normalizeFbPatch('item',{currency:invalid}));
 assert.equal(fbCurrencyDigits('JPY'),0);assert.equal(parseFbPrice('2590','JPY'),2590);
 assert.throws(()=>parseFbPrice('25,90','JPY'));assert.equal(fbPriceInput(2590,'JPY'),'2590');
 assert.equal(parseFbPrice('25,901','KWD'),25901);assert.equal(fbPriceInput(25901,'KWD'),'25,901');
 assert.match(fbPrice({price_amount_minor:2590,currency:'JPY',price_on_request:false},'en')!,/2,590/);
 assert.equal(fbPrice({price_amount_minor:1,currency:'ZZZ',price_on_request:false},'en'),null);
 assert.doesNotMatch(readFileSync('components/admin/fb-editor.tsx','utf8'),/Preço em centavos/);
});

test('editor money round-trips every supported currency without changing minor units',()=>{
 for(const currency of FB_CURRENCIES)for(const amount of [0,1,99,100,100000000]){
  const input=fbPriceInput(amount,currency);
  assert.equal(parseFbPrice(input,currency),amount,currency+' '+amount);
 }
});
test('admin feedback preserves kind identity and parent without double query separator',()=>{const href=fbAdminHref('item',{success:'Conteúdo salvo.'},'entity','category');const u=new URL(href,'https://example.invalid');assert.equal(u.searchParams.get('kind'),'item');assert.equal(u.searchParams.get('id'),'entity');assert.equal(u.searchParams.get('parent'),'category');assert.equal(u.searchParams.get('success'),'Conteúdo salvo.');assert.equal((href.match(/\?/g)||[]).length,1);});
test('native dining respects the existing Home composition',()=>{const data=fbFixture(0);data.layout.find(b=>b.blockKey==='services')!.isEnabled=false;assert.equal(getUniversalMobileHome(data,'pt',domain,true).actions.some(a=>a.key==='dining'),false);});
test('editor prices accept decimal amounts and persist exact minor units',()=>{for(const [value,minor] of [['25,90',2590],['25.90',2590],['0,01',1],['0',0],['12',1200],['1000000,00',100000000]] as const)assert.equal(parseFbPrice(value),minor);for(const value of ['1e3','1.234,56','-1','0.001','1000001,00'])assert.throws(()=>parseFbPrice(value));assert.equal(fbPriceInput(2590),'25,90');const form=new FormData();form.set('name','Item');form.set('currency','BRL');form.set('category_id',fbFixture(0).fb!.categories[0].id);form.set('price_amount_minor','25,90');assert.equal(fbFormPatch('item',form).price_amount_minor,2590);});
test('F&B available is opt-in and governance migration has no provisioning',()=>{assert.equal(MODULE_CATALOG.find(m=>m.key==='fb.menu')?.availability,'available');assert.ok(!new Set<string>(BASELINE_MODULE_KEYS).has('fb.menu'));const sql=readFileSync('supabase/migrations/20261102230145_sprint_53_fb_governance_available.sql','utf8');assert.match(sql,/pg_get_functiondef/);assert.match(sql,/active_platform_admin_required/);assert.doesNotMatch(sql,/insert into public\.hotel_module_entitlements|update public\.hotels|create_platform_hotel_onboarding/i);});
test('associated room menu reuses the real resolver with mocked IO for missing invalid foreign and ready context',async()=>{
 const own=fbFixture(0).hotel.id,foreign=fbFixture(1).hotel.id;let enabled=true;let menu:string|null='https://ordering.example.invalid/fixture';
 const token='A'.repeat(24),foreignToken='B'.repeat(24);let reads=0;
 const port={rpc:async(name:string,args:Record<string,unknown>)=>{assert.equal(name,'is_hotel_module_enabled');assert.equal(args.p_module_key,'rooms.qr');return {data:enabled,error:null};},from:(name:string)=>{
  assert.equal(name,'hotel_room_links');const filters:Record<string,unknown>={};
  const query={select:()=>query,eq:(key:string,value:unknown)=>{filters[key]=value;return query;},maybeSingle:async()=>{reads++;const rows=[{hotel_id:own,room_token:token,room_number:'F-01',restaurant_menu_url:menu,is_active:true,'hotels.platform_status':'active'},{hotel_id:foreign,room_token:foreignToken,room_number:'F-02',restaurant_menu_url:'https://ordering.example.invalid/foreign',is_active:true,'hotels.platform_status':'active'}];return {data:rows.find(row=>Object.entries(filters).every(([key,value])=>(row as unknown as Record<string,unknown>)[key]===value))||null,error:null};}};return query;
 }};
 Object.assign(globalThis,{__fbRoomMock:port});
 const hook=registerHooks({resolve(specifier,context,next){if(specifier==='@/lib/supabase/admin')return {url:'data:text/javascript,export function createAdminClient(){return globalThis.__fbRoomMock}',shortCircuit:true};return next(specifier,context);}});
 try{
  const {resolveRoomRestaurantMenuUrl:resolve}=await import('../../lib/room-links.ts');
  assert.equal((await resolve({hotelId:own,roomToken:''})).kind,'invalid');assert.equal(reads,0);
  assert.equal((await resolve({hotelId:own,roomToken:'bad'})).kind,'invalid');
  assert.equal((await resolve({hotelId:own,roomToken:foreignToken})).kind,'invalid');
  assert.equal((await resolve({hotelId:own,roomToken:'C'.repeat(24)})).kind,'invalid');
  menu=null;assert.equal((await resolve({hotelId:own,roomToken:token})).kind,'missing-menu');
  menu='https://ordering.example.invalid/fixture';assert.equal((await resolve({hotelId:own,roomToken:token})).kind,'ready');
  enabled=false;assert.equal((await resolve({hotelId:own,roomToken:token})).kind,'invalid');
  assert.doesNotMatch(JSON.stringify(fbFixture(0).fb),/room_token|roomToken|restaurant_menu_url|ordering\.example/);
 }finally{hook.deregister();Reflect.deleteProperty(globalThis,'__fbRoomMock');}
});
for(let index=0;index<FB_IDENTITIES.length;index++)for(const language of ['pt','en','es'] as const){
 const title=FB_IDENTITIES[index].name+' '+language;
 test(title+' native graph and shared menu',()=>{const d=fbFixture(index,language),g=eligibleFbGraph(d.fb,d.hotel.id)!;assert.equal(g.outlets.length,2);assert.equal(g.menus.length,1);assert.equal(g.outlet_menus.length,2);assert.equal(g.items.length,1);assert.notEqual(d.hotel.id,fbFixture((index+1)%6).hotel.id);});
 test(title+' preserves service and external destination',()=>{const d=fbFixture(index,language),g=d.fb!;const before=JSON.stringify(d.sections);assert.match(fbOutletDestination(g.outlets[0],g,d.hotel,d.sections,language,domain,true)!.href,/servicos/);const room=fbOutletDestination(g.outlets[1],g,d.hotel,d.sections,language,domain,true);assert.equal(room?.href,d.sections[1].url);assert.equal(JSON.stringify(d.sections),before);d.sections[1].service_action_type='room_restaurant_menu';assert.match(fbOutletDestination(g.outlets[1],g,d.hotel,d.sections,language,domain,true)!.href,/servicos/);});
 test(title+' Home module on empty and off retain distinct contracts',()=>{const d=fbFixture(index,language);assert.match(getUniversalMobileHome(d,language,domain,true).actions.find(a=>a.key==='dining')!.href,/explorar\/cardapio/);d.fb!.outlets=[];assert.equal(getUniversalMobileHome(d,language,domain,true).actions.some(a=>a.key==='dining'),false);d.fb=null;d.sections[1].service_action_type='room_restaurant_menu';assert.match(getUniversalMobileHome(d,language,domain,false).actions.find(a=>a.key==='dining')!.href,/hotel\/.*\/explorar\/cardapio/);});
 test(title+' tenant and ancestor filters',()=>{const d=fbFixture(index,language),foreign=fbFixture((index+1)%6).fb!;const g=d.fb!;for(const key of ['outlets','menus','categories','items','outlet_menus','service_links'] as const)(g[key] as object[]).push(...foreign[key]);const safe=eligibleFbGraph(g,d.hotel.id)!;assert.ok(Object.values(safe).flat().every(r=>r.hotel_id===d.hotel.id));g.menus[0].is_published=false;assert.equal(eligibleFbGraph(g,d.hotel.id)!.items.length,0);});
}
test('F&B validation protects immutable and sensitive fields',()=>{for(const key of ['hotel_id','id','revision','source_revision','main_image_path','roomToken','guest_name','restaurant_menu_url'])assert.throws(()=>normalizeFbPatch('outlet',{[key]:'bad'}));for(const url of ['javascript:alert(1)','http://example.invalid','https://user:pass@example.invalid','https://example.invalid/\nx','https://example.invalid\\x'])assert.equal(safeFbUrl(url),false);assert.equal(safeFbUrl('https://hotel-bugan.goomer.app/menu'),true);});
test('prices flags and controlled types',()=>{for(const value of [-1,1.5,NaN,100000001])assert.throws(()=>normalizeFbPatch('item',{price_amount_minor:value}));assert.throws(()=>normalizeFbPatch('outlet',{type:'bistro'}));assert.throws(()=>normalizeFbPatch('item',{price_on_request:true,price_amount_minor:1}));assert.equal(fbPrice({price_amount_minor:0,currency:'BRL',price_on_request:false},'pt'),'R$\u00a00,00');for(const language of ['pt','en','es'] as const)assert.ok(fbPrice({price_amount_minor:null,currency:'BRL',price_on_request:true},language));assert.equal(fbPrice({price_amount_minor:null,currency:'BRL',price_on_request:false},'en'),null);});
test('form clears irrelevant destination and on-request numeric input explicitly',()=>{const form=new FormData();form.set('name','Example');form.set('type','restaurant');form.set('action_type','none');form.set('service_id','junk');form.set('external_url','junk');const patch=fbFormPatch('outlet',form);assert.equal(patch.service_id,null);assert.equal(patch.external_url,null);});
test('translation allowlist completeness and source revision',()=>{const row=fbFixture(0).fb!.outlets[0];const fields=fbTranslationFields('outlet',{...row,url:'secret',roomToken:'secret'});assert.equal(fields.url,undefined);assert.equal(fields.roomToken,undefined);const translation={hotel_id:row.hotel_id,entity_id:row.id,language:'en',source_revision:1,fields:{name:'Restaurant'}};assert.equal(fbTranslationStatus('outlet',row,translation),'Parcial');assert.equal(fbTranslationStatus('outlet',row,{...translation,source_revision:0}),'Ausente');assert.equal(fbTranslationStatus('outlet',row,{...translation,fields:fbTranslationFields('outlet',row)}),'Completo');});
test('translation EN failure does not prevent ES, stale is never success',async()=>{const row=fbFixture(0).fb!.outlets[0];const saves:string[]=[];const result=await syncFbTranslations('outlet',row,{languagesEnabled:async()=>true,translate:async(f,l)=>{if(l==='en')throw Error('offline');return f;},save:async(l)=>{saves.push(l);return false;}});assert.deepEqual(result,{en:'failed',es:'stale'});assert.deepEqual(saves,['es']);});
test('languages off never calls translation provider',async()=>{const row=fbFixture(0).fb!.outlets[0];const result=await syncFbTranslations('outlet',row,{languagesEnabled:async()=>false,translate:async()=>{throw Error('must not call');},save:async()=>{throw Error('must not save');}});assert.deepEqual(result,{en:'skipped',es:'skipped'});});
test('F&B image ownership and ambiguous association preserve uploads',async()=>{const row=fbFixture(0).fb!.outlets[0];const path=row.hotel_id+'/fb/outlet/'+row.id+'/53300000-0000-4000-8000-000000000001.png';assert.equal(isOwnedFbImagePath(path,row.hotel_id,'outlet',row.id),true);assert.equal(isOwnedFbImagePath(path,fbFixture(1).hotel.id,'outlet',row.id),false);assert.equal(isOwnedFbImagePath(path,row.hotel_id,'item',row.id),false);assert.equal(fbImageUrl('https://user:pass@example.invalid',path,row.hotel_id,'outlet',row.id),null);const removed:string[]=[];const feedback=await associateTourismImage({hotelId:row.hotel_id,itemId:row.id,oldPath:null,newPath:path,revision:'1',ownsPath:(p,h,id)=>isOwnedFbImagePath(p,h,'outlet',id),errorMessage:()=>'',io:{associate:async()=>({data:null,error:null}),read:async()=>null,remove:async p=>{removed.push(p);return {error:null};},log:()=>{}}});assert.ok(feedback.warning);assert.deepEqual(removed,[]);});
test('cleanup is bounded and refuses other owners',async()=>{const row=fbFixture(0).fb!.outlets[0];let calls=0;const io={remove:async()=>{calls++;return {error:'offline'};},log:()=>{}};assert.equal(await cleanupFbImage(io,row.hotel_id,'outlet',row.id,'foreign',null),false);assert.equal(calls,0);const path=row.hotel_id+'/fb/outlet/'+row.id+'/53300000-0000-4000-8000-000000000001.png';assert.equal(await cleanupFbImage(io,row.hotel_id,'outlet',row.id,path,null),false);assert.equal(calls,2);});
test('migration grants RPC-only writes and has no hotel backfill',()=>{const sql=readFileSync('supabase/migrations/20261102223413_sprint_53_fb_foundation.sql','utf8');assert.match(sql,/PT409/);assert.match(sql,/record_admin_audit_event/);assert.match(sql,/foreign key\(hotel_id,menu_id\)/);assert.match(sql,/foreign key\(hotel_id,category_id\)/);assert.doesNotMatch(sql,/insert into public\.hotel_module_entitlements|update public\.hotel_sections|create\s+table\s+[^;]*(?:orders|carts)/i);assert.match(sql,/revoke all on all functions in schema fb_private/);});
