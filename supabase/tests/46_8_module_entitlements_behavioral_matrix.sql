-- Disposable/local database only. Synthetic writes are isolated by BEGIN/ROLLBACK.
begin;

do $$
declare nullable_instance boolean;
begin
  if to_regclass('public.hotel_module_entitlements') is null then raise exception '46.8 behavioral preflight: migration missing'; end if;
  select is_nullable='YES' into strict nullable_instance from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id' and udt_name='uuid';
  if not nullable_instance and to_regclass('auth.instances') is null then raise exception '46.8 behavioral preflight: auth.instances missing'; end if;
  if exists(select 1 from auth.users where email like 's46-8-%@example.invalid' or id=any(array[
      '46810000-0000-4000-8000-000000000001','46810000-0000-4000-8000-000000000002',
      '46810000-0000-4000-8000-000000000003','46810000-0000-4000-8000-000000000004',
      '46810000-0000-4000-8000-000000000005']::uuid[]))
    or exists(select 1 from public.hotels where slug like 's46-8-%') then raise exception '46.8 fixture collision'; end if;
end;
$$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then insert into auth.instances select (jsonb_populate_record(null::auth.instances,jsonb_build_object('id','46820000-0000-4000-8000-000000000001','uuid','46820000-0000-4000-8000-000000000001','raw_base_config','{}','created_at',now(),'updated_at',now()))).*; end if;
end $$;

insert into public.hotels(id,name,slug,platform_status) values
 ('46800000-0000-4000-8000-000000000001','46.8 Hotel A','s46-8-hotel-a','active'),
 ('46800000-0000-4000-8000-000000000002','46.8 Hotel B','s46-8-hotel-b','active'),
 ('46800000-0000-4000-8000-000000000003','46.8 Archived','s46-8-archived','archived');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id') then null::uuid else '46820000-0000-4000-8000-000000000001'::uuid end,
 id,'authenticated','authenticated',email,'',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
from (values
 ('46810000-0000-4000-8000-000000000001'::uuid,'s46-8-platform-active@example.invalid'),
 ('46810000-0000-4000-8000-000000000002'::uuid,'s46-8-platform-inactive@example.invalid'),
 ('46810000-0000-4000-8000-000000000003'::uuid,'s46-8-hotel-a@example.invalid'),
 ('46810000-0000-4000-8000-000000000004'::uuid,'s46-8-hotel-b@example.invalid'),
 ('46810000-0000-4000-8000-000000000005'::uuid,'s46-8-archived@example.invalid')) f(id,email);

delete from public.profiles where id = any(array[
 '46810000-0000-4000-8000-000000000001','46810000-0000-4000-8000-000000000002',
 '46810000-0000-4000-8000-000000000003','46810000-0000-4000-8000-000000000004',
 '46810000-0000-4000-8000-000000000005'
]::uuid[]);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
 ('46810000-0000-4000-8000-000000000003','s46-8-hotel-a@example.invalid','Hotel A','administrador','46800000-0000-4000-8000-000000000001',true),
 ('46810000-0000-4000-8000-000000000004','s46-8-hotel-b@example.invalid','Hotel B','administrador','46800000-0000-4000-8000-000000000002',true),
 ('46810000-0000-4000-8000-000000000005','s46-8-archived@example.invalid','Archived','administrador','46800000-0000-4000-8000-000000000003',true);
insert into public.platform_users(user_id,role,is_active) values
 ('46810000-0000-4000-8000-000000000001','platform_admin',true),
 ('46810000-0000-4000-8000-000000000002','platform_admin',false);
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
 ('46800000-0000-4000-8000-000000000001','core.directory',true,now()),
 ('46800000-0000-4000-8000-000000000001','content.services',true,now()),
 ('46800000-0000-4000-8000-000000000001','rooms.qr',true,now()),
 ('46800000-0000-4000-8000-000000000003','core.directory',true,now());
insert into public.hotel_sections(id,hotel_id,title,enabled) values ('46830000-0000-4000-8000-000000000001','46800000-0000-4000-8000-000000000001','Preserved service',true);
insert into public.hotel_room_links(id,hotel_id,room_number,room_token,is_active) values ('46840000-0000-4000-8000-000000000001','46800000-0000-4000-8000-000000000001','468-A','s468QrToken0000000000001',true);

set local role anon;
do $$ begin
  if (select count(*) from public.public_hotels where slug='s46-8-hotel-a')<>1 then raise exception '46.8 active/core hotel is not public'; end if;
  begin perform * from public.get_current_hotel_modules(); raise exception 'anon called hotel RPC'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_platform_hotel_modules('46800000-0000-4000-8000-000000000001'); raise exception 'anon called platform RPC'; exception when insufficient_privilege then null; end;
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000001',true);
do $$ declare n int; begin
  select count(*) into n from public.get_platform_hotel_modules('46800000-0000-4000-8000-000000000001'); if n<>19 then raise exception 'platform catalog not complete'; end if;
  begin perform * from public.hotel_module_entitlements; raise exception 'direct entitlement SELECT allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,disabled_at) values('46800000-0000-4000-8000-000000000001','content.tourism',false,now()); raise exception 'direct entitlement INSERT allowed'; exception when insufficient_privilege then null; end;
  begin update public.hotel_module_entitlements set is_enabled=false; raise exception 'direct entitlement UPDATE allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.hotel_module_entitlements; raise exception 'direct entitlement DELETE allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','invalid.module',true); raise exception 'invalid module accepted'; exception when invalid_parameter_value then null; end;
  begin perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','core.directory',false); raise exception 'core.directory disabled'; exception when invalid_parameter_value then null; end;
  begin
    perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.tourism',true);
    raise exception 'coming-soon module was enabled';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'platform_module_not_available' then raise; end if;
  end;
  begin
    perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000002','content.services',true);
    raise exception 'module was enabled without core.directory';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'platform_module_dependency_required' then raise; end if;
  end;
end $$;
select * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','experience.preview',true);
select * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.services',false);
select * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.services',false);
select * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','rooms.qr',false);

reset role;
do $$ begin
  if (select count(*) from public.platform_audit_log where entity_id='46800000-0000-4000-8000-000000000001' and action='hotel.module_disabled' and metadata='{"module_key":"content.services"}'::jsonb)<>1 then raise exception 'idempotent audit invalid'; end if;
  if not exists(select 1 from public.hotel_sections where id='46830000-0000-4000-8000-000000000001') then raise exception 'module disable deleted data'; end if;
  if exists(select 1 from public.hotel_room_links rl join public.hotels h on h.id=rl.hotel_id and h.platform_status='active' where rl.id='46840000-0000-4000-8000-000000000001' and rl.is_active and public.is_hotel_module_enabled(rl.hotel_id,'rooms.qr')) then raise exception 'room token bypassed disabled rooms.qr'; end if;
  if public.is_hotel_module_enabled('46800000-0000-4000-8000-000000000003','core.directory') is not true
    or public.is_hotel_publicly_active('46800000-0000-4000-8000-000000000003') then raise exception 'lifecycle did not remain independent and prioritary'; end if;
end $$;

set local role anon;
do $$ begin if exists(select 1 from public.hotel_sections where id='46830000-0000-4000-8000-000000000001') then raise exception 'disabled content remained public'; end if; end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000003',true);
do $$ declare rows_a int; begin
  select count(*) into rows_a from public.get_current_hotel_modules(); if rows_a<1 then raise exception 'hotel A cannot read own modules'; end if;
  begin perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.services',true); raise exception 'hotel admin mutated entitlement'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000004',true);
do $$ begin if exists(select 1 from public.get_current_hotel_modules() where module_key='content.services') then raise exception 'hotel B read hotel A modules'; end if; end $$;
select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000005',true);
do $$ begin begin perform * from public.get_current_hotel_modules(); raise exception 'archived hotel retained module access'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000002',true);
do $$ begin begin perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.services',true); raise exception 'inactive platform user mutated'; exception when insufficient_privilege then null; end; end $$;

reset role;
create function pg_temp.reject_468_audit() returns trigger language plpgsql as $$
declare call_context text;
begin
  get diagnostics call_context = pg_context;
  if call_context !~ 'record_platform_audit_event' then
    raise exception '46.8 mutation bypassed controlled audit writer';
  end if;
  raise exception '46.8 synthetic audit failure';
end $$;
create trigger test_468_audit before insert on public.platform_audit_log for each row execute function pg_temp.reject_468_audit();
set local role authenticated; select set_config('request.jwt.claim.sub','46810000-0000-4000-8000-000000000001',true);
do $$ begin begin perform * from public.update_platform_hotel_module('46800000-0000-4000-8000-000000000001','content.services',true); exception when raise_exception then if sqlerrm<>'46.8 synthetic audit failure' then raise; end if; end; end $$;
reset role; drop trigger test_468_audit on public.platform_audit_log;
do $$ begin if public.is_hotel_module_enabled('46800000-0000-4000-8000-000000000001','content.services') then raise exception 'audit failure did not roll back mutation'; end if; end $$;

rollback;
