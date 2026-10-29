import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {PublicTourismItem} from '../../lib/tourism/public';
import type {PublicPresentation} from '../../lib/public-presentation';
import type {DomainContext} from '../../lib/domain-context';
const {tourismEditorialHref,tourismCollection,tourismHasUsefulDetails}=await import('../../lib/tourism/editorial.ts');
const {parsePublicPresentation,emptyPresentation}=await import('../../lib/public-presentation.ts');
const {hasTranslationFallback}=await import('../../lib/translation-fallback.ts');
const {publicLanguageHref}=await import('../../lib/public-language-href.ts');
const {publishedContactPhones}=await import('../../lib/contact-phones.ts');
const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-tourism-v4-20261029.json','utf8'));
const cards=manifest.destinations.map((destination:unknown,i:number)=>({title:{pt:'Topic '+i,en:'Topic '+i,es:'Topic '+i},image_path:null,destination})) as PublicPresentation['tourism']['cards'];
const presentation={...emptyPresentation(),tourism:{...emptyPresentation().tourism,cards}};
const items=manifest.entries.map((e:typeof manifest.entries[number],i:number)=>({id:'item'+i,hotel_id:'own',slug:e.key,...e.values})) as PublicTourismItem[];
test('editorial parser keeps old configs and rejects malformed, duplicate and arbitrary destinations',()=>{
 assert.ok(parsePublicPresentation(emptyPresentation(),'own'));assert.ok(parsePublicPresentation(presentation,'own'));
 for(const destination of [null,{kind:'url',url:'https://example.test'},{kind:'item',slug:'../other'},{kind:'collection',key:'empty',item_slugs:[],description:{pt:'x',en:'x',es:'x'}}])assert.equal(parsePublicPresentation({...presentation,tourism:{...presentation.tourism,cards:[{...cards[0],destination}]}},'own'),null);
 assert.equal(parsePublicPresentation({...presentation,tourism:{...presentation.tourism,cards:[cards[1],cards[1]]}},'own'),null);
});
test('each editorial destination resolves only own published content; Praia is never Praca',()=>{
 for(const language of ['pt','en','es'] as const){const route={slug:'own',language,domainContext:{navigationScope:'authenticated-preview'} as DomainContext,preferSubdomainRoot:false};
  const href=tourismEditorialHref(cards[0],items,'own',route)!;assert.ok(href.includes('/preview/explorar/turismo/praia-de-boa-viagem'));assert.ok(!href.includes('praca-de-boa-viagem'));
  for(const card of cards.slice(1)){assert.ok(card.destination?.kind==='collection');const key=card.destination.key;const selected=tourismCollection(presentation,key,[...items,{...items[0],hotel_id:'foreign',slug:'foreign'},{...items[1],is_published:false}], 'own',language);assert.ok(selected.items.length>0);assert.ok(selected.items.every(i=>i.hotel_id==='own'&&i.is_published));assert.ok(!selected.items.some(i=>i.slug==='shopping-recife'||i.slug==='praca-de-boa-viagem'));assert.ok(tourismEditorialHref(card,items,'own',route)?.includes('collection='+key));}
  assert.equal(tourismEditorialHref(cards[0],[],'own',route),null);assert.equal(tourismEditorialHref(cards[1],items,'foreign',route),null);
 }
 assert.deepEqual(tourismCollection(presentation,'unknown',items,'own','pt').items,[]);
});
test('details require added information and never rely on repetition or an illustration',()=>{
 const item={name:'Place',short_description:'Same paragraph',full_description:'Same paragraph',main_image_path:null} as PublicTourismItem;
 assert.equal(tourismHasUsefulDetails(item),false);assert.equal(tourismHasUsefulDetails({...item,full_description:'Additional verified context'}),true);assert.equal(tourismHasUsefulDetails({...item,official_website_url:'https://example.test/official'}),true);
});
test('translation warning ignores absent optional source but keeps genuine missing fields',()=>{
 assert.equal(hasTranslationFallback({title:'Name',content:'Content',cta:null,category:null},{title:'Name EN',content:'Content EN'},['title','content','cta','category']),false);
 assert.equal(hasTranslationFallback({title:'Name',content:'Content'},{title:'Name EN',content:''},['title','content']),true);
 const source=readFileSync('app/preview/[...path]/page.tsx','utf8');assert.match(source,/serviceFallbackIds\?\.includes\(section.id\)/);
 assert.doesNotMatch(readFileSync('components/public/hotel-service-detail-content.tsx','utf8'),/internalPageRule|MIN_SERVICE_DETAIL_CONTENT_LENGTH/);
});
test('language selection keeps collection/category, fragment and private context',()=>{
 const href=publicLanguageHref('/preview/explorar/turismo?collection=culture&category=sights#results','es');assert.equal(href,'/preview/explorar/turismo?collection=culture&category=sights&lang=es#results');
});
test('contact links use explicit international numbers, normalize formats and never infer WhatsApp',()=>{
 assert.deepEqual(publishedContactPhones('Call +55 (81) 3256-7700 or +1 212 555 0123').map(p=>p.href),['tel:+558132567700','tel:+12125550123']);
 assert.deepEqual(publishedContactPhones('81 3256-7700; extension *1'),[]);
 assert.deepEqual(publishedContactPhones('+55 81 3256-7700','tel:+558132567700'),[]);
});
