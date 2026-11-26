import test from 'node:test';
import assert from 'node:assert/strict';
import dictionary from '../../lib/fb/bugan-room-editorial.json' with {type: 'json'};
import {localizeBuganRoomEditorial} from '../../lib/fb/bugan-room-editorial.ts';
import {parseRoomNameForm,roomNameEditorRows,type RoomNameRow} from '../../lib/fb/room-name-translations.ts';
import {localizeBuganRoomOutlets} from '../../lib/fb/bugan-room-localization.ts';
import type {NativeOutlet, Product} from '../../lib/fb/orders/journey';

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

function editorialOverride(kind:'item_description'|'category',id:string,source:string,extra:Partial<RoomNameRow>={}):RoomNameRow {
  return {hotel_id:dictionary.hotelId,outlet_id:dictionary.outletId,kind,id,source_name:source,saved_source_name:source,
    context_name:'Room Service',parent_id:null,name_en:'Edited English text',name_es:'Texto editado',revision:1,...extra};
}

test('saved descriptions and categories survive SSR, refresh and explicit original-text fallback',()=>{
  for(const lang of ['en','es'] as const){
    const rows=[editorialOverride('item_description',burgerId,item.description!),editorialOverride('category',categoryId,'Sanduíches')];
    const result=localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,lang,[outlet],rows);
    const twice=localizeBuganRoomEditorial(dictionary.slug,dictionary.hotelId,lang,result,rows);
    assert.equal(twice[0].products[0].description,lang==='en'?'Edited English text':'Texto editado');
    assert.equal(twice[0].products[1].slots![0].choices[0].item.description,twice[0].products[0].description);
    assert.equal(twice[0].menus[0].categories[0].name,twice[0].products[0].description);
    assert.deepEqual(business(twice),business([outlet]));
    const cleared=rows.map(row=>({...row,name_en:null,name_es:null}));
    const fallback=localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,lang,[outlet],cleared);
    const ssr=localizeBuganRoomEditorial(dictionary.slug,dictionary.hotelId,lang,fallback,cleared)[0];
    assert.equal(ssr.products[0].description,item.description);assert.equal(ssr.menus[0].categories[0].name,'Sanduíches');
  }
});

test('foreign or stale editorial overrides cannot replace the current reviewed content',()=>{
  const row=editorialOverride('item_description',burgerId,item.description!);
  for(const changed of [{...row,hotel_id:'foreign'},{...row,outlet_id:'foreign'},{...row,saved_source_name:'Previous description'}]){
    assert.equal(localizeBuganRoomEditorial(dictionary.slug,dictionary.hotelId,'en',[outlet],[changed])[0].products[0].description,dictionary.descriptions[burgerId].en);
  }
  const category=editorialOverride('category',categoryId,'Sanduíches',{saved_source_name:'Previous category'});
  assert.equal(localizeBuganRoomEditorial(dictionary.slug,dictionary.hotelId,'es',[outlet],[category])[0].menus[0].categories[0].name,'Sándwiches');
});

test('editor rows prefill reviewed descriptions and categories, preserve clears and mark changed sources',()=>{
  const description=editorialOverride('item_description',burgerId,item.description!,{revision:0,name_en:null,name_es:null});
  const category=editorialOverride('category',categoryId,'Sanduíches',{revision:0,name_en:null,name_es:null});
  const [d,c]=roomNameEditorRows([description,category]);
  assert.equal(d.name_en,dictionary.descriptions[burgerId].en);assert.equal(c.name_es,'Sándwiches');
  assert.equal(roomNameEditorRows([{...description,revision:1}])[0].name_en,'');
  assert.equal(roomNameEditorRows([{...category,source_name:'Renamed category',revision:1}])[0].stale,true);
});

test('description forms allow multiline text up to 10000 while category titles retain name limits',()=>{
  const make=(kind:string)=>{const form=new FormData();for(const [key,value]of Object.entries({kind,id:burgerId,source_name:'Source text',revision:'0',name_en:'English\nsecond line',name_es:'Texto\nsegunda línea'}))form.set(key,value);return form;};
  assert.equal(parseRoomNameForm(make('item_description')).p_name_en,'English\nsecond line');
  for(const key of ['price','max_selected','active','hotel_id','outlet_id']){const form=make('item_description');form.set(key,'1');assert.throws(()=>parseRoomNameForm(form));}
  const long=make('item_description');long.set('name_en','x'.repeat(10000));assert.equal(parseRoomNameForm(long).p_name_en.length,10000);
  long.set('name_en','x'.repeat(10001));assert.throws(()=>parseRoomNameForm(long));
  const control=make('item_description');control.set('name_es','Text\u0007');assert.throws(()=>parseRoomNameForm(control));
  const title=make('category');assert.throws(()=>parseRoomNameForm(title));
  title.set('name_en','Starters');title.set('name_es','Entradas');assert.equal(parseRoomNameForm(title).p_kind,'category');
  title.set('name_es','x'.repeat(161));assert.throws(()=>parseRoomNameForm(title));
});
