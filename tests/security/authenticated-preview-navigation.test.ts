import {state} from './preview-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {default:destination}=await import('../../app/preview/[...path]/page.tsx');
function reset(){state.user=true;state.role='administrador';state.active=true;state.status='suspended';state.queries=[];
 state.modules=['core.directory','experience.preview','content.services','content.tourism','travel.flights'];
 state.tables={hotel_sections:[{id:'published',hotel_id:'own',enabled:true,content:'Published service description. '.repeat(5),service_action_type:'standard',url:null},{id:'hidden',hotel_id:'own',enabled:false},{id:'foreign',hotel_id:'other',enabled:true}],hotel_tourism_items:[{id:'t1',hotel_id:'own',slug:'place',is_published:true}],hotel_flight_settings:[{hotel_id:'own',home_card_enabled:true}],hotel_airports:[{hotel_id:'own',airport_id:'a1',is_active:true}],airports:[{id:'a1',is_active:true,iata_code:'REC',name:'Synthetic airport',timezone:'America/Recife'}]};
}
async function visit(path:string[],lang='pt'){return destination({params:Promise.resolve({path}),searchParams:Promise.resolve({lang})});}
test('anonymous, viewer, editor, inactive and archived sessions cannot enter internal preview',async()=>{
 for(const scenario of ['anon','visualizador','editor','inactive','archived']){reset();if(scenario==='anon')state.user=false;else if(scenario==='inactive')state.active=false;else if(scenario==='archived')state.status='archived';else state.role=scenario;
  await assert.rejects(()=>visit(['explorar','servicos']),/REDIRECT:/);
 }
});
test('own suspended administrator can navigate services, contact, information, menu, tourism and flights',async()=>{
 for(const status of ['suspended','active'])for(const lang of ['pt','en','es'])for(const path of [['explorar','servicos'],['explorar','contato'],['explorar','informacoes'],['explorar','cardapio'],['explorar','turismo'],['explorar','turismo','place'],['explorar','voos'],['servicos','published']]){
  reset();state.status=status;const result=await visit(path,lang);assert.equal(result.props.domainContext.navigationScope,'authenticated-preview');assert.equal(result.props.language,lang);
  assert.equal((result.props.pageData??result.props.data??result.props).hotel.id,'own');
 }
});
test('disabled preview/core/flights entitlements are denied before exposing the destination',async()=>{
 for(const moduleKey of ['core.directory','experience.preview','travel.flights']){reset();state.modules=state.modules.filter(m=>m!==moduleKey);await assert.rejects(()=>visit(['explorar','voos']),/REDIRECT:/);}
});
test('unpublished/foreign/missing services and unknown paths are rejected; request cannot select another hotel',async()=>{
 for(const path of [['servicos','hidden'],['servicos','foreign'],['servicos','missing'],['hotel','other'],['explorar','invalid'],['explorar','contato','other']]){reset();await assert.rejects(()=>visit(path),/NOT_FOUND/);}
 reset();state.modules=state.modules.filter(m=>m!=='content.services');await assert.rejects(()=>visit(['servicos','published']),/NOT_FOUND/);
});
test('empty tourism is a real empty catalog; absent tourism detail/flight configuration is unavailable',async()=>{
 reset();state.tables.hotel_tourism_items=[];const catalog=await visit(['explorar','turismo']);assert.equal(catalog.props.data.items.length,0);await assert.rejects(()=>visit(['explorar','turismo','place']),/NOT_FOUND/);
 reset();state.tables.hotel_airports=[];await assert.rejects(()=>visit(['explorar','voos']),/NOT_FOUND/);
});
test('preview is read-only, no room resolution or external providers, and analytics skips every private path',()=>{
 const route=readFileSync('app/preview/[...path]/page.tsx','utf8'),flight=readFileSync('lib/authenticated-flight-preview.ts','utf8');
 assert.doesNotMatch(route+flight,/\.insert\(|\.update\(|\.delete\(|fetch\(|createAdminClient|resolveRoomRestaurantMenuUrl|readRoomContext/);
 assert.ok(route.indexOf('getAuthenticatedHotelPreviewData(language)')<route.indexOf("if(path[0]"));
 assert.match(readFileSync('components/public/public-analytics.tsx','utf8'),/pathname.startsWith\('\/preview\/'\)/);
 assert.match(readFileSync('components/public/hotel-public-flight-center.tsx','utf8'),/navigationScope === 'authenticated-preview' && tab === 'meu-voo'/);
});
