import {historicalCancellation} from './fb-historical-cancellation-fixture.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {literal} from './fb-local-seed.mjs';
const {opaqueOrderSecret,orderSecretDigest,deriveOrderAccessSecret}=await import('../../lib/fb/orders/credentials.server.ts');

export async function verifyB1Adversarial(io){
 const {state,tenants,platform,server,anon,boundary,check,rpc,deny,config,baseIntent,query}=io;
 const count=(table,h)=>query('select count(*)::text from fb_order_private.'+table+' where hotel_id='+literal(h));
 const order=(id)=>query("select to_jsonb(o) from fb_order_private.orders o where id="+literal(id));
 const groups=id=>query("select jsonb_agg(to_jsonb(g) order by sector_name) from fb_order_private.order_groups g where order_id="+literal(id));
 async function make(t,intent=baseIntent(t),outlet=t.outlet.id,roomToken=null){
  const session=await boundary.beginSession(t.slug);check(session.ok,'new local technical session');
  const quoted=await boundary.quote(t.slug,session.data.secret,outlet,intent);check(quoted.ok,'new server quote');
  const input={slug:t.slug,session:session.data.secret,outlet,key:randomUUID(),intent,roomToken,expectedTotalMinor:quoted.data.total_minor,expectedCurrency:quoted.data.currency};
  const result=await boundary.confirm(input);check(result.ok,'new confirmed fixture order');
  return {input,receipt:result.data};
 }
 const tables=query("select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='fb_order_private'");
 for(const role of ['anon','authenticated','service_role']){
  for(const table of tables){
   check(query("select has_table_privilege("+literal(role)+","+literal('fb_order_private.'+table)+",'SELECT,INSERT,UPDATE,DELETE')")===false,'no raw table grants '+role+' '+table);
  }
 }
 check(query("select count(*)::text from pg_policies where schemaname='fb_order_private'")===0,'no generic permissive private policies');
 check(query("select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fb_order_private' and has_function_privilege('authenticated',p.oid,'EXECUTE')")===0,'authenticated no helper execution');
 const hidden=await server.client.schema('fb_order_private').from('orders').select('id');
 check(hidden.error?.code==='PGRST106','private schema is not exposed by the actual Data API');
 await deny(anon,'confirm_fb_order',{p_hotel_slug:tenants[0].slug,p_session_secret:'x',p_key:randomUUID(),p_outlet_id:tenants[0].outlet.id,p_intent:{},p_room_token:null,p_access_digest:'0'.repeat(64),p_expected_total_minor:0,p_expected_currency:'BRL'},'42501','anon cannot invoke confirmation');
 await deny(server,'get_current_hotel_fb_order_panel',{},'42501','service_role cannot impersonate staff');
 for(let index=0;index<tenants.length;index++){
  const t=tenants[index],foreign=tenants[(index+1)%6];
  await deny(t.admin,'get_current_hotel_fb_order',{p_order_id:foreign.receipt.order_id},'42501','foreign order read '+t.name);
  await deny(t.admin,'get_current_hotel_fb_order_pii',{p_order_id:foreign.receipt.order_id},'42501','foreign PII '+t.name);
  await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'outlet',p_id:foreign.outlet.id,p_expected_revision:0,p_values:{mode:'native'}},'23503','foreign outlet composite FK '+t.name);
  await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'fulfilment',p_id:null,p_expected_revision:0,p_values:{outlet_id:t.outlet.id,item_id:t.item.id,sector_id:foreign.kitchen.id}},'23503','foreign sector composite FK '+t.name);
  await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'grant',p_id:null,p_expected_revision:0,p_values:{user_id:foreign.operator.id,capability:'orders.read'}},'42501','foreign grant target '+t.name);
  await deny(t.operator,'save_current_hotel_fb_order_config',{p_kind:'grant',p_id:null,p_expected_revision:0,p_values:{user_id:t.operator.id,capability:'orders.pii.read'}},'42501','Operator cannot self-grant '+t.name);
  await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'grant',p_id:null,p_expected_revision:0,p_values:{user_id:t.viewer.id,capability:'orders.read'}},'42501','Viewer cannot be granted orders '+t.name);
  const quoteForeign=await boundary.quote(t.slug,t.session,foreign.outlet.id,baseIntent(foreign));
  check(!quoteForeign.ok,'foreign priced graph denied '+t.name);
  const tokenForeign=await boundary.status(foreign.slug,t.receipt.accessSecret);check(!tokenForeign.ok&&tokenForeign.status===403,'opaque credential hotel scope '+t.name);
  const noNames={lines:baseIntent(t).lines,fulfilment:'pickup',language:'pt'};
  check((await boundary.quote(t.slug,t.session,t.outlet.id,noNames)).ok,'quote needs no early collection of guest names '+t.name);
  for(const [lang,name]of [['en','B1 dish'],['es','Plato B1']]){
   await rpc(t.operator,'save_current_hotel_fb_translation',{p_kind:'item',p_id:t.item.id,p_language:lang,p_source_revision:1,p_fields:{name}});
   const localized=await make(t,baseIntent(t,{language:lang}));
   const facts=await boundary.status(t.slug,localized.receipt.accessSecret);
   check(facts.ok&&facts.data.lines[0].name===name,'confirmed displayed-name snapshot '+t.name+' '+lang);
  }
  const beforeVisual=await rpc(t.admin,'get_current_hotel_fb_order',{p_order_id:t.receipt.order_id});
  const oldConfig=query("select configuration from public.hotel_public_presentation where hotel_id="+literal(t.id));
  labSql("update public.hotel_public_presentation set configuration=jsonb_set(configuration,'{experienceVersion}','\""+(index===4?'v3':'v4')+"\"') where hotel_id="+literal(t.id));
  assert.deepEqual(await rpc(t.admin,'get_current_hotel_fb_order',{p_order_id:t.receipt.order_id}),beforeVisual);checksPush('presentation-only change preserves order IDs/data '+t.name);
  labSql("update public.hotel_public_presentation set configuration="+literal(JSON.stringify(oldConfig))+"::jsonb where hotel_id="+literal(t.id));
  const mixed=baseIntent(t,{lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:1},{kind:'item',id:t.drink.id,menu_id:t.menu.id,quantity:1}]});
  const m=await make(t,mixed);check(groups(m.receipt.order_id).length===2,'one order two sector groups '+t.name);
  const scoped=await rpc(t.operator,'get_current_hotel_fb_order',{p_order_id:m.receipt.order_id});
  check(scoped.groups.length===1&&scoped.lines.length===1&&scoped.lines[0].origin_id===t.item.id,'sector-scoped actual RPC projection '+t.name);
  const kitchen=groups(m.receipt.order_id).find(g=>g.sector_id===t.kitchen.id),bar=groups(m.receipt.order_id).find(g=>g.sector_id===t.bar.id);
  await deny(t.operator,'transition_current_hotel_fb_order_group',{p_group_id:kitchen.id,p_expected_revision:null,p_status:'accepted'},'PT409','null revision cannot bypass CAS '+t.name);
  await deny(t.operator,'transition_current_hotel_fb_order_group',{p_group_id:bar.id,p_expected_revision:1,p_status:'accepted'},'42501','foreign sector transition denied '+t.name);
  const results=await Promise.all([t.operator.client,t.admin.client].map(client=>client.rpc('transition_current_hotel_fb_order_group',{p_group_id:kitchen.id,p_expected_revision:1,p_status:'accepted'})));
  check(results.filter(r=>!r.error).length===1&&results.filter(r=>r.error?.code==='PT409'&&r.status===409).length===1,'concurrent group CAS HTTP409 '+t.name+' '+results.map(r=>r.error?.code||'ok').join(','));
  check(order(m.receipt.order_id).status==='registered','conservative overall registered until every group accepted '+t.name);
  await rpc(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:bar.id,p_expected_revision:1,p_status:'accepted'});
  check(order(m.receipt.order_id).status==='accepted','all accepted projects accepted '+t.name);
  const events=await rpc(t.admin,'get_current_hotel_fb_acceptance_events',{p_order_id:m.receipt.order_id});
  check(events.length===2&&new Set(events.map(e=>e.event_id)).size===2&&events.every(e=>e.contract_version===1&&e.line_refs.length===1),'stable two acceptance events for C '+t.name);
  check(!/first_name|last_name|room_label|note|printed/.test(JSON.stringify(events)),'acceptance contract no PII/printed '+t.name);
  const repeated=await rpc(t.admin,'get_current_hotel_fb_acceptance_events',{p_order_id:m.receipt.order_id});assert.deepEqual(events,repeated);checksPush('stable event identifiers '+t.name);
  for(const g of groups(m.receipt.order_id)){
   await deny(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:g.id,p_expected_revision:g.revision,p_status:'delivered'},'22023','no arbitrary status skip '+t.name);
   await rpc(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:g.id,p_expected_revision:g.revision,p_status:'preparing'});
   await rpc(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:g.id,p_expected_revision:g.revision+1,p_status:'ready'});
   await deny(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:g.id,p_expected_revision:g.revision+2,p_status:'out_for_delivery'},'22023','pickup cannot enter delivery '+t.name);
   await rpc(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:g.id,p_expected_revision:g.revision+2,p_status:'delivered'});
  }
  check(order(m.receipt.order_id).status==='delivered','pickup delivered only after every group '+t.name);
  check(query("select expires_at<=(select terminal_at+interval '24 hours' from fb_order_private.orders where id="+literal(m.receipt.order_id)+") from fb_order_private.order_access_tokens where order_id="+literal(m.receipt.order_id))===true,'terminal access cutoff '+t.name);
  const roomIntent=baseIntent(t,{fulfilment:'room_delivery'});
  const session=await boundary.beginSession(t.slug);const common={slug:t.slug,session:session.data.secret,outlet:t.outlet.id,intent:roomIntent,expectedTotalMinor:2500,expectedCurrency:'BRL'};
  for(const [label,roomToken]of [['missing',null],['invalid','invalid'],['inactive',t.roomTokens.inactive],['foreign',foreign.roomTokens.valid]]){
   const denied=await boundary.confirm({...common,key:randomUUID(),roomToken});check(!denied.ok&&denied.status===403,'room context '+label+' rejected '+t.name);
  }
  const delivery=await boundary.confirm({...common,key:randomUUID(),roomToken:t.roomTokens.valid});check(delivery.ok,'valid QR context native order '+t.name);
  const roomPii=await rpc(t.admin,'get_current_hotel_fb_order_pii',{p_order_id:delivery.data.order_id});check(roomPii.room_label==='F-01','room label resolved DB not browser '+t.name);
  const dg=groups(delivery.data.order_id)[0];
  for(const [i,status]of ['accepted','preparing','ready','out_for_delivery','delivered'].entries())
   await rpc(t.admin,'transition_current_hotel_fb_order_group',{p_group_id:dg.id,p_expected_revision:1+i,p_status:status});
  check(order(delivery.data.order_id).status==='delivered','room delivery full state path '+t.name);
  const before=count('orders',t.id),concurrent=await boundary.beginSession(t.slug),key=randomUUID();
  const ci={...t.confirmInput,session:concurrent.data.secret,key};
  const parallel=await Promise.all([boundary.confirm(ci),boundary.confirm(ci)]);
  check(parallel.every(r=>r.ok)&&new Set(parallel.map(r=>r.data.order_id)).size===1&&count('orders',t.id)===before+1,'real concurrent idempotent create '+t.name);
  const audit=query("select count(*)::text from fb_order_private.order_events where order_id="+literal(parallel[0].data.order_id)+" and action='orders.registered'");
  check(audit===1,'one creation event under concurrency '+t.name);
  const created=parallel[0].data;
  const auto=await boundary.requestCancellation(t.slug,created.accessSecret,1);check(!auto.ok,'guest pre-accept cancellation disabled '+t.name);await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:created.order_id,p_expected_revision:1,p_reason_code:'guest_request'});
  check(query("select count(*)::text from fb_order_private.orders where id="+literal(created.order_id))===1,'cancellation never deletes order '+t.name);
  // Native/external/mixed and entitlement OFF use the same domain in all identities.
  const originalRoom=t.roomCfg;
  if(originalRoom.mode==='external'){
   const ext=await boundary.quote(t.slug,t.session,t.room.id,roomIntent);check(!ext.ok,'external outlet no native checkout '+t.name);
   t.roomCfg=await config(t.admin,'outlet',{mode:'native'},t.room.id,originalRoom.revision);
  }
  const nativeRoom=await make(t,roomIntent,t.room.id,t.roomTokens.valid);check(nativeRoom.receipt.status==='registered','Room Service native configured explicitly '+t.name);
  t.roomCfg=await config(t.admin,'outlet',{mode:'external'},t.room.id,t.roomCfg.revision);
  check(!(await boundary.quote(t.slug,t.session,t.room.id,roomIntent)).ok,'generic historical external regression '+t.name);
  if(index===4)t.roomCfg=await config(t.admin,'outlet',{mode:'native'},t.room.id,t.roomCfg.revision);
  await rpc(platform,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:false});
  check(!(await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t))).ok,'module OFF denies new pricing '+t.name);
  const oldReplay=await boundary.confirm(t.confirmInput);check(oldReplay.ok&&oldReplay.data.replayed,'module OFF still recovers committed receipt '+t.name);
  check((await rpc(t.operator,'get_current_hotel_fb_order_panel',{})).length>0,'authorized drain reads existing orders with module OFF '+t.name);
  const readGrant=query("select to_jsonb(g) from fb_order_private.operator_grants g where hotel_id="+literal(t.id)+" and user_id="+literal(t.operator.id)+" and capability='orders.read'");
  const revoked=await config(t.admin,'grant',{active:false},readGrant.id,readGrant.revision);
  await deny(t.operator,'get_current_hotel_fb_order_panel',{},'42501','capability revocation works while module OFF '+t.name);
  await config(t.admin,'grant',{active:true},readGrant.id,revoked.revision);
  await rpc(platform,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:true});
  console.log('B1 adversarial/state/context/mode matrix: '+t.name);
 }
 function checksPush(label){check(true,label);}
 const t=tenants[4];
 const currentSettings=query("select to_jsonb(s) from fb_order_private.hotel_settings s where hotel_id="+literal(t.id));
 const disabled=await config(t.admin,'hotel',{enabled:false},null,currentSettings.revision);
 check(!(await boundary.beginSession(t.slug)).ok,'master OFF prevents new technical sessions');
 check(!(await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t))).ok,'master OFF prevents fresh pricing');
 check((await boundary.confirm(t.confirmInput)).ok,'master OFF still recovers known committed receipt');
 await config(t.admin,'hotel',{enabled:true},null,disabled.revision);
 t.settings=query("select to_jsonb(s) from fb_order_private.hotel_settings s where hotel_id="+literal(t.id));
 // Config CAS: two valid staff requests observe the same revision.
 const configResults=await Promise.all([false,true].map(active=>t.admin.client.rpc('save_current_hotel_fb_order_config',{p_kind:'sector',p_id:t.bar.id,p_expected_revision:1,p_values:{active}})));
 check(configResults.filter(r=>!r.error).length===1&&configResults.filter(r=>r.error?.code==='PT409').length===1,'config CAS actual competing requests');
 const bar=query("select to_jsonb(s) from fb_order_private.sectors s where id="+literal(t.bar.id));await config(t.admin,'sector',{active:true},t.bar.id,bar.revision);
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'hotel',p_id:null,p_expected_revision:t.settings.revision,p_values:{timezone:'Invented/Zone'}},'22023','IANA timezone required');
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'hotel',p_id:null,p_expected_revision:t.settings.revision,p_values:{pii_days:9999}},'22023','retention cannot be changed by arbitrary patch');
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'hotel',p_id:null,p_expected_revision:null,p_values:{enabled:false}},'PT409','null config revision rejected');
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'hotel',p_id:null,p_expected_revision:t.settings.revision,p_values:{enabled:'true'}},'22023','config booleans strictly typed');
 await deny(t.admin,'get_current_hotel_fb_order_panel',{p_limit:null},'22023','null page limit cannot make unbounded projection');
 // Deterministic calendar matrix uses real SQL tables and explicit internal instants.
 const scope=query("select to_jsonb(a) from fb_order_private.availability_scopes a where outlet_id="+literal(t.outlet.id));
 let av=await config(t.admin,'availability',{always_open:false},scope.id,scope.revision);
 await config(t.admin,'window',{scope_id:av.id,weekday:1,start_minute:22*60,end_minute:2*60,next_day:true});
 const available=at=>query("select fb_order_private.scope_available("+literal(t.id)+",'outlet',"+literal(t.outlet.id)+","+literal(at)+"::timestamptz)");
 for(const [at,expected]of [['2026-11-03T00:59:00Z',false],['2026-11-03T01:00:00Z',true],['2026-11-03T04:59:00Z',true],['2026-11-03T05:00:00Z',false]])
  check(available(at)===expected,'Recife overnight half-open window '+at);
 await config(t.admin,'exception',{scope_id:av.id,starts_at:'2026-11-03T02:00:00Z',ends_at:'2026-11-03T03:00:00Z',available:false});
 check(!available('2026-11-03T02:30:00Z'),'closing exception wins');
 av=await config(t.admin,'availability',{always_open:true,manual_closed:true,closed_until:'2026-11-03T04:00:00Z'},av.id,av.revision);
 check(!available('2026-11-03T03:30:00Z')&&available('2026-11-03T04:00:00Z'),'manual close optional end');
 av=await config(t.admin,'availability',{manual_closed:false},av.id,av.revision);
 const itemScope=await config(t.admin,'availability',{item_id:t.item.id,always_open:false,display_mode:'hide'});
 check(!(await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t))).ok,'item inherited additional restriction');
 await config(t.admin,'availability',{always_open:true},itemScope.id,itemScope.revision);
 check((await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t))).ok,'explicit restored item calendar');
 // Options: required, min/max, ownership, duplicates and currency.
 const mg=await config(t.admin,'modifier_group',{item_id:t.item.id,name:'Ponto',selection:'single',min_selected:1,max_selected:1});
 const mo=await config(t.admin,'modifier_option',{group_id:mg.id,name:'Ao ponto',amount_minor:125,currency:'BRL'});
 const mo2=await config(t.admin,'modifier_option',{group_id:mg.id,name:'Bem passado',amount_minor:50,currency:'BRL'});
 check(!(await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t))).ok,'required option cannot be replaced by free text');
 const optionIntent=baseIntent(t,{lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:2,options:[mo.id]}]});
 const oq=await boundary.quote(t.slug,t.session,t.outlet.id,optionIntent);check(oq.ok&&oq.data.total_minor===5250,'server option price quantity');
 for(const opts of [[mo.id,mo.id],[mo.id,mo2.id],[randomUUID()]]){
  const bad=await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t,{lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:1,options:opts}]}));check(!bad.ok,'duplicate/max/foreign option rejected');
 }
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'modifier_option',p_id:null,p_expected_revision:0,p_values:{group_id:mg.id,name:'Wrong currency',amount_minor:1,currency:'USD'}},'23514','option currency must match item');
 const combo=await config(t.admin,'combo',{name:'Combo explícito',amount_minor:3000,currency:'BRL',is_published:true});
 await config(t.admin,'combo_menu',{combo_id:combo.id,menu_id:t.menu.id});
 const slots=[];
 for(const [item,name,extra]of [[t.item,'Prato',200],[t.drink,'Bebida',50]]){
  const slot=await config(t.admin,'combo_slot',{combo_id:combo.id,name,min_selected:1,max_selected:1,multiplicity:1});
  const choice=await config(t.admin,'combo_choice',{slot_id:slot.id,item_id:item.id,extra_minor:extra});
  slots.push({id:choice.id,options:item.id===t.item.id?[mo.id]:[]});
 }
 const comboIntent=baseIntent(t,{lines:[{kind:'combo',id:combo.id,menu_id:t.menu.id,quantity:2,choices:slots,note:'Sem talher'}]});
 const cq=await boundary.quote(t.slug,t.session,t.outlet.id,comboIntent);check(cq.ok&&cq.data.total_minor===6750,'combo explicit base plus extras exactly once');
 const comboOrder=await make(t,comboIntent);
 check(groups(comboOrder.receipt.order_id).length===2,'combo production splits into two sectors');
 check(query("select sum(total_minor)::text from fb_order_private.order_lines where order_id="+literal(comboOrder.receipt.order_id))===6750,'snapshot commercial total not duplicated by components');
 for(const patch of [{cpf:'not collected'},{email:'not-collected@fixture.invalid'},{total_minor:1},{first_name:{nested:'invalid'}}]){
  const invalid=await boundary.confirm({...t.confirmInput,key:randomUUID(),intent:{...baseIntent(t),...patch}});
  check(!invalid.ok&&invalid.status===400,'confirmation rejects extra/incorrect identity/price payload');
 }
 for(const choices of [[slots[0]],[slots[0],slots[0],slots[1]],[{id:randomUUID()}]]){
  check(!(await boundary.quote(t.slug,t.session,t.outlet.id,baseIntent(t,{lines:[{kind:'combo',id:combo.id,menu_id:t.menu.id,quantity:1,choices}]}))).ok,'combo missing/duplicate/foreign choice denied');
 }
 await deny(t.admin,'save_current_hotel_fb_order_config',{p_kind:'combo_choice',p_id:null,p_expected_revision:0,p_values:{slot_id:query("select id from fb_order_private.combo_slots where combo_id="+literal(combo.id)+" limit 1"),combo_id:combo.id}},'22023','no nested combo payload');
 const unchanged=await rpc(t.admin,'get_current_hotel_fb_order',{p_order_id:comboOrder.receipt.order_id});
 await rpc(t.operator,'save_current_hotel_fb',{p_kind:'item',p_id:t.item.id,p_expected_revision:t.item.revision,p_values:{name:'Nome atualizado',price_amount_minor:9900}});
 assert.deepEqual(await rpc(t.admin,'get_current_hotel_fb_order',{p_order_id:comboOrder.receipt.order_id}),unchanged);checksPush('editing live item never changes snapshots');
 const stalePrice=await boundary.confirm({...t.confirmInput,key:randomUUID(),intent:optionIntent,expectedTotalMinor:5250});
 check(!stalePrice.ok&&stalePrice.status===409,'price changed after quote needs reconfirmation');
 // This separate catalogue fixture is deleted using A's own authenticated RPC.
 const dm=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'menu',p_id:null,p_expected_revision:0,p_values:{name:'Descartável',is_published:true}});
 const dc=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'category',p_id:null,p_expected_revision:0,p_values:{name:'Descartável',menu_id:dm.id,is_published:true}});
 const di=await rpc(t.operator,'save_current_hotel_fb',{p_kind:'item',p_id:null,p_expected_revision:0,p_values:{name:'Snapshot preservado',category_id:dc.id,price_amount_minor:100,currency:'BRL',is_published:true}});
 await rpc(t.operator,'save_current_hotel_fb',{p_kind:'outlet',p_id:t.outlet.id,p_expected_revision:t.outlet.revision,p_values:{menu_ids:[t.menu.id,dm.id]}});
 const ds=await make(t,baseIntent(t,{lines:[{kind:'item',id:di.id,menu_id:dm.id,quantity:1}]}));
 await rpc(t.operator,'delete_current_hotel_fb',{p_kind:'menu',p_id:dm.id,p_expected_revision:dm.revision});
 const history=await boundary.status(t.slug,ds.receipt.accessSecret);check(history.ok&&history.data.lines[0].name==='Snapshot preservado','A hard delete keeps order readable');
 // Direct SQL fault after early inserts: the service transaction must roll back all.
 const body=baseIntent(tenants[5],{note:'Observação privada'});
 const sess=await boundary.beginSession(tenants[5].slug),key=randomUUID(),access=deriveOrderAccessSecret(sess.data.secret,tenants[5].slug,tenants[5].outlet.id,key);
 const args={p_hotel_slug:tenants[5].slug,p_session_secret:sess.data.secret,p_key:key,p_outlet_id:tenants[5].outlet.id,p_intent:body,p_room_token:null,p_access_digest:orderSecretDigest(access),p_expected_total_minor:2500,p_expected_currency:'BRL'};
 const beforeFacts=count('orders',tenants[5].id);
 labSql("create function fb_order_private.b1_fixture_fail() returns trigger language plpgsql as $$ begin raise exception 'fixture_rollback'; end $$;create trigger b1_fixture_fail before insert on fb_order_private.order_events for each row execute function fb_order_private.b1_fixture_fail();");
 try{await deny(server,'confirm_fb_order',args,'P0001','late failure rejects transaction');}finally{labSql('drop trigger b1_fixture_fail on fb_order_private.order_events;drop function fb_order_private.b1_fixture_fail();');}
 check(count('orders',tenants[5].id)===beforeFacts&&query("select count(*)::text from fb_order_private.idempotency where key_id="+literal(key))===0,'failure leaves no order or success key');
 const recovered=await rpc(server,'confirm_fb_order',args);check(!recovered.replayed,'same key creates after genuine rollback');
 const lost=await rpc(server,'confirm_fb_order',args);check(lost.replayed&&lost.order_id===recovered.order_id,'discarded committed response is recoverable');
 // Pending cancellation after operational acceptance; no hidden state regression.
 const pendingOrder=await make(tenants[5]),pg=groups(pendingOrder.receipt.order_id)[0];
 await rpc(tenants[5].admin,'transition_current_hotel_fb_order_group',{p_group_id:pg.id,p_expected_revision:1,p_status:'accepted'});
 const cancel=await boundary.requestCancellation(tenants[5].slug,pendingOrder.receipt.accessSecret,2);check(!cancel.ok,'post-accept guest request disabled');const historical=historicalCancellation(tenants[5],pendingOrder.receipt.order_id);
 await rpc(tenants[5].admin,'decide_current_hotel_fb_order_cancellation',{p_request_id:historical.id,p_expected_revision:1,p_order_revision:2,p_approve:true,p_reason_code:'guest_request'});
 check(order(pendingOrder.receipt.order_id).status==='cancelled','authorized cancellation changes whole order');
 await deny(tenants[5].admin,'transition_current_hotel_fb_order_group',{p_group_id:pg.id,p_expected_revision:3,p_status:'accepted'},'22023','cancelled group cannot revive');
 // Expiration is enforced in reads, even before maintenance runs.
 const exp=await make(tenants[5],baseIntent(tenants[5],{note:'PII de teste',lines:[{kind:'item',id:tenants[5].item.id,menu_id:tenants[5].menu.id,quantity:1,note:'Nota privada'}]}));
 labSql("update fb_order_private.orders set created_at=clock_timestamp()-interval '8 days' where id="+literal(exp.receipt.order_id)+";update fb_order_private.order_private_data set expires_at=clock_timestamp()-interval '1 second' where order_id="+literal(exp.receipt.order_id)+";update fb_order_private.order_line_notes set expires_at=clock_timestamp()-interval '1 second' where order_id="+literal(exp.receipt.order_id)+";update fb_order_private.order_access_tokens set expires_at=clock_timestamp()-interval '1 second' where order_id="+literal(exp.receipt.order_id));
 const expiredPii=await rpc(tenants[5].admin,'get_current_hotel_fb_order_pii',{p_order_id:exp.receipt.order_id});check(!expiredPii.first_name&&expiredPii.line_notes.length===0,'expired PII invisible before purge');
 check(!(await boundary.status(tenants[5].slug,exp.receipt.accessSecret)).ok,'expired opaque token denied');
 const purged=await rpc(server,'purge_expired_fb_order_data',{p_batch:1000});check(purged.pii>=1&&purged.notes>=1&&purged.alerts>=1,'maintenance expunges PII and alerts unclosed orders');
 check(order(exp.receipt.order_id).status==='registered','retention alert does not fake delivery/cancellation');
 check(query("select count(*)::text from fb_order_private.order_private_data where order_id="+literal(exp.receipt.order_id))===0,'PII physically expunged');
 labSql("update fb_order_private.orders set retain_until=clock_timestamp()-interval '1 second' where id="+literal(exp.receipt.order_id));
 const factsPurged=await rpc(server,'purge_expired_fb_order_data',{p_batch:1000});check(factsPurged.facts>=1&&query("select count(*)::text from fb_order_private.orders where id="+literal(exp.receipt.order_id))===0,'180-day fact expiry via restricted retention path');
 // Mutation/append-only protections against accidental owner-side edits as well.
 let immutable=false;try{labSql("update fb_order_private.order_lines set name='Changed' where order_id="+literal(comboOrder.receipt.order_id));}catch{immutable=true;}check(immutable,'snapshot update trigger rejects even accidental owner edit');
 let appendOnly=false;try{labSql("delete from fb_order_private.order_events where order_id="+literal(comboOrder.receipt.order_id));}catch{appendOnly=true;}check(appendOnly,'history deletion denied outside retention');
 // Admission is atomic and is separate from AirLabs. No raw room/IP token columns.
 const digest=orderSecretDigest(opaqueOrderSecret());
 const admitted=await Promise.all(Array.from({length:12},()=>rpc(server,'admit_fb_order_attempt',{p_hotel_slug:tenants[5].slug,p_scope:'session',p_digest:digest})));
 check(admitted.filter(Boolean).length===5,'distributed concurrent admission exact cap');
 const expiredKey=await make(tenants[1]);
 labSql("update fb_order_private.idempotency set expires_at=clock_timestamp()-interval '1 second' where key_id="+literal(expiredKey.input.key));
 const keyRetry=await boundary.confirm(expiredKey.input);check(!keyRetry.ok&&keyRetry.status===410,'expired idempotency key cannot create a duplicate');
 const expiredSession=await make(tenants[1]);
 labSql("update fb_order_private.guest_sessions set expires_at=clock_timestamp()-interval '1 second' where secret_digest="+literal(orderSecretDigest(expiredSession.input.session)));
 check((await boundary.confirm(expiredSession.input)).ok,'expired session can recover its valid committed idempotency result');
 const newAttempt=await boundary.confirm({...expiredSession.input,key:randomUUID()});check(!newAttempt.ok&&newAttempt.status===410,'expired session cannot open a new order');
 check(!query("select exists(select 1 from information_schema.columns where table_schema='fb_order_private' and column_name in('room_token','ip_address','secret','password','email','phone','cpf'))"),'no raw credentials/network/contact fields');
 const eventBody=query("select coalesce(jsonb_agg(metadata),'[]') from fb_order_private.order_events");
 check(!/Pessoa|Sintética|PII de teste|Nota privada|F-01/.test(JSON.stringify(eventBody)),'operational event metadata has no guest PII');
 const {verifyB1LostResponse}=await import('./fb-b1-lost-response.mjs');
 await verifyB1LostResponse({state,t:tenants[0],boundary,baseIntent,check,query});
 writeFileSync(join(state.dir,'b1-schema-proof.json'),JSON.stringify({tables,appendOnly,immutable,privateSchemaExposed:false,externalAPIsUsed:false},null,2));
 console.log('B1 options/combo/calendar/rollback/retention matrix completed.');
}
