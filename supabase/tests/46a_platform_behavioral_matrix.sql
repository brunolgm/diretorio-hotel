-- Self-contained Sprint 46A authorization matrix for a disposable local database only.
-- PostgreSQL cannot reliably identify a production database. Confirm the target independently.
-- All fixtures are synthetic, collision-checked and rolled back. Never run against production.

begin;

do $$
declare
  instance_id_is_nullable boolean;
begin
  if to_regclass('public.platform_users') is null
    or to_regprocedure('public.get_current_platform_access()') is null
  then
    raise exception '46A behavioral preflight failed: apply the 46A migration in the disposable lab first';
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
    raise exception '46A behavioral preflight failed: auth.users.instance_id UUID column is missing';
  end if;

  if not instance_id_is_nullable and to_regclass('auth.instances') is null then
    raise exception '46A behavioral preflight failed: auth.users.instance_id is NOT NULL but auth.instances is missing';
  end if;

  if exists (
    select 1
    from public.hotels
    where id = '46000000-0000-4000-8000-000000000001'
      or slug = '46a-synthetic-hotel-only'
  ) or exists (
    select 1
    from auth.users
    where id = any (array[
      '46100000-0000-4000-8000-000000000001',
      '46100000-0000-4000-8000-000000000002',
      '46100000-0000-4000-8000-000000000003',
      '46100000-0000-4000-8000-000000000004',
      '46100000-0000-4000-8000-000000000005'
    ]::uuid[])
      or email like '46a-%@example.invalid'
  ) or exists (
    select 1
    from public.profiles
    where id = any (array[
      '46100000-0000-4000-8000-000000000001',
      '46100000-0000-4000-8000-000000000002',
      '46100000-0000-4000-8000-000000000003',
      '46100000-0000-4000-8000-000000000004',
      '46100000-0000-4000-8000-000000000005'
    ]::uuid[])
      or email like '46a-%@example.invalid'
  ) or exists (
    select 1
    from public.platform_users
    where user_id = any (array[
      '46100000-0000-4000-8000-000000000001',
      '46100000-0000-4000-8000-000000000002',
      '46100000-0000-4000-8000-000000000003',
      '46100000-0000-4000-8000-000000000004',
      '46100000-0000-4000-8000-000000000005'
    ]::uuid[])
  ) or exists (
    select 1
    from auth.instances
    where id = '46200000-0000-4000-8000-000000000001'
  ) then
    raise exception '46A fixture collision: aborting before synthetic setup';
  end if;
end;
$$;

-- Most local Auth schemas allow auth.users.instance_id to be NULL. If this stack
-- requires it, create one isolated Auth instance without depending on global seed
-- state. jsonb_populate_record tolerates optional-column differences between
-- supported local Auth schema versions; all state is removed by the final rollback.
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
        'id', '46200000-0000-4000-8000-000000000001',
        'uuid', '46200000-0000-4000-8000-000000000001',
        'raw_base_config', '{}',
        'created_at', now(),
        'updated_at', now()
      )
    )).*;
  end if;
end;
$$;

insert into public.hotels (id, name, slug)
values (
  '46000000-0000-4000-8000-000000000001',
  '46A Synthetic Hotel Only',
  '46a-synthetic-hotel-only'
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
    else '46200000-0000-4000-8000-000000000001'::uuid
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
  ('46100000-0000-4000-8000-000000000001'::uuid, '46a-platform-active@example.invalid'),
  ('46100000-0000-4000-8000-000000000002'::uuid, '46a-platform-inactive@example.invalid'),
  ('46100000-0000-4000-8000-000000000003'::uuid, '46a-hotel-only@example.invalid'),
  ('46100000-0000-4000-8000-000000000004'::uuid, '46a-no-association@example.invalid'),
  ('46100000-0000-4000-8000-000000000005'::uuid, '46a-cascade-only@example.invalid')
) as fixture(id, email);

-- A baseline Auth trigger may create profiles. Remove those synthetic rows before
-- establishing the explicit matrix, then create only the hotel-scoped C fixture.
delete from public.profiles
where id = any (array[
  '46100000-0000-4000-8000-000000000001',
  '46100000-0000-4000-8000-000000000002',
  '46100000-0000-4000-8000-000000000003',
  '46100000-0000-4000-8000-000000000004',
  '46100000-0000-4000-8000-000000000005'
]::uuid[]);

insert into public.profiles (id, email, full_name, role, hotel_id, is_active)
values (
  '46100000-0000-4000-8000-000000000003',
  '46a-hotel-only@example.invalid',
  '46A Hotel Only',
  'administrador',
  '46000000-0000-4000-8000-000000000001',
  true
);

insert into public.platform_users (user_id, role, is_active)
values
  ('46100000-0000-4000-8000-000000000001', 'platform_admin', true),
  ('46100000-0000-4000-8000-000000000002', 'platform_admin', false),
  ('46100000-0000-4000-8000-000000000005', 'platform_admin', true);

do $$
begin
  if exists (
    select 1 from public.profiles
    where id in (
      '46100000-0000-4000-8000-000000000001',
      '46100000-0000-4000-8000-000000000002',
      '46100000-0000-4000-8000-000000000004'
    )
  ) then
    raise exception '46A fixture setup failed: A, B and D must not have profiles';
  end if;
end;
$$;

-- A: active platform administrator, deliberately without a profile.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '46100000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  rpc_rows integer;
  rpc_role text;
  rpc_active boolean;
  visible_rows integer;
  affected integer;
begin
  select count(*), min(role), bool_and(is_active)
    into rpc_rows, rpc_role, rpc_active
  from public.get_current_platform_access();

  if rpc_rows <> 1 or rpc_role <> 'platform_admin' or rpc_active is not true then
    raise exception '46A A failed: active platform RPC result is invalid';
  end if;

  if exists (
    select 1 from public.profiles
    where id = '46100000-0000-4000-8000-000000000001'
  ) then
    raise exception '46A A failed: active platform user unexpectedly has a profile';
  end if;

  select count(*) into visible_rows
  from public.hotels
  where id = '46000000-0000-4000-8000-000000000001';
  if visible_rows <> 0 then
    raise exception '46A A failed: platform association granted hotel base-table access';
  end if;

  begin
    select count(*) into visible_rows from public.platform_users;
    if visible_rows <> 0 then
      raise exception '46A A failed: direct platform_users SELECT exposed rows';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.platform_users (user_id, role)
    values ('46100000-0000-4000-8000-000000000004', 'platform_admin');
    raise exception '46A A failed: direct platform_users INSERT succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.platform_users set is_active = false
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception '46A A failed: direct platform_users UPDATE changed a row';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.platform_users
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception '46A A failed: direct platform_users DELETE changed a row';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- B: inactive platform association. The RPC reports it; this is not authorization.
select set_config(
  'request.jwt.claim.sub',
  '46100000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  rpc_rows integer;
  rpc_role text;
  rpc_active boolean;
  visible_rows integer;
  affected integer;
begin
  select count(*), min(role), bool_and(is_active)
    into rpc_rows, rpc_role, rpc_active
  from public.get_current_platform_access();
  if rpc_rows <> 1 or rpc_role <> 'platform_admin' or rpc_active is not false then
    raise exception '46A B failed: inactive association must be returned as inactive';
  end if;

  begin
    select count(*) into visible_rows from public.platform_users;
    if visible_rows <> 0 then raise exception '46A B failed: direct SELECT exposed rows'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_users (user_id, role)
    values ('46100000-0000-4000-8000-000000000004', 'platform_admin');
    raise exception '46A B failed: direct INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_users set is_active = true
    where user_id = '46100000-0000-4000-8000-000000000002';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A B failed: direct UPDATE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.platform_users
    where user_id = '46100000-0000-4000-8000-000000000002';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A B failed: direct DELETE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- C: active hotel profile without a platform association.
select set_config(
  'request.jwt.claim.sub',
  '46100000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  rpc_rows integer;
  visible_rows integer;
  affected integer;
begin
  select count(*) into rpc_rows from public.get_current_platform_access();
  if rpc_rows <> 0 then
    raise exception '46A C failed: hotel-only user received platform association';
  end if;

  begin
    select count(*) into visible_rows from public.platform_users;
    if visible_rows <> 0 then raise exception '46A C failed: direct SELECT exposed rows'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_users (user_id, role)
    values ('46100000-0000-4000-8000-000000000004', 'platform_admin');
    raise exception '46A C failed: direct INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_users set is_active = false
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A C failed: direct UPDATE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.platform_users
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A C failed: direct DELETE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- D: authenticated identity with neither profile nor platform association.
select set_config(
  'request.jwt.claim.sub',
  '46100000-0000-4000-8000-000000000004',
  true
);

do $$
declare
  rpc_rows integer;
  visible_rows integer;
  affected integer;
begin
  select count(*) into rpc_rows from public.get_current_platform_access();
  if rpc_rows <> 0 then
    raise exception '46A D failed: unassociated user received platform association';
  end if;

  begin
    select count(*) into visible_rows from public.platform_users;
    if visible_rows <> 0 then raise exception '46A D failed: direct SELECT exposed rows'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_users (user_id, role)
    values ('46100000-0000-4000-8000-000000000004', 'platform_admin');
    raise exception '46A D failed: direct INSERT succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_users set is_active = false
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A D failed: direct UPDATE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.platform_users
    where user_id = '46100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception '46A D failed: direct DELETE changed a row'; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- E: dedicated owner-level cascade fixture. It is never used as a browser identity.
reset role;
delete from auth.users
where id = '46100000-0000-4000-8000-000000000005';

do $$
begin
  if exists (
    select 1 from public.platform_users
    where user_id = '46100000-0000-4000-8000-000000000005'
  ) then
    raise exception '46A E failed: auth.users deletion did not cascade to platform_users';
  end if;
end;
$$;

rollback;
