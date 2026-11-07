import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fbCatalogCount} from '../../lib/fb/public-copy.ts';
import {premiumReviewGraph,premiumSimulatedOffer,eventCategorySourceId} from '../fixtures/bugan-premium-catalog.mjs';
import {previewId} from '../fixtures/bugan-menu-homologation.mjs';
import type {FbGraph} from '../../lib/fb/types';
import type {NativeOffer} from '../../lib/fb/orders/journey';
const source=JSON.parse(readFileSync('docs/bootstrap/bugan-cardapio-v2/lote-rascunho.json','utf8'));

for(const [language,expected] of [
 ['pt',['0 itens','1 item','2 itens','1 categoria','2 categorias']],
 ['en',['0 items','1 item','2 items','1 category','2 categories']],
 ['es',['0 productos','1 producto','2 productos','1 categoría','2 categorías']],
] as const)test('F&B counts use existing singular/plural terminology: '+language,()=>{
 assert.deepEqual([0,1,2].map(n=>fbCatalogCount(n,'item',language)),expected.slice(0,3));
 assert.deepEqual([1,2].map(n=>fbCatalogCount(n,'category',language)),expected.slice(3));
});

test('published review topology shares the base menu, with the event exclusively linked to Filipe',()=>{
 const before=JSON.stringify(source),graph=premiumReviewGraph(source) as FbGraph;
 const menuIds=(outlet:string)=>graph.outlet_menus.filter(l=>l.outlet_id===outlet).map(l=>l.menu_id);
 const categories=(outlet:string)=>graph.categories.filter(c=>menuIds(outlet).includes(c.menu_id));
 const items=(outlet:string)=>graph.items.filter(i=>categories(outlet).some(c=>c.id===i.category_id));
 assert.deepEqual(menuIds(previewId(1)),[previewId(3),previewId(6)]);
 assert.deepEqual(menuIds(previewId(2)),[previewId(3)]);
 assert.deepEqual([categories(previewId(1)).length,items(previewId(1)).length],[23,143]);
 assert.deepEqual([categories(previewId(2)).length,items(previewId(2)).length],[22,142]);
 const exclusive=graph.items.filter(i=>i.category_id===previewId(4,eventCategorySourceId));
 assert.equal(exclusive.length,1);assert.ok(exclusive.every(i=>!items(previewId(2)).some(r=>r.id===i.id)));
 assert.equal(JSON.stringify(source),before);
});

test('ordering simulation counts derive from source windows intersected with Room Service menu membership',()=>{
 const day=(premiumSimulatedOffer(source,'2026-11-10T11:00:00-03:00') as NativeOffer).outlets[0];
 const night=(premiumSimulatedOffer(source,'2026-11-10T22:30:00-03:00') as NativeOffer).outlets[0];
 const sourceFor=(scopes:string[])=>source.itens.filter((i:{janela_room_service_proposta:string})=>scopes.includes(i.janela_room_service_proposta));
 assert.equal(day.id,previewId(2));assert.equal(day.products.length,sourceFor(['24h','11_2230']).length);
 assert.deepEqual([day.menus.flatMap(m=>m.categories).length,day.products.length],[13,56]);
 assert.equal(night.products.length,sourceFor(['24h']).length);assert.equal(night.products.length,14);
 assert.ok(day.products.every(p=>p.menu_id===previewId(3)&&p.available));
 const weekly=(premiumSimulatedOffer(source,'2026-11-10T19:00:00-03:00') as NativeOffer).outlets[0];
 const eventIds=source.itens.filter((i:{goomer_categoria_id:string})=>i.goomer_categoria_id===eventCategorySourceId).map((i:{goomer_id:string})=>previewId(5,i.goomer_id));
 assert.ok(weekly.products.every(p=>!eventIds.includes(p.id)),'An open event window cannot grant Room Service access to the Filipe-only menu');
});
