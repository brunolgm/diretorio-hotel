-- Disposable/local database only. Synthetic mutations are isolated by BEGIN/ROLLBACK.
begin;

do $$
declare nullable_instance boolean;
begin
  if to_regprocedure('public.get_platform_hotel_readiness(uuid)') is null
    or to_regprocedure('public.get_current_hotel_readiness()') is null then
    raise exception '48 behavioral preflight: migration missing';
  end if;
  select is_nullable='YES' into strict nullable_instance from information_schema.columns
    where table_schema='auth' and table_name='users' and column_name='instance_id' and udt_name='uuid';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception '48 behavioral preflight: auth.instances missing';
  end if;
  if exists(select 1 from auth.users where email like 's48-%@example.invalid')
    or exists(select 1 from public.hotels where slug like 's48-%') then
    raise exception '48 behavioral preflight: fixture collision';
  end if;
end $$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance from information_schema.columns
    where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','48020000-0000-4000-8000-000000000001','uuid','48020000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('48000000-0000-4000-8000-000000000001','S48 Blocked',null,'s48-blocked',null,'draft'),
  ('48000000-0000-4000-8000-000000000002','S48 Ready','Recife','s48-ready','s48ready','draft'),
  ('48000000-0000-4000-8000-000000000003','S48 Suspended','Sao Paulo','s48-suspended','s48suspended','suspended'),
  ('48000000-0000-4000-8000-000000000004','S48 Archived','Curitiba','s48-archived','s48archived','archived');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id')
    then null::uuid else '48020000-0000-4000-8000-000000000001'::uuid end,
  id,'authenticated','authenticated',email,'',now(),jsonb_build_object('provider','email','providers',jsonb_build_array('email')),'{}'::jsonb,now(),now()
from (values
  ('48010000-0000-4000-8000-000000000001'::uuid,'s48-platform-active@example.invalid'),
  ('48010000-0000-4000-8000-000000000002'::uuid,'s48-platform-inactive@example.invalid'),
  ('48010000-0000-4000-8000-000000000003'::uuid,'s48-hotel-blocked@example.invalid'),
  ('48010000-0000-4000-8000-000000000004'::uuid,'s48-hotel-ready@example.invalid'),
  ('48010000-0000-4000-8000-000000000005'::uuid,'s48-hotel-other@example.invalid'),
  ('48010000-0000-4000-8000-000000000006'::uuid,'s48-hotel-archived@example.invalid')
) fixture(id,email);

delete from public.profiles where id=any(array[
  '48010000-0000-4000-8000-000000000001','48010000-0000-4000-8000-000000000002',
  '48010000-0000-4000-8000-000000000003','48010000-0000-4000-8000-000000000004',
  '48010000-0000-4000-8000-000000000005','48010000-0000-4000-8000-000000000006'
]::uuid[]);
insert into public.platform_users(user_id,role,is_active) values
  ('48010000-0000-4000-8000-000000000001','platform_admin',true),
  ('48010000-0000-4000-8000-000000000002','platform_admin',false);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('48010000-0000-4000-8000-000000000003','s48-hotel-blocked@example.invalid','Blocked Admin','administrador','48000000-0000-4000-8000-000000000001',true),
  ('48010000-0000-4000-8000-000000000004','s48-hotel-ready@example.invalid','Ready Admin','administrador','48000000-0000-4000-8000-000000000002',true),
  ('48010000-0000-4000-8000-000000000005','s48-hotel-other@example.invalid','Other Admin','administrador','48000000-0000-4000-8000-000000000003',true),
  ('48010000-0000-4000-8000-000000000006','s48-hotel-archived@example.invalid','Archived Admin','administrador','48000000-0000-4000-8000-000000000004',true);

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,disabled_at) values
  ('48000000-0000-4000-8000-000000000001','core.directory',true,now(),null),
  ('48000000-0000-4000-8000-000000000002','core.directory',true,now(),null),
  ('48000000-0000-4000-8000-000000000002','content.services',false,null,now()),
  ('48000000-0000-4000-8000-000000000002','content.banners',false,null,now()),
  ('48000000-0000-4000-8000-000000000002','rooms.qr',false,null,now()),
  ('48000000-0000-4000-8000-000000000002','content.languages',false,null,now()),
  ('48000000-0000-4000-8000-000000000002','experience.preview',false,null,now()),
  ('48000000-0000-4000-8000-000000000003','core.directory',false,null,now()),
  ('48000000-0000-4000-8000-000000000004','core.directory',true,now(),null);

set local role anon;
do $$ begin
  begin perform * from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000001'); raise exception '48: anon read platform readiness'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_current_hotel_readiness(); raise exception '48: anon read hotel readiness'; exception when insufficient_privilege then null; end;
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform * from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000001'); raise exception '48: inactive platform admin read readiness';
  exception when insufficient_privilege then if sqlerrm<>'active_platform_admin_required' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.get_current_hotel_readiness() where hotel_id<>'48000000-0000-4000-8000-000000000001') then
    raise exception '48: current hotel readiness escaped tenant';
  end if;
  begin perform * from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000002'); raise exception '48: hotel admin read platform readiness';
  exception when insufficient_privilege then if sqlerrm<>'active_platform_admin_required' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000006',true);
do $$ begin
  begin perform * from public.get_current_hotel_readiness(); raise exception '48: archived hotel retained readiness access';
  exception when insufficient_privilege then if sqlerrm<>'active_hotel_profile_required' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000005',true);
do $$ begin
  if not exists(select 1 from public.get_current_hotel_readiness()
      where hotel_id='48000000-0000-4000-8000-000000000003' and platform_status='suspended'
        and not ready_to_activate and check_key='module.core_directory' and not passed) then
    raise exception '48: suspended hotel did not retain tenant-scoped readiness access';
  end if;
end $$;

select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000001',true);
do $$ begin
  if not exists(select 1 from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000001') where blocking_count>0 and not ready_to_activate) then
    raise exception '48: blocker summary invalid';
  end if;
  if not exists(select 1 from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000002') where blocking_count=0 and ready_to_activate and warning_count>0) then
    raise exception '48: warnings incorrectly block activation';
  end if;
  if exists(select 1 from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000002')
      where check_key in ('content.services','content.banners','rooms.qr','languages.translations','experience.preview')) then
    raise exception '48: disabled module generated readiness warning';
  end if;
  if not exists(select 1 from public.get_platform_hotel_readiness('48000000-0000-4000-8000-000000000004') where platform_status='archived') then
    raise exception '48: platform admin cannot read archived readiness';
  end if;
  begin perform * from public.update_platform_hotel_status('48000000-0000-4000-8000-000000000001','active'); raise exception '48: blocked draft activated';
  exception when object_not_in_prerequisite_state then if sqlerrm<>'platform_hotel_not_ready' then raise; end if; end;
end $$;

reset role;
do $$ begin
  if (select platform_status from public.hotels where id='48000000-0000-4000-8000-000000000001')<>'draft' then
    raise exception '48: failed readiness changed lifecycle';
  end if;
  if exists(select 1 from public.platform_audit_log where entity_id='48000000-0000-4000-8000-000000000001' and action='hotel.status_updated') then
    raise exception '48: rejected activation was audited as success';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','48010000-0000-4000-8000-000000000001',true);
select * from public.update_platform_hotel_status('48000000-0000-4000-8000-000000000002','active');

reset role;
do $$ begin
  if (select platform_status from public.hotels where id='48000000-0000-4000-8000-000000000002')<>'active' then
    raise exception '48: ready draft was not activated';
  end if;
  if (select count(*) from public.platform_audit_log where entity_id='48000000-0000-4000-8000-000000000002'
      and action='hotel.status_updated' and metadata='{"previous_status":"draft","new_status":"active"}'::jsonb)<>1 then
    raise exception '48: lifecycle audit metadata drifted';
  end if;
  if not exists(select 1 from public.public_hotels where id='48000000-0000-4000-8000-000000000002') then
    raise exception '48: active/core hotel did not become public';
  end if;
  if exists(select 1 from public.hotels where id='48000000-0000-4000-8000-000000000003' and platform_status<>'suspended') then
    raise exception '48: readiness changed unrelated lifecycle automatically';
  end if;
end $$;

rollback;
