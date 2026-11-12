import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {smartMenuFixture} = await import('../fixtures/smartmenu.ts');
import type {SmartCartLine} from '../../lib/fb/smartmenu.ts';
const {roomServiceProjection} = await import('../../lib/fb/smartmenu-projection.ts');
const {smartMenuSuggestions, smartLineEstimate, smartComboSavings} = await import('../../lib/fb/smartmenu.ts');
const {buildRoomServiceHref} = await import('../../lib/public-routes.ts');
import type {DomainContext} from '../../lib/domain-context.ts';

test('Room Service projection excludes Filipe events and foreign tenants across hotel identities', () => {
  for (let hotel = 0; hotel < 6; hotel++) for (const language of ['pt', 'en', 'es'] as const) {
    const {pageData, offer} = smartMenuFixture(hotel, language);
    const view = roomServiceProjection(pageData.fb, pageData.hotel.id, offer)!;
    assert.equal(view.outlet.type, 'room_service');
    const menuIds = new Set(pageData.fb!.outlet_menus.filter(link => link.outlet_id === view.outlet.id).map(link => link.menu_id));
    assert.ok(view.native.products.every(product => menuIds.has(product.menu_id)));
    assert.ok(!view.native.products.some(product => /noite de massas/i.test(product.name)));
    assert.equal(roomServiceProjection(pageData.fb, 'foreign-hotel', offer), null);
    assert.equal(roomServiceProjection(null, pageData.hotel.id, offer), null);
    offer.outlets[0].hidden = true;
    assert.equal(roomServiceProjection(pageData.fb, pageData.hotel.id, offer), null);
  }
});

test('Consultative projection never enables ordering or invents groups', () => {
  const {pageData} = smartMenuFixture();
  const view = roomServiceProjection(pageData.fb, pageData.hotel.id)!;
  assert.equal(view.hasRoomContext, false);
  assert.equal(view.native.available, false);
  assert.ok(view.native.products.every(product => !product.available && !product.groups.length));
  pageData.fb!.outlets.find(outlet => outlet.type === 'room_service')!.action_type = 'external_url';
  assert.equal(roomServiceProjection(pageData.fb, pageData.hotel.id), null);
});

test('Multiple Room Service outlets use stable administrative order and UUID, independent of availability', () => {
  const {pageData, offer} = smartMenuFixture();
  const graph = pageData.fb!;
  const primary = graph.outlets.find(outlet => outlet.type === 'room_service')!;
  const second = {...primary, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', name: 'Outro Room Service'};
  graph.outlets.unshift(second, {...primary, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', hotel_id: 'foreign-hotel', sort_order: -100});
  graph.outlet_menus.push({...graph.outlet_menus.find(link => link.outlet_id === primary.id)!, outlet_id: second.id});
  assert.equal(roomServiceProjection(graph, pageData.hotel.id, offer)?.outlet.id, primary.id);
  graph.outlets.reverse();
  assert.equal(roomServiceProjection(graph, pageData.hotel.id, offer)?.outlet.id, primary.id);
  offer.outlets[0].available = false;
  assert.equal(roomServiceProjection(graph, pageData.hotel.id, offer)?.outlet.id, primary.id);
  offer.outlets[0].hidden = true;
  assert.equal(roomServiceProjection(graph, pageData.hotel.id, offer), null);
  offer.outlets[0].hidden = false;
  second.sort_order = -1;
  assert.equal(roomServiceProjection(graph, pageData.hotel.id, offer)?.outlet.id, second.id);
});

test('Only configured combo relationships recommend available products and exact replacements', () => {
  const {offer, first, second, combo} = smartMenuFixture();
  const line = (product: typeof first, id: string): SmartCartLine => ({clientId: id, currency: product.currency, intent: {kind: 'item', id: product.id, menu_id: product.menu_id, quantity: 1, options: []}});
  const cart = [line(first, 'one')];
  const serialized = JSON.stringify(cart);
  assert.deepEqual(smartMenuSuggestions(offer.outlets[0], cart).complements.map(product => product.id), [second.id]);
  assert.equal(JSON.stringify(cart), serialized);
  cart.push(line(second, 'two'));
  assert.deepEqual(smartMenuSuggestions(offer.outlets[0], cart).combos, [{product: combo, replace: ['one', 'two']}]);
  cart[0].intent.quantity = 2;
  assert.equal(smartMenuSuggestions(offer.outlets[0], cart).combos.length, 0);
  second.available = false;
  assert.equal(smartMenuSuggestions(offer.outlets[0], [line(first, 'one')]).complements.length, 0);
  offer.outlets[0].available = false;
  assert.deepEqual(smartMenuSuggestions(offer.outlets[0], cart), {complements: [], combos: []});
});

test('Estimates use actual configured amounts and do not claim a discount', () => {
  const {first} = smartMenuFixture();
  assert.equal(smartLineEstimate(first, {kind: 'item', id: first.id, menu_id: first.menu_id, quantity: 2, options: [first.groups[0].options[0].id]}), (first.amount_minor! + 200) * 2);
  assert.equal(smartLineEstimate(undefined, {kind: 'item', id: first.id, menu_id: first.menu_id, quantity: 1, options: []}), null);
});

test('Dedicated routes preserve language and preview navigation scope', () => {
  const domain = {kind: 'product-subdomain', subdomain: 'hotel', isPotentialHotelSubdomain: true} as DomainContext;
  assert.equal(buildRoomServiceHref({slug: 'hotel', language: 'en'}), '/hotel/hotel/room-service?lang=en');
  assert.equal(buildRoomServiceHref({slug: 'hotel', language: 'pt', domainContext: domain, preferSubdomainRoot: true}), '/room-service');
  assert.ok(buildRoomServiceHref({slug: 'hotel', language: 'es', domainContext: {...domain, navigationScope: 'authenticated-preview'}}).startsWith('/preview'));
});

test('Dedicated experience uses existing transactional and room validation boundaries', () => {
  const source = readFileSync('components/public/native-ordering-outlet.tsx', 'utf8');
  assert.ok(source.includes("smartMenu?'room_delivery'"));
  assert.ok(source.includes('allowAdd={!smartMenu||canFulfil'));
  assert.ok(source.includes("post<Quote>(slug,'quote'"));
  assert.ok(source.includes("post<Receipt>(slug,'confirm'"));
  assert.ok(source.includes('key:current.key'));
  assert.ok(!readFileSync('lib/fb/smartmenu.ts', 'utf8').includes('fetch('));
});

test('Combo savings compare eligible standalone options and withhold ambiguous or nonpositive claims', () => {
  const {offer, first, second, combo} = smartMenuFixture();
  const products = offer.outlets[0].products;
  assert.equal(smartComboSavings(combo, products), null);
  combo.amount_minor = first.amount_minor! + second.amount_minor! - 600;
  assert.deepEqual(smartComboSavings(combo, products), {amount: 600, varies: false});
  const alternate = {...second, id:'alt', amount_minor: second.amount_minor! + 300};
  products.push(alternate);
  combo.slots![1].choices.push({id:'alternate',item:alternate,extra_minor:0});
  assert.deepEqual(smartComboSavings(combo, products), {amount: 600, varies: true});
  combo.slots![1].choices[0].extra_minor = 100;
  assert.deepEqual(smartComboSavings(combo, products), {amount: 500, varies: true});
  second.amount_minor = null;
  assert.equal(smartComboSavings(combo, products), null);
  combo.slots![1].choices[0].item.available = false;
  assert.deepEqual(smartComboSavings(combo, products), {amount: 900, varies: false});
  combo.slots![1].max = 2;
  assert.equal(smartComboSavings(combo, products), null);
});

test('Bugan hides alternatives for a fulfilled single-choice slot and keeps the combo conversion', () => {
  const {offer, first, second, combo} = smartMenuFixture();
  const outlet = offer.outlets[0];
  const alternate = {...second, id:'alternate'};
  outlet.products.push(alternate);
  combo.slots![1].choices.push({id:'alternate-choice',item:alternate,extra_minor:0});
  const line = (product: typeof first): SmartCartLine => ({
    clientId:product.id, currency:product.currency,
    intent:{kind:'item',id:product.id,menu_id:product.menu_id,quantity:1,options:[]},
  });
  const cart = [line(first),line(second)];
  assert.deepEqual(smartMenuSuggestions(outlet,cart).complements.map(product=>product.id),[alternate.id]);
  assert.deepEqual(smartMenuSuggestions(outlet,cart,true).complements,[]);
  assert.deepEqual(smartMenuSuggestions(outlet,cart,true).combos.map(value=>value.product.id),[combo.id]);
  assert.deepEqual(smartMenuSuggestions(outlet,[line(first)],true).complements.map(product=>product.id),[second.id,alternate.id]);
});
