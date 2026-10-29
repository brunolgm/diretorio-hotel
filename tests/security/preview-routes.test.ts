import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import type {DomainContext} from '../../lib/domain-context';
import type {PublicHotel,PublicHotelSection} from '../../lib/public-hotel-data';
const routes=await import('../../lib/public-routes.ts');
const {publicEditorialHref}=await import('../../lib/public-editorial-link.ts');
test('canonical public area routes exist for slug and subdomain; lifecycle loaders remain public',()=>{
 for(const file of ['app/hotel/[slug]/explorar/[area]/page.tsx','app/explorar/[area]/page.tsx','app/hotel/[slug]/explorar/voos/page.tsx','app/explorar/voos/page.tsx','app/hotel/[slug]/servicos/[id]/page.tsx','app/servicos/[id]/page.tsx'])assert.ok(existsSync(file),file);
});
test('scope preserves public URLs and provides private home, areas, service, flights and tourism detail in every language',()=>{
 for(const language of ['pt','en','es'] as const)for(const preview of [false,true])for(const subdomain of [false,true]){
  const domainContext={kind:subdomain?'product-subdomain':'product-root',subdomain:'own',isPotentialHotelSubdomain:subdomain,navigationScope:preview?'authenticated-preview':undefined} as DomainContext;
  const route={slug:'own',language,domainContext,preferSubdomainRoot:subdomain},q=language==='pt'?'':`?lang=${language}`;
  const base=preview?'/preview':subdomain?'':'/hotel/own';
  assert.equal(routes.buildPublicHotelHref(route),(base||'/')+q);
  for(const area of routes.PUBLIC_HOTEL_AREA_KEYS)assert.equal(routes.buildPublicHotelAreaHref({...route,area}),base+'/explorar/'+area+q);
  assert.equal(routes.buildPublicHotelServiceHref({...route,serviceId:'published'}),base+'/servicos/published'+q);
  assert.equal(routes.buildPublicHotelFlightCenterHref(route),base+'/explorar/voos'+q);
  assert.equal(routes.buildPublicHotelTourismItemHref({...route,itemSlug:'place'}),base+'/explorar/turismo/place'+q);
 }
});
test('editorial own-hotel links preserve preview, locale and published membership; external booking remains external',()=>{
 const input={hotel:{id:'own',slug:'own',subdomain:'own'} as PublicHotel,sections:[{id:'published',hotel_id:'own',enabled:true}] as PublicHotelSection[],language:'es' as const,domainContext:{productRootDomain:'libguest.digital',navigationScope:'authenticated-preview'} as DomainContext,preferSubdomainRoot:false};
 for(const url of ['https://own.libguest.digital/servicos/published','https://libguest.digital/hotel/old-alias/servicos/published'])assert.equal(publicEditorialHref({...input,url}),'/preview/servicos/published?lang=es');
 assert.equal(publicEditorialHref({...input,url:'https://booking.example.test/real'}),'https://booking.example.test/real');
 assert.equal(publicEditorialHref({...input,url:'javascript:alert(1)'}),null);
 for(const id of ['hidden','foreign','missing'])assert.equal(publicEditorialHref({...input,url:'https://own.libguest.digital/servicos/'+id}),null);
});
