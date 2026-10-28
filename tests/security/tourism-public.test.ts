import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadPublicTourism, translateTourismItem, tourismFilter, tourismHttpsUrl, tourismPhone, type PublicTourismItem } from '../../lib/tourism/public.ts';
import type { PublicHotel } from '../../lib/public-hotel-data.ts';
import { getTourismTranslationStatus } from '../../lib/tourism/translations.ts';

const hotel = { id: 'hotel-a', slug: 'hotel-a' } as PublicHotel;
const item = { id:'item-a',hotel_id:hotel.id,slug:'shared-slug',is_published:true,name:'Museu',type:'PLACE',category_key:'sights',short_description:'Descrição PT',full_description:'Texto PT',opening_hours:null,price_info:null,duration_info:null,sort_order:0,address:'Endereço PT',main_image_path:null } as PublicTourismItem;
function client(options: { enabled?: boolean; gateError?: boolean; items?: PublicTourismItem[]; translated?: boolean; translationError?: boolean; queryError?: boolean } = {}) {
  const calls: Array<[string, unknown]> = [];
  const api = { rpc: async (_name: string, args: object) => { calls.push(['gate',args]); return { data: options.enabled !== false, error: options.gateError ? Error('gate') : null }; }, from: (table: string) => {
    calls.push(['table',table]);
    const query = { select: () => query,eq: (key:string,value:unknown) => { calls.push([key,value]); return query; }, in: (key:string,value:unknown) => { calls.push([key,value]); return query; },order:(key:string)=>{calls.push(['order',key]);return query;},
      then: (resolve:(v:unknown)=>unknown) => resolve(table === 'hotel_tourism_items' ? { data: options.items || [item], error: options.queryError ? Error('query') : null } : { data: options.translated ? [{item_id:item.id,name:'Museum',short_description:null,full_description:'',address:'FORGED'}] : [], error: options.translationError ? Error('translations') : null }) };
    return query;
  } };
  return { api: api as unknown as Parameters<typeof loadPublicTourism>[0], calls };
}
test('public tourism is opt-in and does not query content when disabled', async () => {const c=client({enabled:false});assert.equal(await loadPublicTourism(c.api,hotel,'en'),null);assert.equal(c.calls.filter(([k])=>k==='table').length,0);});
test('gate and source errors are not presented as an empty catalog', async () => {for(const opts of [{gateError:true},{queryError:true}])await assert.rejects(loadPublicTourism(client(opts).api,hotel,'pt'));});
test('public catalog uses current hotel, published-only, stable editorial order', async () => {
  const c=client({items:[item,{...item,id:'foreign',hotel_id:'hotel-b'},{...item,id:'draft',is_published:false}]});const result=await loadPublicTourism(c.api,hotel,'pt');assert.deepEqual(result?.items,[item]);
  assert.ok(c.calls.some(([k,v])=>k==='hotel_id'&&v===hotel.id));assert.ok(c.calls.some(([k,v])=>k==='is_published'&&v===true));assert.deepEqual(c.calls.filter(([k])=>k==='order').map(([,v])=>v),['sort_order','id']);
});
test('detail slug is scoped to the resolved hotel and never accepts another item', async () => {const c=client();assert.equal((await loadPublicTourism(c.api,hotel,'pt','other-slug'))?.items.length,0);assert.ok(c.calls.some(([k,v])=>k==='slug'&&v==='other-slug'));});
test('English and Spanish fall back per field without translating address or metadata', async () => {
  for(const lang of ['en','es'] as const){const c=client({translated:true});const result=await loadPublicTourism(c.api,hotel,lang);assert.equal(result?.items[0].name,'Museum');assert.equal(result?.items[0].short_description,item.short_description);assert.equal(result?.items[0].full_description,item.full_description);assert.equal(result?.items[0].address,item.address);assert.ok(c.calls.some(([k,v])=>k==='language'&&v===lang));}
  assert.equal(translateTourismItem(item,null).name,item.name);
});
test('missing translations and translation read failure safely retain PT', async () => {for(const opts of [{},{translationError:true}])assert.equal((await loadPublicTourism(client(opts).api,hotel,'en'))?.items[0].name,item.name);});
test('filters are limited to all and the three canonical types',()=>{for(const value of ['PLACE','EXPERIENCE','GASTRONOMY'])assert.equal(tourismFilter(value),value);for(const value of ['all','unknown',null,['PLACE']])assert.equal(tourismFilter(value),null);});
test('external actions accept HTTPS without credentials and international phone only',()=>{assert.equal(tourismHttpsUrl('https://example.test/map'),'https://example.test/map');for(const v of ['http://example.test','javascript:alert(1)','https://user:pass@example.test','/relative'])assert.equal(tourismHttpsUrl(v),null);assert.equal(tourismPhone('+5511999999999'),'+5511999999999');assert.equal(tourismPhone('+55 11'),null);});
test('tourism completeness preserves missing/partial/complete and optional NULL semantics',()=>{const source={name:'Nome',short_description:'Texto',full_description:null,opening_hours:null,price_info:null,duration_info:null};assert.equal(getTourismTranslationStatus(source,null),'missing');assert.equal(getTourismTranslationStatus(source,{name:'Name'}),'partial');assert.equal(getTourismTranslationStatus(source,{name:'Name',short_description:'Text'}),'complete');});
test('public read has no Google, privileged writes, search, ratings or dock entry',()=>{const source=readFileSync('lib/tourism/public.ts','utf8');assert.doesNotMatch(source,/translateTourismFields|syncTourismTranslations|createAdminClient|fetch\(|\.insert\(|\.update\(|\.delete\(/);const component=readFileSync('components/public/public-tourism-content.tsx','utf8');assert.doesNotMatch(component,/search|rating|review|distance|MobileNavigation|BottomDock/);assert.match(component,/noopener noreferrer/);const routes=readFileSync('lib/public-routes.ts','utf8');assert.match(routes,/buildPublicHotelTourismItemHref/);});
