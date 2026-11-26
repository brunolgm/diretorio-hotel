// Real local Auth/PostgREST/PostgreSQL only. No orders or printing endpoints.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {seedB23,rpc} from './fb-b23-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {literal,rows} from './fb-local-seed.mjs';

const checks=[];
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const lab=await seedB23(),t=lab.tenants.find(x=>x.brand==='bugan');assert.ok(t);
labSql('update public.hotels set slug=\'bugan-recife\' where id='+literal(t.id)+';'+
 'update public.hotel_fb_items set short_description=\'Descrição original do laboratório\' where hotel_id='+literal(t.id)+';'+
 'update fb_order_private.combos set room_outlet_id='+literal(t.room.id)+' where hotel_id='+literal(t.id)+';'+
 'update fb_order_private.modifier_groups set room_outlet_id='+literal(t.room.id)+' where hotel_id='+literal(t.id)+';');
t.slug='bugan-recife';
const snapshot=()=>rows("select jsonb_build_object('items',(select jsonb_agg(to_jsonb(x)-'name'-'short_description'-'full_description'-'revision'-'source_revision'-'updated_at' order by id) from public.hotel_fb_items x where hotel_id="+literal(t.id)+"),'categories',(select jsonb_agg(to_jsonb(x)-'name'-'description'-'revision'-'source_revision'-'updated_at' order by id) from public.hotel_fb_categories x where hotel_id="+literal(t.id)+"),'combos',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.combos x where hotel_id="+literal(t.id)+"),'slots',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.combo_slots x where hotel_id="+literal(t.id)+"),'groups',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.modifier_groups x where hotel_id="+literal(t.id)+"),'options',(select jsonb_agg(to_jsonb(x) order by id) from fb_order_private.modifier_options x where hotel_id="+literal(t.id)+"))");
const before=snapshot();
const legacy=await rpc(t.admin,'get_current_bugan_room_names');
check(legacy.every(row=>!['item_description','category'].includes(row.kind)),'legacy client stays name-only');
const initial=await rpc(t.admin,'get_current_bugan_room_texts');
check(initial.length>legacy.length,'expanded editor contains existing names and editorial fields');
for(const kind of ['item_description','category']){
 const source=initial.find(row=>row.kind===kind);check(Boolean(source),'source '+kind);
 const args={p_kind:kind,p_id:source.id,p_source_name:source.source_name,p_revision:0,p_name_en:kind==='item_description'?'Edited description\nSecond line':'Edited category',p_name_es:kind==='item_description'?'Descripción editada\nSegunda línea':'Categoría editada'};
 check(await rpc(t.admin,'save_current_bugan_room_text_translation',args)===1,'authenticated save '+kind);
 const persisted=(await rpc(t.admin,'get_current_bugan_room_texts')).find(row=>row.kind===kind&&row.id===source.id);
 check(persisted.name_en===args.p_name_en&&persisted.name_es===args.p_name_es&&persisted.revision===1,'reload persisted '+kind);
 const stale=await t.admin.client.rpc('save_current_bugan_room_text_translation',args);
 check(stale.error?.code==='PT409','CAS conflict '+kind);
 const old=await t.admin.client.rpc('save_current_bugan_room_name_translation',args);
 check(old.error?.code==='22023','legacy save cannot edit '+kind);
 const limit=kind==='item_description'?10000:160;
 check(await rpc(t.admin,'save_current_bugan_room_text_translation',{...args,p_revision:1,p_name_en:'x'.repeat(limit)})===2,'exact maximum '+kind);
 const tooLong=await t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:2,p_name_en:'x'.repeat(limit+1)});
 check(tooLong.error?.code==='22023','length boundary '+kind);
 const control=await t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:2,p_name_en:'Text\u0007'});
 check(control.error?.code==='22023','control character rejected '+kind);
 if(kind==='category'){
  const newline=await t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:2,p_name_en:'Title\nsecond line'});
  check(newline.error?.code==='22023','category newline rejected');
 }
 check(await rpc(t.admin,'save_current_bugan_room_text_translation',{...args,p_revision:2,p_name_en:kind==='item_description'?' \n\t ':'   ',p_name_es:''})===3,'clear '+kind);
 const cleared=(await rpc(t.admin,'get_current_bugan_room_texts')).find(row=>row.kind===kind&&row.id===source.id);
 check(cleared.name_en===null&&cleared.name_es===null,'original-text fallback persisted '+kind);
 check(await rpc(t.admin,'save_current_bugan_room_text_translation',{...args,p_revision:3})===4,'restore edited text '+kind);
 const original=source.source_name;
 const table=kind==='category'?'public.hotel_fb_categories':'public.hotel_fb_items';
 const field=kind==='category'?'name':'short_description';
 labSql('update '+table+' set '+field+'=\'Fonte alterada no laboratório\' where hotel_id='+literal(t.id)+' and id='+literal(source.id));
 const changed=await t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:4});
 check(changed.error?.code==='PT409','changed source rejected '+kind);
 labSql('update '+table+' set '+field+'='+literal(original)+' where hotel_id='+literal(t.id)+' and id='+literal(source.id));
 const concurrent=await Promise.all([t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:4}),t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_revision:4})]);
 check(concurrent.filter(r=>r.data===5).length===1&&concurrent.filter(r=>r.error?.code==='PT409').length===1,'one concurrent editor wins '+kind);
}
for(const source of legacy.filter(row=>['item','combo','combo_slot','modifier_group','modifier_option'].includes(row.kind)).filter((row,index,all)=>all.findIndex(r=>r.kind===row.kind)===index)){
 const revision=await rpc(t.admin,'save_current_bugan_room_text_translation',{p_kind:source.kind,p_id:source.id,p_source_name:source.source_name,p_revision:source.revision,p_name_en:'Legacy English',p_name_es:'Nombre anterior'});
 check(revision===1,'existing name saving retained '+source.kind);
}
const description=initial.find(row=>row.kind==='item_description');
const args={p_kind:description.kind,p_id:description.id,p_source_name:description.source_name,p_revision:5,p_name_en:'Edited description\nSecond line',p_name_es:'Descripción editada\nSegunda línea'};
for(const other of lab.tenants.filter(x=>x!==t)){
 check((await other.admin.client.rpc('get_current_bugan_room_texts')).error?.code==='42501','foreign editor read denied '+other.brand);
 check((await other.admin.client.rpc('save_current_bugan_room_text_translation',args)).error?.code==='42501','foreign editor write denied '+other.brand);
}
for(const actor of [t.reader,t.operator]){
 check((await actor.client.rpc('get_current_bugan_room_texts')).error?.code==='42501','insufficient role/capability read denied');
 check((await actor.client.rpc('save_current_bugan_room_text_translation',args)).error?.code==='42501','insufficient role/capability write denied');
}
for(const [kind,id]of [['item_description',lab.tenants[0].item.id],['category',lab.tenants[0].category.id]])
 check((await t.admin.client.rpc('save_current_bugan_room_text_translation',{...args,p_kind:kind,p_id:id,p_revision:0,p_name_en:'English',p_name_es:'Español'})).error?.code==='42501','foreign record denied '+kind);
const read=await lab.project.rpc('get_bugan_room_text_translations',{p_hotel_id:t.id,p_outlet_id:t.room.id});
check(!read.error&&read.data.some(row=>row.kind==='category'&&row.revision===5)&&read.data.some(row=>row.kind==='item_description'&&row.revision===5),'service reads saved editorial rows');
const filipe=await lab.project.rpc('get_bugan_room_text_translations',{p_hotel_id:t.id,p_outlet_id:t.outlet.id});
check(!filipe.error&&filipe.data.length===0,'Filipe with shared menu excluded');
check(Boolean((await t.admin.client.rpc('get_bugan_room_text_translations',{p_hotel_id:t.id,p_outlet_id:t.room.id})).error),'browser cannot call service read');
const acl=rows("select jsonb_build_object('rls',relrowsecurity,'forced',relforcerowsecurity,'browser_read',has_table_privilege('authenticated','fb_order_private.room_name_translations','select'),'browser_write',has_table_privilege('authenticated','fb_order_private.room_name_translations','update'),'anon_get',has_function_privilege('anon','public.get_current_bugan_room_texts()','execute'),'anon_save',has_function_privilege('anon','public.save_current_bugan_room_text_translation(text,uuid,text,integer,text,text)','execute')) from pg_class where oid='fb_order_private.room_name_translations'::regclass");
check(acl.rls&&acl.forced&&!acl.browser_read&&!acl.browser_write&&!acl.anon_get&&!acl.anon_save,'private RLS and RPC grants preserved');
const legacyAfter=await rpc(t.admin,'get_current_bugan_room_names');
check(legacyAfter.length===legacy.length&&legacyAfter.every(row=>!['item_description','category'].includes(row.kind)),'legacy read contract unchanged after saves');
assert.deepEqual(snapshot(),before);check(true,'prices and commercial rules unchanged');
check(rows('select count(*)::int from fb_order_private.orders')===0,'zero orders');
const directory=join(lab.s.dir,'room-editorial-admin');mkdirSync(directory,{recursive:true});
const report={passed:checks.length,checks,pricesAndRulesUnchanged:true,ordersSent:0};
writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));
writeFileSync(join(directory,'ui-session.json'),JSON.stringify({email:t.admin.email,password:t.admin.password}));
writeFileSync(join(directory,'ui-rows.json'),JSON.stringify(await rpc(t.admin,'get_current_bugan_room_texts'),null,2));
console.log(JSON.stringify({passed:checks.length,ordersSent:0,pricesAndRulesUnchanged:true,directory}));
