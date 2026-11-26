import test from 'node:test';
import assert from 'node:assert/strict';
import dictionary from '../../lib/fb/bugan-room-editorial.json' with {type: 'json'};
import {localizeBuganRoomEditorial} from '../../lib/fb/bugan-room-editorial.ts';
import {localizeBuganRoomOutlets} from '../../lib/fb/bugan-room-localization.ts';
import type {NativeOutlet, Product} from '../../lib/fb/orders/journey';
import type {RoomNameRow} from '../../lib/fb/room-name-translations';

const burgerId = 'da434a67-b1bd-4aa6-8756-79baefa620b9';
const categoryId = '0d49ac95-c74d-4be4-9c32-1e4af312bc3f';
const item: Product = {id: burgerId, kind: 'item', menu_id: 'shared-menu', category_id: categoryId,
  name: 'Bugan Burguer', description: dictionary.descriptions[burgerId].source, amount_minor: 6000,
  currency: 'BRL', available: true, groups: [{id: 'extra-group', name: 'Adicionais', min: 0, max: 2,
    selection: 'multi', options: [{id: 'bacon', name: 'Bacon', amount_minor: 600}]}]};
const combo: Product = {...item, id: '17aa1694-ab07-4406-bcde-2931d6800672', kind: 'combo',
  name: 'Bugan Burguer + Refri', description: 'Descrição do combo', amount_minor: 6500, groups: [],
  slots: [{id: 'slot', name: 'Hambúrguer', min: 1, max: 1, multiplicity: 1,
    choices: [{id: 'choice', extra_minor: 0, item}]}]};
const outlet: NativeOutlet = {id: dictionary.outletId, name: 'Room Service', description: null,
  available: true, hidden: false, pickup: false, room_delivery: true,
  menus: [{id: 'shared-menu', name: 'Cardápio Bugan Recife', categories: [{id: categoryId, name: 'Sanduíches'}]}],
  products: [item, combo]};

function business(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(business);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['name', 'description'].includes(key)).map(([key, v]) => [key, business(v)]));
  return value;
}

test('editorial resource covers 142 source descriptions and 22 categories without business fields', () => {
  assert.equal(Object.keys(dictionary.descriptions).length, 142);
  assert.equal(Object.keys(dictionary.categories).length, 22);
  for (const entries of [dictionary.descriptions, dictionary.categories]) for (const [id, row] of Object.entries(entries)) {
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(row).sort(), ['en', 'es', 'source']);
    for (const value of Object.values(row)) assert.ok(value.trim());
  }
  assert.match(dictionary.descriptions[burgerId].en, /180 g/);
  assert.match(dictionary.descriptions[burgerId].es, /180 g/);
  // The authoritative Portuguese ingredients take precedence over its contradictory English fragments.
  const tropical = dictionary.descriptions['9b839b21-9ed4-40a2-8ca3-b229d24d74e7'];
  assert.match(tropical.en, /orange/); assert.match(tropical.es, /naranja/);
  const mojito = dictionary.descriptions['c0c9eb0f-bcda-47c4-a13e-f45c6e5036e1'];
  assert.doesNotMatch(mojito.en, /orange/i); assert.doesNotMatch(mojito.es, /naranja/i);
});

for (const lang of ['en', 'es'] as const) test(`${lang}: descriptions, combo components and category titles preserve commercial contracts`, () => {
  const source = structuredClone([outlet]); const before = structuredClone(source);
  const result = localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, lang, source);
  assert.equal(result[0].products[0].description, dictionary.descriptions[burgerId][lang]);
  assert.equal(result[0].products[1].slots![0].choices[0].item.description, dictionary.descriptions[burgerId][lang]);
  assert.equal(result[0].products[1].description, 'Descrição do combo');
  assert.equal(result[0].menus[0].categories[0].name, dictionary.categories[categoryId][lang]);
  assert.deepEqual(business(result), business(source)); assert.deepEqual(source, before);
  // The SSR projection and subsequent offer refresh can apply the same editorial resource safely.
  assert.deepEqual(localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, lang, result), result);
});

test('Portuguese, Filipe, foreign hotels and other outlets keep their original content', () => {
  const source = [outlet];
  assert.equal(localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, 'pt', source), source);
  for (const [slug, hotel] of [['other-hotel', dictionary.hotelId], [dictionary.slug, 'foreign-hotel']])
    assert.equal(localizeBuganRoomEditorial(slug, hotel, 'en', source), source);
  for (const id of ['e9a3740c-d5a5-41d6-b0e6-4114de6407a3', 'another-outlet']) {
    const other = {...outlet, id};
    assert.equal(localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, 'es', [other])[0], other);
  }
});

test('unknown records, null descriptions and revised sources never receive stale editorial text', () => {
  const changed = {...outlet, products: [{...item, description: 'Receita alterada no cadastro'}, {...item, id: 'unknown'}, {...item, description: null}],
    menus: [{...outlet.menus[0], categories: [{id: categoryId, name: 'Categoria renomeada'}, {id: 'unknown', name: 'Sanduíches'}]}]};
  const result = localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, 'en', [changed])[0];
  assert.equal(result.products[0].description, 'Receita alterada no cadastro');
  assert.equal(result.products[1].description, item.description); assert.equal(result.products[2].description, null);
  assert.deepEqual(result.menus, changed.menus);
});

test('editorial translation does not replace the hotel’s saved name overrides or deliberate Portuguese fallback', () => {
  const row: RoomNameRow = {hotel_id: dictionary.hotelId, outlet_id: dictionary.outletId, kind: 'item', id: burgerId,
    source_name: item.name, saved_source_name: item.name, context_name: '', parent_id: null, revision: 1,
    name_en: 'Hotel-edited burger', name_es: null};
  for (const lang of ['en', 'es'] as const) {
    const localized = localizeBuganRoomOutlets(dictionary.slug, dictionary.hotelId, lang, [outlet], [row]);
    const ssr = localizeBuganRoomEditorial(dictionary.slug, dictionary.hotelId, lang, localized);
    assert.equal(ssr[0].products[0].name, lang === 'en' ? 'Hotel-edited burger' : item.name);
    assert.equal(ssr[0].products[0].description, dictionary.descriptions[burgerId][lang]);
  }
});
