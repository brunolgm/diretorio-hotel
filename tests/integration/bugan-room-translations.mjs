// Disposable offline Supabase only. No order or printing endpoints are invoked.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {seedB23,rpc} from './fb-b23-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {literal,rows} from './fb-local-seed.mjs';
const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};

// The lab may already have the initial migration while this function is being iterated.
const migration=readFileSync('supabase/migrations/20261126025236_bugan_room_name_translations.sql','utf8');
const start=migration.indexOf('create function fb_order_private.room_name_rows');
const end=migration.indexOf('$$;',start)+3;
labSql(migration.slice(start,end).replace('create function','create or replace function'));
const lab=await seedB23(),t=lab.tenants.find(x=>x.brand==='bugan');
assert.ok(t);
labSql('update public.hotels set slug=\'bugan-recife\' where id='+literal(t.id)+';'+
 'update fb_order_private.combos set room_outlet_id='+literal(t.room.id)+' where hotel_id='+literal(t.id)+';'+
 'update fb_order_private.modifier_groups set room_outlet_id='+literal(t.room.id)+' where hotel_id='+literal(t.id)+';');
t.slug='bugan-recife';
const snapshot=()=>rows("select jsonb_build_object('items',(select jsonb_agg(to_jsonb(x)-'name'-'revision'-'source_revision'-'updated_at' order by id) from public.hotel_fb_items x where hotel_id="+literal(t.id)+"),'combos',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.combos x where hotel_id="+literal(t.id)+"),'slots',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.combo_slots x where hotel_id="+literal(t.id)+"),'groups',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.modifier_groups x where hotel_id="+literal(t.id)+"),'options',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.modifier_options x where hotel_id="+literal(t.id)+'))');
const before=snapshot();
const initial=await rpc(t.admin,'get_current_bugan_room_names');
for(const kind of ['item','combo','combo_slot','modifier_group','modifier_option']){
 const source=initial.find(row=>row.kind===kind);check(Boolean(source),'source '+kind);
 const args={p_kind:kind,p_id:source.id,p_source_name:source.source_name,p_revision:0,p_name_en:'Edited '+kind,p_name_es:'Editado '+kind};
 check(await rpc(t.admin,'save_current_bugan_room_name_translation',args)===1,'save '+kind);
 const persisted=(await rpc(t.admin,'get_current_bugan_room_names')).find(row=>row.kind===kind&&row.id===source.id);
 check(persisted.name_en===args.p_name_en&&persisted.name_es===args.p_name_es&&persisted.revision===1,'persist '+kind);
 const stale=await t.admin.client.rpc('save_current_bugan_room_name_translation',args);
 check(stale.error?.code==='PT409','conflict '+kind);
}
const item=(await rpc(t.admin,'get_current_bugan_room_names')).find(row=>row.kind==='item'&&row.id===initial.find(x=>x.kind==='item').id);
const args={p_kind:item.kind,p_id:item.id,p_source_name:item.source_name,p_revision:item.revision,p_name_en:'',p_name_es:''};
check(await rpc(t.admin,'save_current_bugan_room_name_translation',args)===2,'clear translations');
const cleared=(await rpc(t.admin,'get_current_bugan_room_names')).find(row=>row.id===item.id&&row.kind==='item');
check(cleared.name_en===null&&cleared.name_es===null,'explicit Portuguese fallback persisted');
const bad=await t.admin.client.rpc('save_current_bugan_room_name_translation',{...args,p_revision:2,p_name_en:'x'.repeat(161)});
check(bad.error?.code==='22023','oversized name rejected');
labSql('update public.hotel_fb_items set name=\'Nome original renomeado\' where id='+literal(item.id));
const renamed=await t.admin.client.rpc('save_current_bugan_room_name_translation',{...args,p_revision:2});
check(renamed.error?.code==='PT409','Portuguese rename requires review');
for(const other of lab.tenants.filter(x=>x!==t)){
 const denied=await other.admin.client.rpc('get_current_bugan_room_names');
 check(denied.error?.code==='42501','foreign hotel denied '+other.brand);
 const write=await other.admin.client.rpc('save_current_bugan_room_name_translation',{...args,p_revision:2});
 check(write.error?.code==='42501','foreign write denied '+other.brand);
}
for(const actor of [t.reader,t.operator]){
 const denied=await actor.client.rpc('get_current_bugan_room_names');
 check(denied.error?.code==='42501','insufficient role/capability denied');
}
const foreignSource=await t.admin.client.rpc('save_current_bugan_room_name_translation',{...args,p_id:lab.tenants[0].item.id,p_revision:0});
check(foreignSource.error?.code==='42501','foreign entity denied');
const read=await lab.project.rpc('get_bugan_room_name_translations',{p_hotel_id:t.id,p_outlet_id:t.room.id});
check(!read.error&&read.data.some(row=>row.revision>0),'service-only read returns overrides');
const filipe=await lab.project.rpc('get_bugan_room_name_translations',{p_hotel_id:t.id,p_outlet_id:t.outlet.id});
check(!filipe.error&&filipe.data.length===0,'Filipe scope empty');
const deniedRuntime=await t.admin.client.rpc('get_bugan_room_name_translations',{p_hotel_id:t.id,p_outlet_id:t.room.id});
check(Boolean(deniedRuntime.error),'browser role cannot call service RPC');
const acl=rows("select jsonb_build_object('rls',relrowsecurity,'forced',relforcerowsecurity,'browser_read',has_table_privilege('authenticated','fb_order_private.room_name_translations','select'),'browser_write',has_table_privilege('authenticated','fb_order_private.room_name_translations','update'),'service_write',has_table_privilege('service_role','fb_order_private.room_name_translations','insert')) from pg_class where oid='fb_order_private.room_name_translations'::regclass");
check(acl.rls&&acl.forced&&!acl.browser_read&&!acl.browser_write&&!acl.service_write,'private table has RLS and no direct access');
assert.deepEqual(snapshot(),before);check(true,'prices and commercial rules unchanged');
check(rows('select count(*)::int from fb_order_private.orders')===0,'zero orders');
const directory=join(lab.s.dir,'room-names');mkdirSync(directory,{recursive:true});
const report={checks,passed:checks.length,orders:0,pricingAndRulesUnchanged:true};
writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));
// Ephemeral fixture credentials stay only in the ignored local lab directory.
writeFileSync(join(directory,'ui-session.json'),JSON.stringify({email:t.admin.email,password:t.admin.password}));
writeFileSync(join(directory,'ui-rows.json'),JSON.stringify(await rpc(t.admin,'get_current_bugan_room_names'),null,2));
console.log(JSON.stringify({passed:checks.length,orders:0,directory,email:t.admin.email}));
