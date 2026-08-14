-- Self-contained Sprint 46B dashboard/directory matrix for a disposable local database only.
-- Confirm the target independently. Synthetic fixtures and optional Auth instance roll back.

begin;

do $$
declare
  instance_id_is_nullable boolean;
begin
  if to_regprocedure('public.get_platform_hotel_metrics()') is null
    or to_regprocedure('public.list_platform_hotels(text,integer,integer)') is null
  then
    raise exception '46B behavioral preflight failed: apply 46A and 46B in the disposable lab first';
  end if;

  select c.is_nullable = 'YES'
    into instance_id_is_nullable
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
    and c.column_name = 'instance_id'
    and c.udt_schema = 'pg_catalog'
    and c.udt_name = 'uuid';

  if not found then
    raise exception '46B behavioral preflight failed: auth.users.instance_id UUID column is missing';
  end if;

  if not instance_id_is_nullable and to_regclass('auth.instances') is null then
    raise exception '46B behavioral preflight failed: required auth.instances table is missing';
  end if;

  if exists (
    select 1 from public.hotels
    where id = any (array[
      '46b00000-0000-4000-8000-000000000001',
      '46b00000-0000-4000-8000-000000000002',
      '46b00000-0000-4000-8000-000000000003'
    ]::uuid[])
      or slug like '46b-directory-%'
  ) or exists (
    select 1 from auth.users
    where id = any (array[
      '46b10000-0000-4000-8000-000000000001',
      '46b10000-0000-4000-8000-000000000002',
      '46b10000-0000-4000-8000-000000000003',
      '46b10000-0000-4000-8000-000000000004'
    ]::uuid[])
      or email like '46b-%@example.invalid'
  ) or exists (
    select 1 from public.profiles
    where id = any (array[
      '46b10000-0000-4000-8000-000000000001',
      '46b10000-0000-4000-8000-000000000002',
      '46b10000-0000-4000-8000-000000000003',
      '46b10000-0000-4000-8000-000000000004'
    ]::uuid[])
  ) or exists (
    select 1 from public.platform_users
    where user_id = any (array[
      '46b10000-0000-4000-8000-000000000001',
      '46b10000-0000-4000-8000-000000000002',
      '46b10000-0000-4000-8000-000000000003',
      '46b10000-0000-4000-8000-000000000004'
    ]::uuid[])
  ) or exists (
    select 1 from auth.instances
    where id = '46b20000-0000-4000-8000-000000000001'
  ) then
    raise exception '46B fixture collision: aborting before synthetic setup';
  end if;
end;
$$;

do $$
declare
  instance_id_is_nullable boolean;
begin
  select c.is_nullable = 'YES'
    into strict instance_id_is_nullable
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
    and c.column_name = 'instance_id'
    and c.udt_schema = 'pg_catalog'
    and c.udt_name = 'uuid';

  if not instance_id_is_nullable then
    insert into auth.instances
    select (jsonb_populate_record(
      null::auth.instances,
      jsonb_build_object(
        'id', '46b20000-0000-4000-8000-000000000001',
        'uuid', '46b20000-0000-4000-8000-000000000001',
        'raw_base_config', '{}',
        'created_at', now(),
        'updated_at', now()
      )
    )).*;
  end if;
end;
$$;

insert into public.hotels (
  id, name, slug, subdomain, city, brand_code, theme_preset, logo_url,
  wifi_name, wifi_password
)
values
  (
    '46b00000-0000-4000-8000-000000000001', '46B Directory Alpha',
    '46b-directory-alpha', '46b-alpha', '46B Synthetic City', 'mercure', 'mercure',
    'https://example.invalid/46b-alpha-logo.png', '46B Hidden Wifi A', '46B-SECRET-A'
  ),
  (
    '46b00000-0000-4000-8000-000000000002', '46B Directory Beta',
    '46b-directory-beta', '46b-beta', '46B Synthetic City', 'novotel', 'novotel',
    null, '46B Hidden Wifi B', '46B-SECRET-B'
  ),
  (
    '46b00000-0000-4000-8000-000000000003', '46B Directory Gamma',
    '46b-directory-gamma', null, '46B Synthetic City', null, null,
    null, '46B Hidden Wifi C', '46B-SECRET-C'
  );

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  case
    when (
      select c.is_nullable = 'YES'
      from information_schema.columns c
      where c.table_schema = 'auth'
        and c.table_name = 'users'
        and c.column_name = 'instance_id'
    ) then null::uuid
    else '46b20000-0000-4000-8000-000000000001'::uuid
  end,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from (values
  ('46b10000-0000-4000-8000-000000000001'::uuid, '46b-platform-active@example.invalid'),
  ('46b10000-0000-4000-8000-000000000002'::uuid, '46b-platform-inactive@example.invalid'),
  ('46b10000-0000-4000-8000-000000000003'::uuid, '46b-hotel-only@example.invalid'),
  ('46b10000-0000-4000-8000-000000000004'::uuid, '46b-no-association@example.invalid')
) fixture(id, email);

delete from public.profiles
where id = any (array[
  '46b10000-0000-4000-8000-000000000001',
  '46b10000-0000-4000-8000-000000000002',
  '46b10000-0000-4000-8000-000000000003',
  '46b10000-0000-4000-8000-000000000004'
]::uuid[]);

insert into public.profiles (id, email, full_name, role, hotel_id, is_active)
values (
  '46b10000-0000-4000-8000-000000000003',
  '46b-hotel-only@example.invalid',
  '46B Hotel Only',
  'administrador',
  '46b00000-0000-4000-8000-000000000001',
  true
);

insert into public.platform_users (user_id, role, is_active)
values
  ('46b10000-0000-4000-8000-000000000001', 'platform_admin', true),
  ('46b10000-0000-4000-8000-000000000002', 'platform_admin', false);

select set_config('test.s46b_expected_total', (select count(*)::text from public.hotels), true);

-- Anon has no EXECUTE grant.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform * from public.get_platform_hotel_metrics();
    raise exception '46B anon executed metrics RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.list_platform_hotels(null, 1, 20);
    raise exception '46B anon executed directory RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Active platform_admin without profile receives metrics and the bounded projection.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '46b10000-0000-4000-8000-000000000001', true);
do $$
declare
  metrics_rows integer;
  total_hotels bigint;
  brands jsonb;
  directory_rows integer;
  directory_total bigint;
  payload jsonb;
  first_page_ids uuid[];
  second_page_ids uuid[];
  visible_base_rows integer;
begin
  if exists (
    select 1 from public.profiles
    where id = '46b10000-0000-4000-8000-000000000001'
  ) then
    raise exception '46B active fixture unexpectedly has a profile';
  end if;

  select m.total_hotels, m.hotels_by_brand
    into total_hotels, brands
  from public.get_platform_hotel_metrics() m;
  get diagnostics metrics_rows = row_count;

  if metrics_rows <> 1
    or total_hotels <> current_setting('test.s46b_expected_total')::bigint
    or coalesce((brands ->> 'mercure')::integer, 0) < 1
    or coalesce((brands ->> 'novotel')::integer, 0) < 1
    or coalesce((brands ->> 'unassigned')::integer, 0) < 1
  then
    raise exception '46B active metrics result is invalid';
  end if;

  select count(*), min(d.total_count), coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
    into directory_rows, directory_total, payload
  from public.list_platform_hotels('46B Directory', 1, 20) d;

  if directory_rows <> 3 or directory_total <> 3 then
    raise exception '46B active directory search did not return the three synthetic hotels';
  end if;

  if payload::text ~* '(wifi|46B-SECRET|room_token|notes|profiles|analytics)'
  then
    raise exception '46B directory payload exposed a prohibited field or value';
  end if;

  select array_agg(d.id order by d.name, d.id)
    into first_page_ids
  from public.list_platform_hotels('46B Directory', 1, 2) d;
  select array_agg(d.id order by d.name, d.id)
    into second_page_ids
  from public.list_platform_hotels('46B Directory', 2, 2) d;

  if cardinality(first_page_ids) <> 2
    or cardinality(second_page_ids) <> 1
    or first_page_ids && second_page_ids
  then
    raise exception '46B deterministic pagination failed';
  end if;

  select count(*) into directory_rows
  from public.list_platform_hotels(E'%'' OR true --', 1, 20);
  if directory_rows <> 0 then
    raise exception '46B search payload behaved as SQL instead of a literal';
  end if;

  begin
    perform * from public.list_platform_hotels(null, 1, 51);
    raise exception '46B directory accepted page size above 50';
  exception when invalid_parameter_value then null;
  end;

  select count(*) into visible_base_rows
  from public.hotels;
  if visible_base_rows <> 0 then
    raise exception '46B platform access leaked through public.hotels RLS';
  end if;
end;
$$;

-- Inactive association is visible to the 46A identity RPC but rejected by both 46B RPCs.
select set_config('request.jwt.claim.sub', '46b10000-0000-4000-8000-000000000002', true);
do $$
declare
  identity_rows integer;
  identity_active boolean;
begin
  select count(*), bool_and(is_active)
    into identity_rows, identity_active
  from public.get_current_platform_access();
  if identity_rows <> 1 or identity_active is not false then
    raise exception '46B inactive fixture identity precondition failed';
  end if;

  begin
    perform * from public.get_platform_hotel_metrics();
    raise exception '46B inactive user executed metrics RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.list_platform_hotels(null, 1, 20);
    raise exception '46B inactive user executed directory RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- A hotel administrator without platform_users remains hotel-scoped only.
select set_config('request.jwt.claim.sub', '46b10000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.get_current_platform_access()) then
    raise exception '46B hotel-only fixture unexpectedly has platform access';
  end if;
  begin
    perform * from public.get_platform_hotel_metrics();
    raise exception '46B hotel-only user executed metrics RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.list_platform_hotels(null, 1, 20);
    raise exception '46B hotel-only user executed directory RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Authenticated identity without either association is also denied.
select set_config('request.jwt.claim.sub', '46b10000-0000-4000-8000-000000000004', true);
do $$
begin
  if exists (select 1 from public.get_current_platform_access()) then
    raise exception '46B unassociated fixture unexpectedly has platform access';
  end if;
  begin
    perform * from public.get_platform_hotel_metrics();
    raise exception '46B unassociated user executed metrics RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.list_platform_hotels(null, 1, 20);
    raise exception '46B unassociated user executed directory RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
