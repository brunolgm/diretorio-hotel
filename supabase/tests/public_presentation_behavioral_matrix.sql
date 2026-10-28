-- Disposable fixture IDs only. Rollback at end; never run against production.
update public.profiles set role='editor' where id='52110000-0000-4000-8000-000000000002';
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
 values('52100000-0000-4000-8000-000000000001','experience.appearance',true,now())
 on conflict(hotel_id,module_key) do update set is_enabled=true;
create temporary table presentation_protected_before as
 select 'hotels' key,md5(jsonb_agg(to_jsonb(t) order by id)::text) digest from public.hotels t
 union all select 'profiles',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.profiles t
 union all select 'modules',md5(jsonb_agg(to_jsonb(t) order by hotel_id,module_key)::text) from public.hotel_module_entitlements t;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.save_current_hotel_public_presentation(0,'{}')$s$,'42501');
reset role;
set local role anon;
select pg_temp.expect_error($s$select public.save_current_hotel_public_presentation(0,'{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($s$insert into public.hotel_public_presentation values('52100000-0000-4000-8000-000000000001','{}',1)$s$,'42501');
select pg_temp.expect_error($s$select public.save_current_hotel_public_presentation(0,'{"hotel_id":"other"}')$s$,'22023');
do $$ declare config jsonb:='{"version":1,"heroTitleMode":"hotel_name","heroDesktopFocal":{"x":50,"y":0},"benefits":[{"icon":"location","label":{"pt":"Localização","en":"Location","es":"Ubicación"}}],"tourism":{"title":{"pt":"Explore","en":"Explore","es":"Explora"},"description":{"pt":"Editorial","en":"Editorial","es":"Editorial"},"cards":[{"title":{"pt":"Praia","en":"Beach","es":"Playa"},"image_path":"52100000-0000-4000-8000-000000000001/hero/editorial/52130000-0000-4000-8000-000000000001.webp"}]}}'; n integer; begin
 n:=public.save_current_hotel_public_presentation(0,config);assert n=1;
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(0,%L)',config),'PT409');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',config||'{"hotel_id":"other"}'::jsonb),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',jsonb_set(config,'{tourism,cards,0,image_path}','"other/hero/editorial/file.webp"')),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',jsonb_set(config,'{heroDesktopFocal,y}','101')),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',jsonb_set(config,'{tourism,cards}','null')),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',config#-'{tourism,cards}'),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',jsonb_set(config,'{benefits,0,label,pt}','"<script>"')),'22023');
 n:=public.save_current_hotel_public_presentation(1,config);assert n=2;
 assert (select count(*)=1 from public.hotel_public_presentation);
end $$;
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 assert not exists(select 1 from public.hotel_public_presentation where hotel_id='52100000-0000-4000-8000-000000000002');
end $$;
reset role;
update public.hotels set platform_status='suspended' where id='52100000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_public_presentation),'suspended presentation leaked'; end $$;
reset role;
update public.hotels set platform_status='active' where id='52100000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin assert (select count(*)=1 from public.hotel_public_presentation),'active presentation unavailable'; end $$;
reset role;
do $$ begin
 assert (select count(*)=2 from public.admin_audit_log where action='experience.presentation_updated');
 assert (select digest from presentation_protected_before where key='hotels')=(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.hotels t);
 assert (select digest from presentation_protected_before where key='profiles')=(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.profiles t);
 assert (select digest from presentation_protected_before where key='modules')=(select md5(jsonb_agg(to_jsonb(t) order by hotel_id,module_key)::text) from public.hotel_module_entitlements t);
 assert not has_table_privilege('authenticated','public.hotel_public_presentation','UPDATE');
 assert not has_function_privilege('service_role','public.save_current_hotel_public_presentation(integer,jsonb)','EXECUTE');
end $$;
rollback;
