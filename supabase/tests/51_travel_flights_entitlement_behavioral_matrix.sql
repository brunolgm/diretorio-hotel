-- Disposable/local database only. Every synthetic change rolls back.
begin;

do $$
begin
  if to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null
    or not exists (
      select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.hotel_module_entitlements'::regclass
        and c.conname='hotel_module_entitlements_module_key_check'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'travel\.flights'
    ) then
    raise exception '51 behavior: entitlement migration missing';
  end if;
  if exists(select 1 from auth.users where email like 's51-%@example.invalid')
    or exists(select 1 from public.hotels where slug like 's51-%') then
    raise exception '51 behavior: fixture collision';
  end if;
end;
$$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances
    select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','51020000-0000-4000-8000-000000000001',
      'uuid','51020000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()
    ))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('51000000-0000-4000-8000-000000000001','S51 Hotel A','Recife','s51-hotel-a','s51a','active'),
  ('51000000-0000-4000-8000-000000000002','S51 Hotel B','Recife','s51-hotel-b','s51b','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('51000000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('51000000-0000-4000-8000-000000000002','core.directory',true,now())
on conflict on constraint hotel_module_entitlements_pkey do update set
  is_enabled=true,enabled_at=excluded.enabled_at,disabled_at=null,disabled_by=null;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (
  select is_nullable='YES' from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id'
) then null::uuid else '51020000-0000-4000-8000-000000000001'::uuid end,
id,'authenticated','authenticated',email,'',now(),
'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
  ('51010000-0000-4000-8000-000000000001'::uuid,'s51-platform-admin@example.invalid'),
  ('51010000-0000-4000-8000-000000000002'::uuid,'s51-initial-admin@example.invalid')
) users(id,email);

delete from public.profiles where id=any(array[
  '51010000-0000-4000-8000-000000000001',
  '51010000-0000-4000-8000-000000000002'
]::uuid[]);

insert into public.platform_users(user_id,role,is_active) values
  ('51010000-0000-4000-8000-000000000001','platform_admin',true);

do $$
begin
  if public.is_hotel_module_enabled('51000000-0000-4000-8000-000000000001','travel.flights')
    or exists (
      select 1 from public.hotel_module_entitlements
      where hotel_id in (
        '51000000-0000-4000-8000-000000000001',
        '51000000-0000-4000-8000-000000000002'
      ) and module_key='travel.flights'
    ) then
    raise exception '51 behavior: hotel received travel.flights without entitlement';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','51010000-0000-4000-8000-000000000001',true);

do $$ declare modules_count integer; enabled boolean; begin
  select count(*),bool_or(is_enabled) filter(where module_key='travel.flights')
  into modules_count,enabled
  from public.get_platform_hotel_modules('51000000-0000-4000-8000-000000000001');
  if modules_count<>20 or enabled is distinct from false then
    raise exception '51 behavior: Platform catalog/default state invalid';
  end if;

  perform * from public.update_platform_hotel_module(
    '51000000-0000-4000-8000-000000000001','travel.flights',true
  );
  if not public.is_hotel_module_enabled(
    '51000000-0000-4000-8000-000000000001','travel.flights'
  ) then raise exception '51 behavior: Platform could not enable travel.flights'; end if;

  perform * from public.update_platform_hotel_module(
    '51000000-0000-4000-8000-000000000001','travel.flights',false
  );
  if public.is_hotel_module_enabled(
    '51000000-0000-4000-8000-000000000001','travel.flights'
  ) then raise exception '51 behavior: Platform could not disable travel.flights'; end if;

  if public.is_hotel_module_enabled(
    '51000000-0000-4000-8000-000000000002','travel.flights'
  ) then raise exception '51 behavior: entitlement crossed hotel boundary'; end if;
end $$;

do $$ declare created record; enabled_keys text[]; begin
  select * into strict created from public.create_platform_hotel_onboarding(
    'S51 Onboarding Hotel','Recife','s51-onboarding-hotel','s51onboarding',
    'grand-mercure','graphite-gold','51010000-0000-4000-8000-000000000002',
    's51-initial-admin@example.invalid','S51 Initial Admin'
  );
  select array_agg(module_key order by module_key) into enabled_keys
  from public.get_platform_hotel_modules(created.hotel_id)
  where is_enabled;
  if cardinality(enabled_keys)<>12 or 'travel.flights'=any(enabled_keys) then
    raise exception '51 behavior: onboarding baseline is not exactly twelve';
  end if;
end $$;

reset role;

do $$
begin
  if (select count(*) from public.platform_audit_log
      where entity_id='51000000-0000-4000-8000-000000000001'
        and action='hotel.module_enabled'
        and metadata->>'module_key'='travel.flights')<>1
    or (select count(*) from public.platform_audit_log
      where entity_id='51000000-0000-4000-8000-000000000001'
        and action='hotel.module_disabled'
        and metadata->>'module_key'='travel.flights')<>1 then
    raise exception '51 behavior: Platform enable/disable audit invalid';
  end if;
end;
$$;

rollback;
