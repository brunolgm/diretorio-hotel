-- Disposable/local database only. Every synthetic mutation is rolled back.
begin;

do $$
declare nullable_instance boolean;
begin
  if to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)') is null then
    raise exception '47 behavioral preflight: migration missing';
  end if;
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id' and udt_name='uuid';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception '47 behavioral preflight: auth.instances missing for required instance_id';
  end if;
  if exists(select 1 from auth.users where email like 's47-%@example.invalid' or id=any(array[
      '47010000-0000-4000-8000-000000000001','47010000-0000-4000-8000-000000000002',
      '47010000-0000-4000-8000-000000000003','47010000-0000-4000-8000-000000000004',
      '47010000-0000-4000-8000-000000000005','47010000-0000-4000-8000-000000000006',
      '47010000-0000-4000-8000-000000000007']::uuid[]))
    or exists(select 1 from public.hotels where slug like 's47-%') then
    raise exception '47 behavioral preflight: synthetic fixture collision';
  end if;
end;
$$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances
    select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','47020000-0000-4000-8000-000000000001','uuid','47020000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()
    ))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('47000000-0000-4000-8000-000000000001','S47 Existing Hotel','Recife','s47-existing','s47existing','active');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id')
    then null::uuid else '47020000-0000-4000-8000-000000000001'::uuid end,
  id,'authenticated','authenticated',email,'',now(),'{}'::jsonb || jsonb_build_object('provider','email','providers',jsonb_build_array('email')),'{}'::jsonb,now(),now()
from (values
  ('47010000-0000-4000-8000-000000000001'::uuid,'s47-platform-active@example.invalid'),
  ('47010000-0000-4000-8000-000000000002'::uuid,'s47-platform-inactive@example.invalid'),
  ('47010000-0000-4000-8000-000000000003'::uuid,'s47-hotel-admin@example.invalid'),
  ('47010000-0000-4000-8000-000000000004'::uuid,'s47-initial-admin@example.invalid'),
  ('47010000-0000-4000-8000-000000000005'::uuid,'s47-slug-conflict@example.invalid'),
  ('47010000-0000-4000-8000-000000000006'::uuid,'s47-subdomain-conflict@example.invalid'),
  ('47010000-0000-4000-8000-000000000007'::uuid,'s47-audit-rollback@example.invalid')
) fixture(id,email);

-- Auth hooks may create empty profiles. Keep that real-world state for the initial admin,
-- while making authorization fixtures explicit and deterministic.
delete from public.profiles where id=any(array[
  '47010000-0000-4000-8000-000000000001','47010000-0000-4000-8000-000000000002',
  '47010000-0000-4000-8000-000000000003','47010000-0000-4000-8000-000000000005',
  '47010000-0000-4000-8000-000000000006','47010000-0000-4000-8000-000000000007'
]::uuid[]);
insert into public.platform_users(user_id,role,is_active) values
  ('47010000-0000-4000-8000-000000000001','platform_admin',true),
  ('47010000-0000-4000-8000-000000000002','platform_admin',false);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('47010000-0000-4000-8000-000000000003','s47-hotel-admin@example.invalid','S47 Hotel Admin','administrador','47000000-0000-4000-8000-000000000001',true);

set local role anon;
do $$ begin
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Rejected','Recife','s47-anon','s47anon',null,null,
      '47010000-0000-4000-8000-000000000004','s47-initial-admin@example.invalid','Initial Admin'
    );
    raise exception '47 behavior: anon created a hotel';
  exception when insufficient_privilege then null; end;
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000003',true);
do $$ begin
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Rejected','Recife','s47-hotel-rejected','s47hotelrejected',null,null,
      '47010000-0000-4000-8000-000000000004','s47-initial-admin@example.invalid','Initial Admin'
    );
    raise exception '47 behavior: hotel admin created a hotel';
  exception when insufficient_privilege then
    if sqlerrm <> 'active_platform_admin_required' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Rejected','Recife','s47-inactive-rejected','s47inactiverejected',null,null,
      '47010000-0000-4000-8000-000000000004','s47-initial-admin@example.invalid','Initial Admin'
    );
    raise exception '47 behavior: inactive platform admin created a hotel';
  exception when insufficient_privilege then
    if sqlerrm <> 'active_platform_admin_required' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000001',true);
do $$ declare created uuid; returned_status text; returned_admin uuid; begin
  select result.hotel_id,result.platform_status,result.admin_user_id
    into created,returned_status,returned_admin
  from public.create_platform_hotel_onboarding(
    'S47 New Draft','São Paulo','s47-new-draft','s47newdraft','grand-mercure','graphite-gold',
    '47010000-0000-4000-8000-000000000004','s47-initial-admin@example.invalid','S47 Initial Admin'
  ) result;
  if created is null or returned_status<>'draft' or returned_admin<>'47010000-0000-4000-8000-000000000004' then
    raise exception '47 behavior: creation result drifted';
  end if;
  perform set_config('test.s47_hotel_id',created::text,true);
end $$;

reset role;
do $$ declare created uuid := current_setting('test.s47_hotel_id')::uuid; begin
  if not exists(select 1 from public.hotels where id=created and platform_status='draft'
      and slug='s47-new-draft' and subdomain='s47newdraft' and brand_code='grand-mercure') then
    raise exception '47 behavior: draft hotel identity missing';
  end if;
  if (select count(*) from public.hotel_module_entitlements where hotel_id=created and is_enabled)<>11 then
    raise exception '47 behavior: baseline is not eleven enabled modules';
  end if;
  if exists(select 1 from public.hotel_module_entitlements where hotel_id=created and module_key=any(array[
      'experience.navigation','experience.seo','fb.menu','content.tourism','analytics.advanced',
      'integrations.thex','integrations.opera','audit.access_logs'])) then
    raise exception '47 behavior: coming-soon entitlement was created';
  end if;
  if not exists(select 1 from public.hotel_module_entitlements where hotel_id=created and module_key='core.directory' and is_enabled) then
    raise exception '47 behavior: core.directory missing';
  end if;
  if not exists(select 1 from public.profiles where id='47010000-0000-4000-8000-000000000004'
      and hotel_id=created and role='administrador' and is_active) then
    raise exception '47 behavior: initial administrator profile missing';
  end if;
  if (select count(*) from public.platform_audit_log where entity_id=created and action='hotel.created'
      and metadata=pg_catalog.jsonb_build_object('brand_code','grand-mercure','baseline_modules',11))<>1 then
    raise exception '47 behavior: shallow hotel.created audit missing';
  end if;
  if exists(select 1 from public.platform_audit_log where entity_id=created
      and metadata::text ~* '(s47-initial-admin|example\.invalid|initial admin)') then
    raise exception '47 behavior: administrator PII leaked into audit';
  end if;
  if exists(select 1 from public.public_hotels where id=created) then
    raise exception '47 behavior: draft hotel leaked into public_hotels';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.get_current_hotel_modules() where is_enabled)<>11
    or not exists(select 1 from public.get_current_hotel_modules() where module_key='core.directory' and is_enabled) then
    raise exception '47 behavior: initial draft admin cannot resolve baseline modules';
  end if;
end $$;

select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Slug Conflict','Recife','s47-new-draft','s47different',null,null,
      '47010000-0000-4000-8000-000000000005','s47-slug-conflict@example.invalid','Slug Conflict Admin'
    );
    raise exception '47 behavior: duplicate slug accepted';
  exception when unique_violation then
    if sqlerrm <> 'platform_hotel_slug_conflict' then raise; end if;
  end;
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Subdomain Conflict','Recife','s47-different','s47newdraft',null,null,
      '47010000-0000-4000-8000-000000000006','s47-subdomain-conflict@example.invalid','Subdomain Conflict Admin'
    );
    raise exception '47 behavior: duplicate subdomain accepted';
  exception when unique_violation then
    if sqlerrm <> 'platform_hotel_subdomain_conflict' then raise; end if;
  end;
  if not exists(select 1 from public.list_platform_hotels('S47 New Draft',1,20)
      where id=current_setting('test.s47_hotel_id')::uuid and platform_status='draft') then
    raise exception '47 behavior: platform directory cannot see the new draft';
  end if;
end $$;

reset role;
do $$ begin
  if exists(select 1 from public.hotels where slug in ('s47-different') or subdomain='s47different')
    or exists(select 1 from public.profiles where id=any(array[
      '47010000-0000-4000-8000-000000000005','47010000-0000-4000-8000-000000000006'
    ]::uuid[]) and hotel_id is not null) then
    raise exception '47 behavior: uniqueness conflict left partial database state';
  end if;
end $$;

create function pg_temp.reject_s47_audit() returns trigger language plpgsql as $$
declare call_context text;
begin
  get diagnostics call_context = pg_context;
  if call_context !~ 'record_platform_audit_event' then
    raise exception '47 behavior: onboarding bypassed controlled audit writer';
  end if;
  raise exception '47 synthetic audit failure';
end $$;
create trigger test_s47_audit before insert on public.platform_audit_log
  for each row execute function pg_temp.reject_s47_audit();

set local role authenticated;
select set_config('request.jwt.claim.sub','47010000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform * from public.create_platform_hotel_onboarding(
      'Audit Rollback','Recife','s47-audit-rollback','s47auditrollback',null,null,
      '47010000-0000-4000-8000-000000000007','s47-audit-rollback@example.invalid','Audit Rollback Admin'
    );
    raise exception '47 behavior: forced audit failure did not fail onboarding';
  exception when raise_exception then
    if sqlerrm <> '47 synthetic audit failure' then raise; end if;
  end;
end $$;

reset role;
drop trigger test_s47_audit on public.platform_audit_log;

do $$ begin
  if exists(select 1 from public.hotels where slug='s47-audit-rollback')
    or exists(select 1 from public.profiles where id='47010000-0000-4000-8000-000000000007' and hotel_id is not null)
    or exists(select 1 from public.hotel_module_entitlements e join public.hotels h on h.id=e.hotel_id where h.slug='s47-audit-rollback') then
    raise exception '47 behavior: audit failure left partial hotel/profile/entitlement state';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.update_platform_hotel_status(uuid,text)'::regprocedure
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'previous_status[[:space:]]*=[[:space:]]*''draft''[[:space:]]+and[[:space:]]+p_status[[:space:]]+in[[:space:]]*\(''active'',[[:space:]]*''archived''\)'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'previous_status[[:space:]]*=[[:space:]]*''archived''[[:space:]]+and'
  ) then raise exception '47 behavior: prior lifecycle/archived terminal contract drifted'; end if;
end $$;

rollback;
