-- LOCAL ONLY. The runner applies migrations and this matrix in a single rollback transaction.
create function pg_temp.expect_error(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected_state then return; end if;
    raise exception 'Expected %, got %: %',expected_state,sqlstate,sqlerrm;
  end;
  raise exception 'Expected failure %',expected_state;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
('ea000000-0000-4000-8000-000000000001','Test target','Recife','admin-lab-target','adminlabtarget','suspended'),
('ea000000-0000-4000-8000-000000000002','Other hotel','Recife','admin-lab-other','adminlabother','active'),
('ea000000-0000-4000-8000-000000000003','Archived','Recife','admin-lab-archived','adminlabarchived','archived');
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('ea100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated',
 'admin-lab-'||n||'@example.invalid',now(),
 jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'platform_hotel_admin',
 jsonb_build_object('operation_id','ea200000-0000-4000-8000-000000000001','hotel_id','ea000000-0000-4000-8000-000000000001','actor_id','ea100000-0000-4000-8000-000000000001')),
 '{}',now(),now() from generate_series(1,12) n;
delete from public.profiles where email like 'admin-lab-%@example.invalid';
insert into public.platform_users(user_id,role,is_active) values
('ea100000-0000-4000-8000-000000000001','platform_admin',true),
('ea100000-0000-4000-8000-000000000002','platform_admin',false);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
('ea100000-0000-4000-8000-000000000003','admin-lab-3@example.invalid','Preserved admin','administrador','ea000000-0000-4000-8000-000000000001',true),
('ea100000-0000-4000-8000-000000000004','admin-lab-4@example.invalid','Other admin','administrador','ea000000-0000-4000-8000-000000000002',true),
('ea100000-0000-4000-8000-000000000005','admin-lab-5@example.invalid','Ordinary user','visualizador','ea000000-0000-4000-8000-000000000001',true);
create temporary table original_hotels as select * from public.hotels;
create temporary table original_modules as select * from public.hotel_module_entitlements;
create temporary table original_profiles as select * from public.profiles;

set local role anon;
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','fresh@example.invalid')$s$,'42501');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin(null,null,null,null,null)$s$,'42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','fresh@example.invalid')$s$,'42501');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin(null,null,null,null,null)$s$,'42501');
do $$ declare n integer; begin
  foreach n in array array[2,3,5] loop
    perform set_config('request.jwt.claim.sub','ea100000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
    perform pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','fresh@example.invalid')$s$,'42501');
    perform pg_temp.expect_error($s$select public.add_platform_hotel_admin(null,null,null,null,null)$s$,'42501');
  end loop;
end $$;
select set_config('request.jwt.claim.sub','ea100000-0000-4000-8000-000000000001',true);
select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','fresh@example.invalid');
select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000002','fresh@example.invalid');
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000003','fresh@example.invalid')$s$,'55000');
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000099','fresh@example.invalid')$s$,'P0002');
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','ADMIN-LAB-4@example.invalid')$s$,'23505');
select pg_temp.expect_error($s$select public.check_platform_hotel_admin_creation('ea000000-0000-4000-8000-000000000001','bad')$s$,'22023');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000006','admin-lab-6@example.invalid','Test','ea200000-0000-4000-8000-000000000099')$s$,'42501');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000002','ea100000-0000-4000-8000-000000000006','admin-lab-6@example.invalid','Test','ea200000-0000-4000-8000-000000000001')$s$,'42501');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000004','admin-lab-4@example.invalid','Test','ea200000-0000-4000-8000-000000000001')$s$,'23505');
select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000006','admin-lab-6@example.invalid','New Admin','ea200000-0000-4000-8000-000000000001');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000006','admin-lab-6@example.invalid','New Admin','ea200000-0000-4000-8000-000000000001')$s$,'23505');
reset role;
-- Missing trusted app metadata cannot be replaced by user-editable metadata.
update auth.users set raw_user_meta_data=raw_app_meta_data,raw_app_meta_data='{}'
 where id='ea100000-0000-4000-8000-000000000009';
set local role authenticated;
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000009','admin-lab-9@example.invalid','Untrusted','ea200000-0000-4000-8000-000000000001')$s$,'42501');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000003','ea100000-0000-4000-8000-000000000010','admin-lab-10@example.invalid','Archived','ea200000-0000-4000-8000-000000000001')$s$,'55000');
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000099','ea100000-0000-4000-8000-000000000010','admin-lab-10@example.invalid','Missing','ea200000-0000-4000-8000-000000000001')$s$,'P0002');
reset role;
-- Auth hooks may create an unbound profile; that one identity is safe to complete.
insert into public.profiles(id,email,full_name,hotel_id) values
('ea100000-0000-4000-8000-000000000007','admin-lab-7@example.invalid','Hook',null);
set local role authenticated;
select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000007','admin-lab-7@example.invalid','Hook Admin','ea200000-0000-4000-8000-000000000001');
reset role;
-- A failed audit must roll back the profile in the same statement.
create function pg_temp.reject_admin_audit() returns trigger language plpgsql as $$ begin
 if new.action='hotel.admin_added' then raise exception using errcode='P0001',message='synthetic_audit_failure'; end if; return new; end $$;
create trigger synthetic_admin_audit_failure before insert on public.platform_audit_log for each row execute function pg_temp.reject_admin_audit();
set local role authenticated;
select pg_temp.expect_error($s$select public.add_platform_hotel_admin('ea000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000008','admin-lab-8@example.invalid','Audit Failure','ea200000-0000-4000-8000-000000000001')$s$,'P0001');
reset role;
drop trigger synthetic_admin_audit_failure on public.platform_audit_log;
do $$ begin
 assert not exists(select 1 from public.profiles where id='ea100000-0000-4000-8000-000000000008'), 'audit failure leaked profile';
 assert (select count(*) from public.platform_audit_log where action='hotel.admin_added' and entity_id='ea000000-0000-4000-8000-000000000001')=2, 'audit not atomic';
 assert not exists(select 1 from original_profiles o full join public.profiles p using(id) where o.id is not null and to_jsonb(o) is distinct from to_jsonb(p)), 'existing profile changed';
 assert not exists((select * from original_hotels except select * from public.hotels) union all (select * from public.hotels except select * from original_hotels)), 'hotel changed';
 assert not exists((select * from original_modules except select * from public.hotel_module_entitlements) union all (select * from public.hotel_module_entitlements except select * from original_modules)), 'modules changed';
 assert not has_function_privilege('service_role','public.add_platform_hotel_admin(uuid,uuid,text,text,uuid)','execute'), 'service_role bypass';
 assert not has_function_privilege('authenticated','public.assert_platform_hotel_admin_target(uuid)','execute'), 'internal helper exposed';
 assert not exists(select 1 from public.platform_audit_log where action='hotel.admin_added' and (metadata ? 'email' or metadata ? 'password' or metadata ? 'full_name')), 'sensitive audit';
end $$;
rollback;