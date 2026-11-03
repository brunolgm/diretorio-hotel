// Own synthetic tenants in the disposable offline lab. Never resolves a real hotel ID.
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {seedLab,literal,rows} from './fb-local-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
export async function rpc(actor,name,args={}){const r=await actor.client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.code);return r.data;}
export const config=(actor,kind,values,id=null,revision=0)=>rpc(actor,'save_current_hotel_fb_order_config',{p_kind:kind,p_id:id,p_expected_revision:revision,p_values:values});
export const saved=(t,kind,values,id=null,revision=0)=>rpc(t.operator,'save_current_hotel_fb',{p_kind:kind,p_id:id,p_expected_revision:revision,p_values:values});
export const basket=(t,extra={})=>({lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:1,options:[]}],fulfilment:'pickup',language:'pt',...extra});
export const fullIntent=(t,extra={})=>({...basket(t),first_name:'Pessoa',last_name:'Homologação B23',note:'Observação privada de fixture',...extra});
export async function seedB23(){
 const lab=await seedLab();const {s,project,platform,tenants}=lab;
 async function actor(t,role,suffix){const email='b23-'+suffix+'-'+randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url');const created=await project.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw Error('Local fixture Auth creation failed');const id=created.data.user.id;
  labSql('insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values('+[id,t.id,email,'Pessoa de operação sintética',role].map(literal).join(',')+',true)');
  const client=createClient(s.api,s.anon,{auth:{persistSession:false,autoRefreshToken:false}});const login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error('Local fixture password authentication failed');return {id,email,password,client};
 }
 for(const [index,t]of tenants.entries()){
  await rpc(platform,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:true});
  if(index!==4)labSql("update public.hotel_public_presentation set configuration=jsonb_set(configuration,'{experienceVersion}','\"v3\"') where hotel_id="+literal(t.id));
  t.admin=await actor(t,'administrador','admin');t.reader=await actor(t,'operador','reader');t.barOperator=await actor(t,'operador','bar');
  for(const capability of ['orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read','orders.configure'])await config(t.admin,'grant',{user_id:t.admin.id,capability,active:true});
  t.kitchen=await config(t.admin,'sector',{name:'Cozinha de fixture',active:true,sort_order:1});t.bar=await config(t.admin,'sector',{name:'Bar de fixture',active:true,sort_order:2});
  t.settings=await config(t.admin,'hotel',{enabled:true,timezone:'America/Recife',cancel_auto:true,cancel_free:true,cancel_minutes:10});
  t.menu=await saved(t,'menu',{name:'Menu de homologação',is_published:true});t.category=await saved(t,'category',{name:'Categoria de homologação',menu_id:t.menu.id,is_published:true});
  t.item=await saved(t,'item',{name:'Prato de fixture',category_id:t.category.id,is_published:true,price_amount_minor:2500,currency:'BRL'});
  t.drink=await saved(t,'item',{name:'Bebida de fixture',category_id:t.category.id,is_published:true,price_amount_minor:700,currency:'BRL'});
  t.custom=await saved(t,'item',{name:'Item com escolhas',category_id:t.category.id,is_published:true,price_amount_minor:1800,currency:'BRL'});
  t.otherCurrency=await saved(t,'item',{name:'Item em outra moeda',category_id:t.category.id,is_published:true,price_amount_minor:1200,currency:'USD'});
  t.noPrice=await saved(t,'item',{name:'Item sob consulta',category_id:t.category.id,is_published:true,price_amount_minor:null,currency:'BRL',price_on_request:true});
  t.unpublished=await saved(t,'item',{name:'Item não publicado',category_id:t.category.id,is_published:false,price_amount_minor:3000,currency:'BRL'});
  for(const [lang,name]of [['en','Fixture dish'],['es','Plato de fixture']])await rpc(t.operator,'save_current_hotel_fb_translation',{p_kind:'item',p_id:t.item.id,p_language:lang,p_source_revision:t.item.source_revision,p_fields:{name}});
  t.outlet=await saved(t,'outlet',{name:'Restaurante Filipe · fixture',type:'restaurant',sort_order:0,is_published:true,action_type:'service',service_id:t.services.filipe,menu_ids:[t.menu.id]});
  t.room=await saved(t,'outlet',{name:'Room Service · fixture',type:'room_service',sort_order:1,is_published:true,action_type:'service',service_id:t.services.external,menu_ids:[t.menu.id]});
  t.external=await saved(t,'outlet',{name:'Canal externo de fixture',type:'cafe',sort_order:2,is_published:true,action_type:'external_url',external_url:'https://external.fixture.invalid/menu',menu_ids:[t.menu.id]});
  const path=t.id+'/fb/outlet/'+t.outlet.id+'/'+randomUUID()+'.png';
  // Real local facade photo, used only as a synthetic Storage fixture (not editorial validation).
  const uploaded=await project.storage.from('hotel-assets').upload(path,readFileSync('docs/references/bugan/public-v3/fachada-bugan-real.png'),{contentType:'image/png',upsert:false});if(uploaded.error)throw Error('Local fixture photo upload failed');
  await rpc(t.operator,'set_current_hotel_fb_image',{p_kind:'outlet',p_id:t.outlet.id,p_expected_revision:t.outlet.revision,p_path:path});
  t.outlet=rows('select to_jsonb(o) from public.hotel_fb_outlets o where id='+literal(t.outlet.id));
  t.outletCfg=await config(t.admin,'outlet',{mode:'native',accepting:true,pickup:true,room_delivery:true,default_sector_id:t.kitchen.id},t.outlet.id);
  t.roomCfg=await config(t.admin,'outlet',{mode:index===4?'native':'external',accepting:true,pickup:false,room_delivery:true,default_sector_id:t.kitchen.id},t.room.id);
  t.outletAvail=await config(t.admin,'availability',{outlet_id:t.outlet.id,always_open:true,display_mode:'show_unavailable'});
  t.roomAvail=await config(t.admin,'availability',{outlet_id:t.room.id,always_open:true});
  await config(t.admin,'fulfilment',{outlet_id:t.outlet.id,item_id:t.drink.id,sector_id:t.bar.id});
  t.required=await config(t.admin,'modifier_group',{item_id:t.custom.id,name:'Escolha única',selection:'single',min_selected:1,max_selected:1,active:true,sort_order:1});
  t.requiredOption=await config(t.admin,'modifier_option',{group_id:t.required.id,name:'Opção A',amount_minor:100,currency:'BRL',active:true,sort_order:1});
  t.requiredAlternative=await config(t.admin,'modifier_option',{group_id:t.required.id,name:'Opção B',amount_minor:200,currency:'BRL',active:true,sort_order:2});
  t.multi=await config(t.admin,'modifier_group',{item_id:t.custom.id,name:'Escolha múltipla',selection:'multi',min_selected:0,max_selected:2,active:true,sort_order:2});
  t.multiOptions=[];for(let n=1;n<=3;n++)t.multiOptions.push(await config(t.admin,'modifier_option',{group_id:t.multi.id,name:'Adicional '+n,amount_minor:n*50,currency:'BRL',active:true,sort_order:n}));
  t.inactiveOption=await config(t.admin,'modifier_option',{group_id:t.multi.id,name:'Opção inativa',amount_minor:50,currency:'BRL',active:false});
  t.combo=await config(t.admin,'combo',{name:'Combo de homologação',amount_minor:3200,currency:'BRL',is_published:true});
  await config(t.admin,'combo_menu',{combo_id:t.combo.id,menu_id:t.menu.id});
  t.foodSlot=await config(t.admin,'combo_slot',{combo_id:t.combo.id,name:'Componente Cozinha',min_selected:1,max_selected:1,multiplicity:1});
  t.foodChoice=await config(t.admin,'combo_choice',{slot_id:t.foodSlot.id,item_id:t.custom.id,extra_minor:200,active:true});
  t.drinkSlot=await config(t.admin,'combo_slot',{combo_id:t.combo.id,name:'Componente Bar',min_selected:1,max_selected:1,multiplicity:2});
  t.drinkChoice=await config(t.admin,'combo_choice',{slot_id:t.drinkSlot.id,item_id:t.drink.id,extra_minor:50,active:true});
  t.entrypoint=await config(t.admin,'entrypoint',{outlet_id:t.outlet.id,service_id:t.services.filipe,active:true});
  t.grants={};for(const [a,sector,capabilities]of [[t.operator,t.kitchen,['orders.read','orders.transition']],[t.reader,t.kitchen,['orders.read']],[t.barOperator,t.bar,['orders.read','orders.transition']]])for(const capability of capabilities){const grant=await config(t.admin,'grant',{user_id:a.id,capability,sector_id:sector.id,active:true});t.grants[a.id+capability]=grant;}
  t.immutableSnapshot=rows('select jsonb_build_object(\'hotel\',(select to_jsonb(h) from public.hotels h where id='+literal(t.id)+"),'presentation',(select to_jsonb(p) from public.hotel_public_presentation p where hotel_id="+literal(t.id)+"),'services',(select jsonb_agg(to_jsonb(s) order by id) from public.hotel_sections s where hotel_id="+literal(t.id)+"),'rooms',(select jsonb_agg(to_jsonb(r) order by id) from public.hotel_room_links r where hotel_id="+literal(t.id)+'))');
 }
 labSql("notify pgrst,'reload schema';");return lab;
}
