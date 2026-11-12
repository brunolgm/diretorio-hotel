import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {seedB23, rpc, saved} from './fb-b23-seed.mjs';
import {literal, rows} from './fb-local-seed.mjs';

const checks = [];
const check = (ok, label) => { assert.ok(ok,label); checks.push(label); };
const read = actor => actor.client.rpc('get_current_bugan_room_commercial');
const draft = (actor,kind,value,id=null,revision=0) => actor.client.rpc('save_current_bugan_room_commercial_draft',{
  p_kind:kind,p_id:id,p_revision:revision,p_draft:value,
});
const digest = secret => createHash('sha256').update(secret).digest('hex');
const lab=await seedB23();
const t=lab.tenants.find(hotel=>hotel.brand==='bugan');
const foreign=lab.tenants.find(hotel=>hotel.id!==t.id);
const originalSlug=t.slug;
labSql('update public.hotels set slug='+literal('bugan-recife')+' where id='+literal(t.id)+' and slug='+literal(originalSlug));
t.slug='bugan-recife';
const actorFile='out/room-commercial-actor.local.json';
writeFileSync(actorFile,JSON.stringify({email:t.admin.email,password:t.admin.password,operator:{email:t.operator.email,password:t.operator.password},foreign:{email:foreign.admin.email,password:foreign.admin.password}}));

const offers = [
 ['Bugan Burguer + Refri',6500,[['Hambúrguer','Bugan Burguer'],['Refrigerante','Coca-Cola','Coca-Cola Zero']]],
 ['Margherita + Soda',5200,[['Pizza','Pizza margherita'],['Bebida','Soda Artesanal']]],
 ['Trio Regional',7200,[['Prato','Cuscuz de carne de sol'],['Sobremesa','Cartola'],['Bebida','Água de Coco']]],
 ['Café + Pudim',3500,[['Café','Café Espresso'],['Sobremesa','Pudim de leite']]],
];
const prices={'Bugan Burguer':6000,'Coca-Cola':1100,'Coca-Cola Zero':1100,'Pizza margherita':4400,
 'Soda Artesanal':1300,'Cuscuz de carne de sol':3900,'Cartola':2900,'Água de Coco':1000,'Café Espresso':1300,'Pudim de leite':2600};
const items={};
for(const [name,price] of Object.entries(prices)){
  items[name]=await saved(t,'item',{name,category_id:t.category.id,is_published:true,price_amount_minor:price,currency:'BRL'});
}
const {data:initial,error:initialError}=await read(t.admin);
assert.ifError(initialError);
check(initial.combos.length===0&&initial.groups.length===0,'Admin começa sem rascunhos do piloto');
check(initial.items.some(item=>item.id===items['Bugan Burguer'].id)&&!initial.items.some(item=>item.id===foreign.item.id),'seletor limitado ao cardápio do Room Service');
const unauthorized=await read(t.operator);
const otherHotel=await read(foreign.admin);
const anon=await read({client:createClient(lab.s.api,lab.s.anon)});
check(unauthorized.error?.code==='42501','operador sem orders.configure não lê a área');
check(otherHotel.error?.code==='42501','administrador de outro hotel não lê a área');
check(Boolean(anon.error),'sessão anônima bloqueada');
const asPayload=(name,amount_minor,slots)=>({name,amount_minor,menu_id:t.menu.id,slots:slots.map(([label,...names])=>({name:label,choices:names.map(item=>items[item].id)}))});
const ids=[];
for(const row of offers){
  const {data,error}=await draft(t.admin,'combo',asPayload(...row));
  assert.ifError(error);
  ids.push(data);
}
const groupRows=[
 ['Bugan Burguer',2,[['Muçarela',500],['Bacon',600]]],
 ['Pizza margherita',1,[['Muçarela extra',800]]],
 ['Pudim de leite',1,[['Uma bola de sorvete',800]]],
];
const groupIds=[];
for(const [name,max,options] of groupRows){
  const {data,error}=await draft(t.admin,'group',{name:'Adicionais',item_id:items[name].id,max_selected:max,
    options:options.map(([name,amount_minor])=>({name,amount_minor}))});
  assert.ifError(error);
  groupIds.push(data);
}
let commercial=(await read(t.admin)).data;
check(commercial.combos.length===4&&commercial.groups.length===3&&commercial.combos.every(value=>!value.active)&&commercial.groups.every(value=>!value.active),'quatro combos e três grupos salvos como rascunho');
check(commercial.combos.reduce((sum,value)=>sum+value.slots.length,0)===9&&commercial.groups.reduce((sum,value)=>sum+value.options.length,0)===4,'composição e opções conferidas na leitura autenticada');
check(commercial.combos.find(value=>value.id===ids[2]).slots.map(slot=>slot.name).join(',')==='Prato,Sobremesa,Bebida','ordem dos componentes preservada no Admin');
const before=structuredClone(commercial.combos.find(value=>value.id===ids[0]));
const stale=await draft(t.admin,'combo',asPayload(...offers[0]),ids[0],0);
check(stale.error?.code==='PT409','revisão desatualizada rejeitada');
const invalid=asPayload(...offers[0]);
invalid.slots[1].choices=[foreign.item.id];
const wrongProduct=await draft(t.admin,'combo',invalid,ids[0],before.revision);
check(wrongProduct.error?.code==='22023','produto de outro hotel rejeitado');
check(JSON.stringify((await read(t.admin)).data.combos.find(value=>value.id===ids[0]))===JSON.stringify(before),'falha no segundo componente reverte toda a edição');
const outOfMenu=await draft(t.admin,'combo',{...asPayload(...offers[0]),menu_id:foreign.menu.id});
check(outOfMenu.error?.code==='22023','cardápio estrangeiro rejeitado');
const injected=await draft(t.admin,'combo',{...asPayload(...offers[0]),is_published:true});
check(injected.error?.code==='22023','publicação injetada no rascunho rejeitada');
const oldSave=await t.admin.client.rpc('save_current_hotel_fb_order_config',{p_kind:'combo',p_id:ids[0],p_expected_revision:before.revision,p_values:{is_published:true}});
check(oldSave.error?.code==='42501','contrato anterior não ativa combo do piloto');
const oldOption=await t.admin.client.rpc('save_current_hotel_fb_order_config',{p_kind:'modifier_option',p_id:null,p_expected_revision:0,p_values:{group_id:groupIds[0],name:'Tentativa',currency:'BRL',amount_minor:0,active:true}});
check(oldOption.error?.code==='42501','contrato anterior não altera opções do piloto');
const approved=await draft(t.admin,'combo',asPayload(...offers[0]),ids[0],before.revision);
check(approved.data===ids[0]&&!approved.error,'edição de rascunho preserva identidade');
const offer=async(slug=t.slug)=>{
  const result=await lab.project.rpc('get_fb_order_offer',{p_hotel_slug:slug,p_language:'pt'});
  assert.ifError(result.error);
  return result.data.outlets;
};
const scoped=(outlets,id)=>outlets.find(outlet=>outlet.id===id);
const visible=await offer();
check(ids.every(id=>!visible.some(outlet=>outlet.products.some(product=>product.id===id))),'rascunhos fora da oferta pública');
check(!scoped(visible,t.room.id).products.find(product=>product.id===items['Bugan Burguer'].id).groups.length,'adicionais em rascunho não aparecem');

try {
  // This is a disposable database. Only fixtures are activated here to exercise the production pricing contracts.
  labSql('update fb_order_private.combos set is_published=true where id in ('+ids.map(literal).join(',')+'); update fb_order_private.modifier_groups set active=true where id in ('+groupIds.map(literal).join(',')+');');
  const current=await offer();
  const room=scoped(current,t.room.id), filipe=scoped(current,t.outlet.id);
  check(room?.available&&filipe?.available&&room.menus.some(menu=>filipe.menus.some(other=>other.id===menu.id)),'Room Service e Filipe nativos e com cardápio compartilhado na fixture');
  check(ids.every(id=>room.products.some(product=>product.id===id)),'quatro combos projetados no Room Service');
  check(room.products.find(product=>product.id===ids[2]).slots.map(slot=>slot.name).join(',')==='Prato,Sobremesa,Bebida','ordem dos componentes preservada na oferta');
  check(ids.every(id=>!filipe.products.some(product=>product.id===id)),'combos ausentes no Filipe com o mesmo menu');
  check(filipe.products.some(product=>product.id===t.combo.id),'combo legado continua no Filipe');
  for(const [name] of groupRows){
    check(room.products.find(product=>product.id===items[name].id).groups.length===1,'adicionais no Room Service · '+name);
    check(filipe.products.find(product=>product.id===items[name].id).groups.length===0,'adicionais fora do Filipe · '+name);
  }
  check((await offer(foreign.slug)).every(outlet=>outlet.products.every(product=>!ids.includes(product.id))),'outro hotel preserva a própria oferta');

  const secret=randomBytes(32).toString('base64url');
  await rpc({client:lab.project},'begin_fb_order_session',{p_hotel_slug:t.slug,p_secret_digest:digest(secret)});
  const combo=room.products.find(product=>product.id===ids[0]);
  const burger=room.products.find(product=>product.id===items['Bugan Burguer'].id);
  const bacon=burger.groups[0].options.find(option=>option.name==='Bacon').id;
  const roomLine={kind:'combo',id:combo.id,menu_id:t.menu.id,quantity:1,choices:combo.slots.map(slot=>{
    const choice=slot.choices[0];return {id:choice.id,options:choice.item.id===burger.id?[bacon]:[]};
  })};
  const itemLine={kind:'item',id:burger.id,menu_id:t.menu.id,quantity:1,options:[bacon]};
  const quote = async(outlet,line,fulfilment)=>{
    const nonce=randomBytes(32).toString('base64url');
    const intent={lines:[line],fulfilment,language:'pt'};
    const result=await lab.project.rpc('create_fb_order_quote',{p_hotel_slug:t.slug,p_session_secret:secret,
      p_outlet_id:outlet,p_intent:intent,p_quote_digest:digest(nonce)});
    return {result,nonce,intent};
  };
  const comboQuote=await quote(t.room.id,roomLine,'room_delivery');
  check(comboQuote.result.data?.priced.total_minor===7100,'PostgreSQL cota combo com bacon em R$ 71,00');
  const addonQuote=await quote(t.room.id,itemLine,'room_delivery');
  check(addonQuote.result.data?.priced.total_minor===6600,'PostgreSQL cota hambúrguer avulso com bacon em R$ 66,00');
  check((await quote(t.outlet.id,roomLine,'pickup')).result.error?.code==='22023','Filipe rejeita combo mesmo por acesso direto à cotação');
  check((await quote(t.outlet.id,itemLine,'pickup')).result.error?.code==='22023','Filipe rejeita ID forjado de adicional');
  check((await quote(t.outlet.id,{...itemLine,options:[]},'pickup')).result.data?.priced.total_minor===6000,'preço avulso do Filipe preservado');

  const liveDraft=await draft(t.admin,'combo',asPayload(...offers[0]),ids[0],approved.data?before.revision+1:0);
  check(liveDraft.error?.code==='42501','cadastro ativo é somente leitura nesta etapa');
  const orderCount=()=>rows('select count(*)::text from fb_order_private.orders');
  check(orderCount()===0,'nenhum pedido antes da tentativa de revalidação');
  // Invalidate the fixture before calling the rejection path. It cannot progress to persistence.
  labSql('update fb_order_private.combos set is_published=false where id='+literal(ids[0]));
  const confirm=await lab.project.rpc('confirm_fb_order_from_quote',{p_hotel_slug:t.slug,p_session_secret:secret,
    p_outlet_id:t.room.id,p_quote_id:comboQuote.result.data.quote_id,p_quote_secret:comboQuote.nonce,p_key:randomUUID(),
    p_intent:{...comboQuote.intent,first_name:'Pessoa',last_name:'Sintética'},p_room_token:t.roomTokens.valid,p_access_digest:digest(randomBytes(32))});
  check(confirm.error?.code==='PT409','finalização revalida e recusa combo retirado da oferta');
  check(orderCount()===0,'nenhum pedido criado no PostgreSQL local');
} finally {
  labSql('update fb_order_private.combos set is_published=false where id in ('+ids.map(literal).join(',')+'); update fb_order_private.modifier_groups set active=false where id in ('+groupIds.map(literal).join(',')+');');
}
const report={passed:checks.length,checks,realPostgreSQL:true,productionAccess:false,ordersCreated:0};
writeFileSync('out/room-commercial-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
