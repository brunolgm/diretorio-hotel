-- LOCAL synthetic data only. Whole runner rolls back.
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) select h,k,true,now() from unnest(array['52100000-0000-4000-8000-000000000001'::uuid,'52100000-0000-4000-8000-000000000002'::uuid]) h cross join unnest(array['core.directory','content.services','content.languages']) k on conflict(hotel_id,module_key) do update set is_enabled=true;
create temporary table guide_fixture(service_id uuid,revision integer);grant all on guide_fixture to authenticated,anon;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.expect_error($q$select * from public.get_current_hotel_service_guide(gen_random_uuid())$q$,'42501');reset role;
set local role anon;select pg_temp.expect_error($q$select * from public.get_current_hotel_service_guide(gen_random_uuid())$q$,'42501');select pg_temp.expect_error($q$select * from public.hotel_service_guides$q$,'42501');reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);set local role authenticated;
do $$ declare c jsonb:='{"version":1,"category":"tv","applicability":{"scope":"unconfirmed","label":{"pt":"","en":"","es":""},"categories":[]},"steps":[],"channels":[],"source":{"url":null,"sha256":null},"manual_url":null}';s uuid;r integer;s2 uuid;begin
 select service_id,revision into s,r from public.create_current_hotel_room_guide('fixture-tv','{"pt":"TV local","en":"Local TV","es":"TV local"}','{"pt":"Instruções sintéticas locais para o equipamento de televisão, sem representar um quarto real.","en":"Local synthetic television instructions, not representing a real hotel room or equipment.","es":"Instrucciones locales sintéticas para televisión, sin representar un equipo o cuarto real."}',c);assert r=1;
 insert into guide_fixture values(s,r);
 assert (select enabled=false from public.hotel_sections where id=s);
 select service_id into s2 from public.create_current_hotel_room_guide('fixture-tv','{"pt":"Outro","en":"Other","es":"Otro"}','{"pt":"Descrição","en":"Description","es":"Descripción"}',c);assert s2=s;assert (select title='TV local' from public.hotel_sections where id=s),'idempotency must not rewrite parent';
 perform pg_temp.expect_error(format('insert into public.hotel_service_guides(service_id,hotel_id,draft,revision) values(%L,%L,%L,1)',gen_random_uuid(),'52100000-0000-4000-8000-000000000001',c),'42501');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,0,%L,false,false)',s,c),'PT409');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,1,%L,true,true)',s,c),'22023');
 c:=jsonb_set(c,'{applicability,scope}','"all"');c:=jsonb_set(c,'{steps}','[{"key":"first","title":{"pt":"Ligue","en":"Turn on","es":"Encienda"},"body":{"pt":"Instrução local revisada.","en":"Reviewed local instruction.","es":"Instrucción local revisada."},"image_path":null,"alt":{"pt":"","en":"","es":""}}]');
 c:=jsonb_set(c,'{channels}','[{"number":"18","name":"Globo","quality":"unspecified","category":null,"kind":"linear"},{"number":"501","name":"Globo HD","quality":"HD","category":null,"kind":"linear"},{"number":"680","name":"Netflix","quality":"unspecified","category":null,"kind":"application"}]');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,1,%L,true,true)',s,c),'22023');
 update public.hotel_sections set enabled=true where id=s;
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,1,%L,true,false)',s,c),'22023');
 select revision into r from public.save_current_hotel_service_guide(s,1,c,true,true);assert r=2;assert (select count(*)=1 from public.get_current_hotel_published_service_guides(s));
 c:=jsonb_set(c,'{steps,0,body,pt}','"Alteração em rascunho"');select revision into r from public.save_current_hotel_service_guide(s,2,c,false,false);assert r=3;
 assert (select published#>>'{steps,0,body,pt}'='Instrução local revisada.' from public.hotel_service_guides where service_id=s),'draft must preserve published';
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{steps,0,image_path}','"other/room-guides/file.png"')),'22023');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{steps,0,image_path}',to_jsonb('52100000-0000-4000-8000-000000000001/room-guides/'||s::text||'/52130000-0000-4000-8000-000000000001.png'))),'22023');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{version}','"1"')),'22023');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{category}','null')),'22023');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{channels,0,quality}','null')),'22023');
 perform pg_temp.expect_error(format('select * from public.save_current_hotel_service_guide(%L,3,%L,false,false)',s,jsonb_set(c,'{channels,2,kind}','"linear"')),'22023');
end $$;
reset role;set local role anon;
do $$ declare s uuid:=(select service_id from guide_fixture);c jsonb;begin
 select configuration into c from public.get_public_hotel_service_guides('52100000-0000-4000-8000-000000000001',s);assert c#>>'{steps,0,body,pt}'='Instrução local revisada.';assert (select count(*)=0 from public.get_public_hotel_service_guides('52100000-0000-4000-8000-000000000002',s));
 select configuration into c from public.get_public_hotel_service_guides('52100000-0000-4000-8000-000000000001');assert not(c?'channels') and not(c?'steps'),'summary must not ship the whole catalog';
end $$;reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000003',true);set local role authenticated;
do $$ declare s uuid:=(select service_id from guide_fixture);begin assert (select count(*)=0 from public.hotel_service_guides where service_id=s);perform pg_temp.expect_error(format('select * from public.get_current_hotel_service_guide(%L)',s),'42501');end $$;reset role;
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.services';
set local role anon;do $$ begin assert (select count(*)=0 from public.get_public_hotel_service_guides('52100000-0000-4000-8000-000000000001'));end $$;reset role;
update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.services';
update public.hotels set platform_status='suspended' where id='52100000-0000-4000-8000-000000000001';
set local role anon;do $$ begin assert (select count(*)=0 from public.get_public_hotel_service_guides('52100000-0000-4000-8000-000000000001'));end $$;reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);set local role authenticated;do $$ begin assert (select count(*)=1 from public.get_current_hotel_published_service_guides()),'own authenticated preview must work while suspended';end $$;reset role;
do $$begin assert not has_table_privilege('anon','public.hotel_service_guides','SELECT');assert not has_table_privilege('authenticated','public.hotel_service_guides','INSERT');assert not has_function_privilege('service_role','public.save_current_hotel_service_guide(uuid,integer,jsonb,boolean,boolean)','EXECUTE');assert exists(select 1 from public.admin_audit_log where action='service.guide_published');end $$;
-- A real local Storage row is required before association; drafts retain historical media.
insert into storage.buckets(id,name,public) values('hotel-assets','hotel-assets',true) on conflict(id) do nothing;
insert into storage.objects(bucket_id,name,metadata) select 'hotel-assets','52100000-0000-4000-8000-000000000001/room-guides/'||service_id::text||'/52140000-0000-4000-8000-000000000001.webp','{"mimetype":"image/webp"}'::jsonb from guide_fixture;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);set local role authenticated;
do $$declare s uuid:=(select service_id from guide_fixture);c jsonb;r integer;begin
 select draft into c from public.hotel_service_guides where service_id=s;
 c:=jsonb_set(c,'{steps,0,image_path}',to_jsonb('52100000-0000-4000-8000-000000000001/room-guides/'||s::text||'/52140000-0000-4000-8000-000000000001.webp'));
 select revision into r from public.save_current_hotel_service_guide(s,3,c,false,false);assert r=4;
 assert (select cardinality(media_paths)=1 from public.hotel_service_guides where service_id=s);
 c:=jsonb_set(c,'{steps,0,image_path}','null');perform public.save_current_hotel_service_guide(s,4,c,false,false);
 assert (select cardinality(media_paths)=1 from public.hotel_service_guides where service_id=s),'retain paths for post-delete cleanup';
end $$;reset role;
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.languages';
set local role authenticated;do $$begin assert (select count(*)=0 from public.get_current_hotel_published_service_guides());perform pg_temp.expect_error(format('select * from public.get_current_hotel_service_guide(%L)',(select service_id from guide_fixture)),'42501');end $$;reset role;
rollback;
