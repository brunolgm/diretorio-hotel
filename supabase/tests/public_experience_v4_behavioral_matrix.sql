-- Synthetic disposable fixtures only. Runtime writer and all original policies unchanged.
update public.profiles set role='editor' where id='52110000-0000-4000-8000-000000000002';
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
 values('52100000-0000-4000-8000-000000000001','experience.appearance',true,now())
 on conflict(hotel_id,module_key) do update set is_enabled=true;
create temporary table v4_protected as
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
do $$ declare config jsonb:='{"version":1,"heroTitleMode":"hotel_name","heroDesktopFocal":{"x":50,"y":0},"benefits":[],"tourism":{"title":{"pt":"","en":"","es":""},"description":{"pt":"","en":"","es":""},"cards":[]}}'; begin
 assert public.save_current_hotel_public_presentation(0,config)=1,'old V3 rejected';
 assert (select not(configuration ? 'experienceVersion') from public.hotel_public_presentation),'default must remain V3';
 assert public.save_current_hotel_public_presentation(1,config||'{"experienceVersion":"v4"}')=2;
 assert (select configuration->>'experienceVersion'='v4' from public.hotel_public_presentation);
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(1,%L)',config||'{"experienceVersion":"v4"}'),'PT409');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(2,%L)',config||'{"experienceVersion":"v5"}'),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(2,%L)',config||'{"experienceVersion":null}'),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(2,%L)',config||'{"experienceVersion":4}'),'22023');
 perform pg_temp.expect_error(format('select public.save_current_hotel_public_presentation(2,%L)',config||'{"experienceVersion":"v4","hotel_id":"other"}'),'22023');
 assert public.save_current_hotel_public_presentation(2,config||'{"experienceVersion":"v3"}')=3,'revert to V3';
 assert public.save_current_hotel_public_presentation(3,config)=4,'remove selector safely';
 assert (select count(*)=1 from public.hotel_public_presentation),'other hotel auto-provisioned';
end $$;
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.save_current_hotel_public_presentation(4,'{}')$s$,'42501');
reset role;
do $$ begin
 assert (select count(*)=4 from public.admin_audit_log where action='experience.presentation_updated');
 assert (select digest from v4_protected where key='hotels')=(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.hotels t);
 assert (select digest from v4_protected where key='profiles')=(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.profiles t);
 assert (select digest from v4_protected where key='modules')=(select md5(jsonb_agg(to_jsonb(t) order by hotel_id,module_key)::text) from public.hotel_module_entitlements t);
 assert not has_table_privilege('authenticated','public.hotel_public_presentation','UPDATE');
 assert not has_function_privilege('service_role','public.save_current_hotel_public_presentation(integer,jsonb)','EXECUTE');
end $$;
rollback;
