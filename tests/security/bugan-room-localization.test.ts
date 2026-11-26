import test from 'node:test';
import assert from 'node:assert/strict';
import dictionary from '../../lib/fb/bugan-room-names.json' with {type: 'json'};
import {localizeBuganRoomOutlets, localizeBuganRoomQuoteLines} from '../../lib/fb/bugan-room-localization.ts';
import type {NativeOutlet, Product, QuoteLine} from '../../lib/fb/orders/journey';
import {parseRoomNameForm,roomNameEditorRows,type RoomNameRow} from '../../lib/fb/room-name-translations.ts';

const burgerId = 'da434a67-b1bd-4aa6-8756-79baefa620b9';
const drinkId = 'a2e8a8fd-2ca2-4479-8b56-e9decf584bca';
const comboId = '17aa1694-ab07-4406-bcde-2931d6800672';
const groupId = '3155e1f0-e6fe-4b4a-af76-ae7a2c6e2d2c';
const cheeseId = '48a8175d-3d63-4601-89bd-2dbff02e2b9d';
const baconId = 'eaa44130-d3f0-4a8b-a652-6af62d7b40c8';
const item: Product = {id:burgerId,kind:'item',menu_id:'shared-menu',category_id:'sandwiches',name:'Bugan Burguer',description:'Descrição original',amount_minor:6000,currency:'BRL',available:true,groups:[{id:groupId,name:'Adicionais',selection:'multi',min:0,max:2,options:[{id:cheeseId,name:'Muçarela',amount_minor:500},{id:baconId,name:'Bacon',amount_minor:600}]}]};
const drink: Product = {...item,id:drinkId,name:'Coca-Cola Zero em lata 350 ml',amount_minor:1100,groups:[]};
const combo: Product = {...item,id:comboId,kind:'combo',name:'Bugan Burguer + Refri',amount_minor:6500,groups:[],slots:[{id:'61a0f4c0-4a44-48bb-b120-9c65d610b4b5',name:'Hambúrguer',min:1,max:1,multiplicity:1,choices:[{id:'choice-burger',extra_minor:0,item}]},{id:'a7d69128-6bca-43f6-8426-a8b1c0f623d3',name:'Refrigerante',min:1,max:1,multiplicity:1,choices:[{id:'choice-drink',extra_minor:0,item:drink}]}]};
const outlet: NativeOutlet = {id:dictionary.outletId,name:'Room Service',description:null,available:true,hidden:false,pickup:false,room_delivery:true,menus:[],products:[item,drink,combo]};
const filiPe: NativeOutlet = {...outlet,id:'e9a3740c-d5a5-41d6-b0e6-4114de6407a3',name:'Restaurante Filipe'};
const line: QuoteLine = {id:comboId,kind:'combo',name:combo.name,quantity:1,unit_minor:6500,total_minor:7100,currency:'BRL',extra_minor:0,options:[],components:[{id:burgerId,choice_id:'choice-burger',kind:'component',name:item.name,quantity:1,unit_minor:0,total_minor:0,currency:'BRL',extra_minor:0,options:[{id:baconId,name:'Bacon',group:'Adicionais',unit_minor:600,quantity:1}],components:[]},{id:drinkId,choice_id:'choice-drink',kind:'component',name:drink.name,quantity:1,unit_minor:0,total_minor:0,currency:'BRL',extra_minor:0,options:[],components:[]}]};

function withoutLabels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutLabels);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key])=>!['name','group'].includes(key)).map(([key,item])=>[key,withoutLabels(item)]));
  return value;
}

test('reviewed names cover both languages with exact source guards and known option groups',()=>{
  const names: Record<string,{source:string;en:string;es:string;groupId?:string}> = dictionary.names;
  assert.equal(Object.keys(names).length,162);
  for (const [id,entry] of Object.entries(names)) {
    assert.match(id,/^[0-9a-f-]{36}$/); assert.ok(entry.source.trim() && entry.en.trim() && entry.es.trim());
    if (entry.groupId) assert.ok(names[entry.groupId]);
  }
});

for (const language of ['pt','en','es'] as const) test(`${language} offer and checkout keep all prices, choices, IDs and rules`,()=>{
  const source = structuredClone([filiPe,outlet]); const priced = structuredClone([line]);
  const sourceBefore = structuredClone(source), pricedBefore = structuredClone(priced);
  const translated = localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,language,source);
  const checkout = localizeBuganRoomQuoteLines(dictionary.slug,dictionary.hotelId,dictionary.outletId,language,priced);
  assert.deepEqual(withoutLabels(translated),withoutLabels(source));
  assert.deepEqual(withoutLabels(checkout),withoutLabels(priced));
  assert.deepEqual(source,sourceBefore); assert.deepEqual(priced,pricedBefore);
  assert.equal(translated[0],source[0]);
  const expected={pt:['Bugan Burguer + Refri','Bugan Burguer','Coca-Cola Zero em lata 350 ml','Hambúrguer','Refrigerante','Adicionais','Muçarela'],en:['Bugan Burger & Soft Drink','Bugan Burger','Coca-Cola Zero 350 ml can','Burger','Soft drink','Extras','Mozzarella'],es:['Hamburguesa Bugan + Refresco','Hamburguesa Bugan','Coca-Cola Zero en lata de 350 ml','Hamburguesa','Refresco','Adicionales','Mozzarella']}[language];
  const product=translated[1].products[2];
  assert.deepEqual([product.name,product.slots![0].choices[0].item.name,product.slots![1].choices[0].item.name,product.slots![0].name,product.slots![1].name,product.slots![0].choices[0].item.groups[0].name,product.slots![0].choices[0].item.groups[0].options[0].name],expected);
  assert.deepEqual([checkout[0].name,checkout[0].components[0].name,checkout[0].components[1].name,checkout[0].components[0].options[0].group],[expected[0],expected[1],expected[2],expected[5]]);
  assert.equal(checkout[0].total_minor,7100);
  if(language==='pt'){assert.equal(translated,source);assert.equal(checkout,priced);}
});

test('Filipe and foreign hotels keep authoritative content even with copied Bugan entity IDs',()=>{
  for (const language of ['en','es'] as const) {
    for (const [slug,hotelId] of [['foreign',dictionary.hotelId],[dictionary.slug,'foreign']]) {
      const offer=[outlet]; assert.equal(localizeBuganRoomOutlets(slug,hotelId,language,offer),offer);
      const quote=[line]; assert.equal(localizeBuganRoomQuoteLines(slug,hotelId,dictionary.outletId,language,quote),quote);
    }
    const quote=[line]; assert.equal(localizeBuganRoomQuoteLines(dictionary.slug,dictionary.hotelId,filiPe.id,language,quote),quote);
    const foreignOutlet=[{...outlet,id:'another-room-service'}]; assert.equal(localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,language,foreignOutlet)[0],foreignOutlet[0]);
  }
});

test('unknown or renamed products never receive a stale name or a translation from a different record',()=>{
  const source=[{...outlet,products:[{...item,name:'Novo nome no Admin'},{...item,id:'unknown'}]}];
  const translated=localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,'en',source);
  assert.equal(translated[0].products[0].name,'Novo nome no Admin');
  assert.equal(translated[0].products[1].name,'Bugan Burguer');
  const quote=[{...line,name:'Novo combo no Admin',options:[{id:cheeseId,name:'Novo adicional',group:'Novo grupo',unit_minor:500,quantity:1}]}];
  const checkout=localizeBuganRoomQuoteLines(dictionary.slug,dictionary.hotelId,dictionary.outletId,'es',quote);
  assert.equal(checkout[0].name,'Novo combo no Admin');
  assert.equal(checkout[0].options[0].name,'Novo adicional'); assert.equal(checkout[0].options[0].group,'Novo grupo');
});

function override(kind:RoomNameRow['kind'],id:string,source_name:string,extra:Partial<RoomNameRow>={}):RoomNameRow {
  return {hotel_id:dictionary.hotelId,outlet_id:dictionary.outletId,kind,id,source_name,context_name:'Room Service',parent_id:null,
    saved_source_name:source_name,name_en:'Edited English',name_es:'Español editado',revision:1,...extra};
}

for (const origin of ['reviewed','automatic'] as const) test(`${origin} Admin overrides reach products, combos, groups, extras and quote components with identical business fields`,()=>{
  const rows=[override('item',burgerId,item.name),override('combo',comboId,combo.name),override('combo_slot',combo.slots![0].id,'Hambúrguer'),
    override('modifier_group',groupId,'Adicionais'),override('modifier_option',baconId,'Bacon',{parent_id:groupId})].map(row=>({...row,origin}));
  for(const language of ['en','es'] as const){
    const result=localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,language,[outlet],rows)[0];
    const expected=language==='en'?'Edited English':'Español editado';
    assert.equal(result.products[0].name,expected);assert.equal(result.products[2].name,expected);
    assert.equal(result.products[2].slots![0].name,expected);assert.equal(result.products[0].groups[0].name,expected);
    assert.equal(result.products[0].groups[0].options[1].name,expected);
    assert.deepEqual(withoutLabels(result),withoutLabels(outlet));
    const quote=localizeBuganRoomQuoteLines(dictionary.slug,dictionary.hotelId,dictionary.outletId,language,[line],rows)[0];
    assert.equal(quote.name,expected);assert.equal(quote.components[0].name,expected);
    assert.equal(quote.components[0].options[0].name,expected);assert.equal(quote.components[0].options[0].group,expected);
    assert.deepEqual(withoutLabels(quote),withoutLabels(line));
  }
});

test('blank overrides deliberately use Portuguese; foreign scope and stale overrides cannot replace current names',()=>{
  const empty=override('item',burgerId,item.name,{name_en:null,name_es:null});
  assert.equal(localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,'en',[outlet],[empty])[0].products[0].name,item.name);
  for(const row of [{...empty,hotel_id:'foreign'},{...empty,outlet_id:'foreign'},{...empty,saved_source_name:'older name'}])
    assert.equal(localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,'en',[outlet],[row])[0].products[0].name,'Bugan Burger');
  const editor=roomNameEditorRows([{...empty,source_name:'Renamed Portuguese',name_en:'Old English'}])[0];
  assert.equal(editor.stale,true);assert.equal(editor.name_en,'Old English');
  assert.equal(roomNameEditorRows([{...empty,revision:0,name_en:null}])[0].name_en,'Bugan Burger');
  const globallyTranslated=[{...outlet,products:[{...item,name:'Global English'}]}];
  assert.equal(localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,'en',globallyTranslated,[override('item',burgerId,item.name)])[0].products[0].name,'Edited English');
  assert.equal(localizeBuganRoomOutlets(dictionary.slug,dictionary.hotelId,'en',globallyTranslated,[empty])[0].products[0].name,item.name);
});

test('translation form accepts only bounded names and concurrency identity, never prices, rules or tenant selection',()=>{
  const make=()=>{const form=new FormData();for(const [key,value]of Object.entries({kind:'item',id:burgerId,source_name:item.name,revision:'0',name_en:' Burger ',name_es:''}))form.set(key,value);return form;};
  assert.deepEqual(parseRoomNameForm(make()),{p_kind:'item',p_id:burgerId,p_source_name:item.name,p_revision:0,p_name_en:'Burger',p_name_es:''});
  for(const key of ['price','amount_minor','max_selected','active','hotel_id','outlet_id']){const form=make();form.set(key,'1');assert.throws(()=>parseRoomNameForm(form));}
  for(const [key,value]of [['revision',''],['revision','-1'],['kind','unknown'],['id','bad'],['name_en','x'.repeat(161)],['name_es','line\nbreak']]){const form=make();form.set(key,value);assert.throws(()=>parseRoomNameForm(form));}
  const duplicate=make();duplicate.append('name_en','second');assert.throws(()=>parseRoomNameForm(duplicate));
});
