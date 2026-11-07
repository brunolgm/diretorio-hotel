import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fbFixture} from '../fixtures/fb.ts';
import type {NativeOffer} from '../../lib/fb/orders/journey';
import type {DomainContext} from '../../lib/domain-context';
const {roomServiceAccess}=await import('../../lib/fb/room-service-access.ts');
const domain={kind:'product-subdomain',subdomain:'synthetic',isPotentialHotelSubdomain:true,productRootDomain:'libguest.digital'} as DomainContext;
test('Room Service uses eligible typed outlet, UUID and canonical routes in all six presentations',()=>{
 for(let index=0;index<6;index++)for(const language of ['pt','en','es'] as const){
  const data=fbFixture(index,language),outlet=data.fb!.outlets[1];outlet.name='Nome editorial diferente';
  const access=roomServiceAccess(data,language,domain,false);
  assert.ok(access?.href.endsWith('#outlet-'+outlet.id));assert.equal(access?.label,'Room Service');
  data.fb=null;assert.equal(roomServiceAccess(data,language,domain,false),null);
 }
});
test('Room Service CTA follows native offer availability and actual fulfilment context',()=>{
 const data=fbFixture(4),outlet=data.fb!.outlets[1];
 const native={id:outlet.id,name:outlet.name,description:null,available:true,hidden:false,pickup:false,room_delivery:true,menus:[],products:[{id:'fixture-product',kind:'item',menu_id:'fixture-menu',category_id:null,name:'Produto',amount_minor:100,currency:'BRL',available:true,groups:[]}]};
 data.ordering={has_room_context:false,outlets:[native]} as NativeOffer;
 assert.equal(roomServiceAccess(data,'pt',domain,false)?.cta,'Consultar cardápio');
 data.ordering.has_room_context=true;assert.equal(roomServiceAccess(data,'pt',domain,false)?.cta,'Fazer pedido');
 native.available=false;assert.equal(roomServiceAccess(data,'pt',domain,false)?.cta,'Consultar cardápio');
 native.available=true;native.pickup=true;data.ordering.has_room_context=false;assert.equal(roomServiceAccess(data,'en',domain,false)?.cta,'Place an order');
 native.hidden=true;assert.equal(roomServiceAccess(data,'pt',domain,false),null);
});
test('Room Service rejects unpublished, foreign, empty, V3 and disabled composition',()=>{
 for(const mutate of [
  (d:ReturnType<typeof fbFixture>)=>{d.fb!.outlets[1].is_published=false;},
  (d:ReturnType<typeof fbFixture>)=>{d.fb!.outlets[1].hotel_id='foreign';},
  (d:ReturnType<typeof fbFixture>)=>{d.fb!.items=[];},
  (d:ReturnType<typeof fbFixture>)=>{d.presentation!.experienceVersion='v3';},
  (d:ReturnType<typeof fbFixture>)=>{d.layout=[];},
  (d:ReturnType<typeof fbFixture>)=>{d.fb!.outlets[1].action_type='external_url';d.fb!.outlets[1].external_url='https://example.invalid/menu';}
 ]){const data=fbFixture(4);mutate(data);assert.equal(roomServiceAccess(data,'pt',domain,false),null);}
});
test('both public Home entries load canonical offer and the rendering boundary forwards it',()=>{
 for(const file of ['app/page.tsx','app/hotel/[slug]/page.tsx']){const source=readFileSync(file,'utf8');assert.match(source,/roomServiceHomeOffer\(pageData,language\)/);assert.match(source,/ordering=\{ordering\}/);}
 const source=readFileSync('components/public/hotel-public-page-content.tsx','utf8');assert.match(source,/pageData=\{\{ ordering, fb/);
});
