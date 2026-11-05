import {legacyCommissionFixture} from './fb-commission-legacy-fixture.mjs';
// Real local GoTrue/password + PostgREST + PostgreSQL. No tenant/cloud/API fallback.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {seedLab,literal} from './fb-local-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
const {fbOrderFoundation}=await import('../../lib/fb/orders/boundary.server.ts');

const checks=[];let state;
function check(ok,label){assert.ok(ok,label);checks.push(label);}
async function rpc(actor,name,args={}){const r=await actor.client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.code+' '+r.error.message);return r.data;}
async function deny(actor,name,args,code,label){const r=await actor.client.rpc(name,args);check(r.error?.code===code,label+' actual='+r.error?.code);}
const query=sql=>{const raw=labSql(sql,true);if(raw==='t')return true;if(raw==='f')return false;if(!raw)return null;if(/^[0-9a-f-]{36}$/.test(raw))return raw;return JSON.parse(raw);};
const config=(actor,kind,values,id=null,revision=0)=>rpc(actor,'save_current_hotel_fb_order_config',{p_kind:kind,p_id:id,p_expected_revision:revision,p_values:values});
const baseIntent=(t,more={})=>({lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:1,options:[]}],first_name:'Pessoa',last_name:'Sintética',fulfilment:'pickup',language:'pt',...more});
const snapshot=(table,h)=>query("select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public."+table+" t where hotel_id="+literal(h));
try{
 const lab=await seedLab();state=lab.s;const {tenants,platform,project}=lab;const server={client:project};
 labSql("notify pgrst, 'reload schema';");
 const boundary=fbOrderFoundation(project);
 const anon={client:createClient(state.api,state.anon,{auth:{persistSession:false,autoRefreshToken:false}})};
 async function administrator(t){
  const email='b1-admin-'+randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url');
  const created=await project.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw Error('Local Auth admin fixture creation failed');
  labSql("insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values("+[created.data.user.id,t.id,email,'Admin B1','administrador'].map(literal).join(',')+",true)");
  const client=createClient(state.api,state.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});check(!login.error,'normal GoTrue administrator login '+t.name);
  return {id:created.data.user.id,client};
 }
 for(const [index,t]of tenants.entries()){
  await rpc(platform,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:true});
  // B fixture owns its presentation; the protected A fixture source is unchanged.
  if(index!==4)labSql("update public.hotel_public_presentation set configuration=jsonb_set(configuration,'{experienceVersion}','\"v3\"') where hotel_id="+literal(t.id));
  t.admin=await administrator(t);
  await deny(t.operator,'get_current_hotel_fb_order_config',{},'42501','Operator no implicit configure '+t.name);
  await deny(t.viewer,'get_current_hotel_fb_order_panel',{},'42501','Viewer no orders '+t.name);
  await deny(platform,'get_current_hotel_fb_order_panel',{},'42501','Platform no hotel/PII inheritance '+t.name);
  for(const cap of ['orders.configure','orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read'])
   await config(t.admin,'grant',{user_id:t.admin.id,capability:cap,active:true});
  check(!(await boundary.beginSession(t.slug)).ok,'no B configuration means native orders disabled '+t.name);
  await legacyCommissionFixture(t);
  t.settings=await config(t.admin,'hotel',{enabled:true,timezone:'America/Recife',cancel_minutes:10,cancel_auto:true,cancel_free:false});
  t.kitchen=await config(t.admin,'sector',{name:'Cozinha',active:true});
  t.bar=await config(t.admin,'sector',{name:'Bar',active:true});
  t.menu=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'menu',p_id:null,p_expected_revision:0,p_values:{name:'Menu B1',is_published:true}});
  t.category=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'category',p_id:null,p_expected_revision:0,p_values:{name:'Categoria B1',menu_id:t.menu.id,is_published:true}});
  t.item=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'item',p_id:null,p_expected_revision:0,p_values:{name:'Prato B1',category_id:t.category.id,is_published:true,price_amount_minor:2500,currency:'BRL'}});
  t.drink=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'item',p_id:null,p_expected_revision:0,p_values:{name:'Bebida B1',category_id:t.category.id,is_published:true,price_amount_minor:700,currency:'BRL'}});
  t.outlet=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'outlet',p_id:null,p_expected_revision:0,p_values:{name:'Restaurante Filipe',type:'restaurant',is_published:true,action_type:'service',service_id:t.services.filipe,menu_ids:[t.menu.id]}});
  t.room=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'outlet',p_id:null,p_expected_revision:0,p_values:{name:'Room Service',type:'room_service',is_published:true,action_type:'service',service_id:t.services.external,menu_ids:[t.menu.id]}});
  const legacyBefore=snapshot('hotel_sections',t.id);t.legacyB=legacyBefore;
  t.outletCfg=await config(t.admin,'outlet',{mode:'native',accepting:true,pickup:true,room_delivery:true,default_sector_id:t.kitchen.id},t.outlet.id);
  t.roomCfg=await config(t.admin,'outlet',{mode:index===4?'native':'external',accepting:true,pickup:false,room_delivery:true,default_sector_id:t.kitchen.id},t.room.id);
  for(const out of [t.outlet,t.room])await config(t.admin,'availability',{outlet_id:out.id,always_open:true});
  await config(t.admin,'fulfilment',{outlet_id:t.outlet.id,item_id:t.drink.id,sector_id:t.bar.id});
  await config(t.admin,'entrypoint',{outlet_id:t.outlet.id,service_id:t.services.filipe,active:true});
  for(const capability of ['orders.read','orders.transition'])await config(t.admin,'grant',{user_id:t.operator.id,capability,sector_id:t.kitchen.id,active:true});
  const session=await boundary.beginSession(t.slug);check(session.ok,'real technical public session '+t.name);t.session=session.data.secret;
  const intent=baseIntent(t);
  const quote=await boundary.quote(t.slug,t.session,t.outlet.id,intent);check(quote.ok&&quote.data.total_minor===2500,'server price '+t.name);
  t.key=randomUUID();const input={slug:t.slug,session:t.session,outlet:t.outlet.id,key:t.key,intent,roomToken:null,expectedTotalMinor:2500,expectedCurrency:'BRL'};
  t.confirmInput=input;
  const result=await boundary.confirm(input);check(result.ok&&result.data.status==='registered','transactional registered order '+t.name);t.receipt=result.data;
  const replay=await boundary.confirm(input);check(replay.ok&&replay.data.replayed&&replay.data.order_id===t.receipt.order_id&&replay.data.accessSecret===t.receipt.accessSecret,'retry same receipt/credential '+t.name);
  const conflict=await boundary.confirm({...input,intent:baseIntent(t,{first_name:'Outra'})});check(!conflict.ok&&conflict.status===409,'divergent intent conflicts '+t.name);
  const status=await boundary.status(t.slug,t.receipt.accessSecret);check(status.ok&&!JSON.stringify(status.data).includes('Sintética'),'opaque status has no PII '+t.name);
  await deny(t.operator,'get_current_hotel_fb_order_pii',{p_order_id:t.receipt.order_id},'42501','operator PII denied without capability '+t.name);
  const pii=await rpc(t.admin,'get_current_hotel_fb_order_pii',{p_order_id:t.receipt.order_id});check(pii.last_name==='Sintética','explicit authorized PII '+t.name);
  assert.deepEqual(snapshot('hotel_sections',t.id),legacyBefore);checks.push('legacy Services unchanged '+t.name);
  console.log('B1 base real Auth/config/order matrix: '+t.name);
 }
 const {verifyB1Adversarial}=await import('./fb-b1-adversarial.mjs');
 await verifyB1Adversarial({state,tenants,platform,project,server,anon,boundary,check,rpc,deny,config,baseIntent,query});
 for(const t of tenants){
  assert.deepEqual(snapshot('hotel_sections',t.id),t.legacyB);checks.push('final legacy Services preserved '+t.name);
  assert.deepEqual(snapshot('hotel_room_links',t.id),t.legacyRooms);checks.push('final original room/QR rows preserved '+t.name);
 }
 const rls=query("select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and c.relkind='r'");
 check(rls.length===29&&rls.every(t=>t.rls),'all 27 B1 tables plus B2 quotes and B4 maintenance have RLS');
 writeFileSync(join(state.dir,'b1-report.json'),JSON.stringify({suite:'fb-b1',passed:checks.length,failed:0,identities:6,authUsers:19,migrations:readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).length,externalRequests:0,checks,rls},null,2));
 console.log(JSON.stringify({suite:'fb-b1',passed:checks.length,failed:0,directory:state.dir}));
}catch(error){if(state)writeFileSync(join(state.dir,'b1-failure.json'),JSON.stringify({passed:checks.length,error:error.message,checks},null,2));console.error(error.stack);process.exitCode=1;}
