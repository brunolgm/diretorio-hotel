-- Self-contained behavioral RLS matrix for a disposable local database only.
-- PostgreSQL/Supabase exposes no portable, trustworthy catalog flag that distinguishes
-- production from a disposable clone. Do not run this file without independently
-- confirming the target. Fixed fixture collisions abort before any fixture is inserted.

begin;

do $$
begin
  if exists (
    select 1 from public.hotels
    where id = any (array[
      '45000000-0000-4000-8000-00000000000a',
      '45000000-0000-4000-8000-00000000000b'
    ]::uuid[])
      or slug in ('45b-synthetic-hotel-a', '45b-synthetic-hotel-b')
  ) or exists (
    select 1 from public.profiles
    where id = any (array[
      '45100000-0000-4000-8000-000000000001',
      '45100000-0000-4000-8000-000000000002',
      '45100000-0000-4000-8000-000000000003',
      '45100000-0000-4000-8000-000000000004',
      '45100000-0000-4000-8000-000000000005',
      '45100000-0000-4000-8000-000000000006'
    ]::uuid[])
      or email like '45b-%@example.invalid'
  ) or exists (
    select 1 from auth.users
    where id = any (array[
      '45100000-0000-4000-8000-000000000001',
      '45100000-0000-4000-8000-000000000002',
      '45100000-0000-4000-8000-000000000003',
      '45100000-0000-4000-8000-000000000004',
      '45100000-0000-4000-8000-000000000005',
      '45100000-0000-4000-8000-000000000006'
    ]::uuid[])
      or email like '45b-%@example.invalid'
  ) or exists (
    select 1 from public.hotel_sections
    where id = any (array[
      '45200000-0000-4000-8000-000000000001',
      '45200000-0000-4000-8000-000000000002'
    ]::uuid[])
  ) or exists (
    select 1 from public.hotel_room_links
    where id = any (array[
      '45300000-0000-4000-8000-000000000001',
      '45300000-0000-4000-8000-000000000002',
      '45300000-0000-4000-8000-000000000003'
    ]::uuid[])
      or room_token in (
        'RoomA_000000000000000001',
        'RoomB_000000000000000002',
        'RoomA_000000000000000003'
      )
  ) then
    raise exception '45B fixture collision: aborting before synthetic setup';
  end if;
end;
$$;

insert into public.hotels (id, name, slug)
values
  ('45000000-0000-4000-8000-00000000000a', '45B Synthetic Hotel A', '45b-synthetic-hotel-a'),
  ('45000000-0000-4000-8000-00000000000b', '45B Synthetic Hotel B', '45b-synthetic-hotel-b');

-- Some reconstructed baselines retain profiles.id -> auth.users.id. Create minimal
-- synthetic Auth rows only when that FK exists; a profile trigger, if present, is
-- reconciled by the profile upsert below. Everything remains inside this transaction.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  ) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    select
      (select id from auth.instances order by created_at limit 1),
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
      ('45100000-0000-4000-8000-000000000001'::uuid, '45b-viewer-a@example.invalid'),
      ('45100000-0000-4000-8000-000000000002'::uuid, '45b-operator-a@example.invalid'),
      ('45100000-0000-4000-8000-000000000003'::uuid, '45b-editor-a@example.invalid'),
      ('45100000-0000-4000-8000-000000000004'::uuid, '45b-admin-a@example.invalid'),
      ('45100000-0000-4000-8000-000000000005'::uuid, '45b-second-admin-a@example.invalid'),
      ('45100000-0000-4000-8000-000000000006'::uuid, '45b-admin-b@example.invalid')
    ) as fixture(id, email)
    on conflict (id) do nothing;
  end if;
end;
$$;

insert into public.profiles (id, email, full_name, role, hotel_id, is_active)
values
  ('45100000-0000-4000-8000-000000000001', '45b-viewer-a@example.invalid', '45B Viewer A', 'visualizador', '45000000-0000-4000-8000-00000000000a', true),
  ('45100000-0000-4000-8000-000000000002', '45b-operator-a@example.invalid', '45B Operator A', 'operador', '45000000-0000-4000-8000-00000000000a', true),
  ('45100000-0000-4000-8000-000000000003', '45b-editor-a@example.invalid', '45B Editor A', 'editor', '45000000-0000-4000-8000-00000000000a', true),
  ('45100000-0000-4000-8000-000000000004', '45b-admin-a@example.invalid', '45B Admin A', 'administrador', '45000000-0000-4000-8000-00000000000a', true),
  ('45100000-0000-4000-8000-000000000005', '45b-second-admin-a@example.invalid', '45B Second Admin A', 'administrador', '45000000-0000-4000-8000-00000000000a', true),
  ('45100000-0000-4000-8000-000000000006', '45b-admin-b@example.invalid', '45B Admin B', 'administrador', '45000000-0000-4000-8000-00000000000b', true)
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    hotel_id = excluded.hotel_id,
    is_active = excluded.is_active;

insert into public.hotel_sections (id, hotel_id, title, enabled, sort_order)
values
  ('45200000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-00000000000a', '45B Public Section A', true, 45001),
  ('45200000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-00000000000b', '45B Public Section B', true, 45002);

insert into public.hotel_room_links (
  id, hotel_id, room_number, label, room_token, restaurant_menu_url, is_active, notes
)
values
  ('45300000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-00000000000a', '45B-A-101', 'Synthetic A', 'RoomA_000000000000000001', 'https://example.invalid/menu-a', true, 'Synthetic internal note A'),
  ('45300000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-00000000000b', '45B-B-201', 'Synthetic B', 'RoomB_000000000000000002', 'https://example.invalid/menu-b', true, 'Synthetic internal note B');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  visible_public integer;
begin
  select count(*) into visible_public
  from public.hotel_sections
  where id = '45200000-0000-4000-8000-000000000001';
  if visible_public <> 1 then
    raise exception 'anon could not read enabled public content';
  end if;

  begin
    insert into public.hotel_analytics_events (hotel_id, hotel_slug, event_type)
    values ('45000000-0000-4000-8000-00000000000a', '45b-synthetic-hotel-a', 'page_view');
    raise exception 'anon inserted analytics directly';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform 1 from public.hotel_room_links limit 1;
    raise exception 'anon listed room links';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '45100000-0000-4000-8000-000000000001', true);

do $$
declare
  visible_a integer;
  visible_b integer;
  affected integer;
begin
  select count(*) into visible_a from public.hotels where id = '45000000-0000-4000-8000-00000000000a';
  select count(*) into visible_b from public.hotels where id = '45000000-0000-4000-8000-00000000000b';
  if visible_a <> 1 or visible_b <> 0 then
    raise exception 'visualizador hotel isolation failed';
  end if;

  update public.hotel_sections set title = title where id = '45200000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'visualizador managed hotel content';
  end if;

  if exists (select 1 from public.hotel_room_links) then
    raise exception 'visualizador read editor-only room links';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '45100000-0000-4000-8000-000000000002', true);
do $$
declare
  affected integer;
begin
  update public.hotel_sections
  set title = '45B Operator Updated Section A'
  where id = '45200000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'operador could not manage allowed hotel A content';
  end if;

  update public.hotel_sections set title = title where id = '45200000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'operador A managed hotel B content';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '45100000-0000-4000-8000-000000000003', true);
do $$
declare
  visible_a integer;
  visible_b integer;
  affected integer;
begin
  select count(*) into visible_a from public.hotel_room_links where id = '45300000-0000-4000-8000-000000000001';
  select count(*) into visible_b from public.hotel_room_links where id = '45300000-0000-4000-8000-000000000002';
  if visible_a <> 1 or visible_b <> 0 then
    raise exception 'editor room-link hotel isolation failed';
  end if;

  insert into public.hotel_room_links (
    id, hotel_id, room_number, room_token, is_active, notes
  ) values (
    '45300000-0000-4000-8000-000000000003',
    '45000000-0000-4000-8000-00000000000a',
    '45B-A-102',
    'RoomA_000000000000000003',
    true,
    'Synthetic editor-created room'
  );

  update public.hotel_room_links set notes = 'Synthetic editor update'
  where id = '45300000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'editor could not update own hotel room link';
  end if;

  update public.hotel_room_links set notes = notes
  where id = '45300000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'editor A updated hotel B room link';
  end if;

  begin
    delete from public.hotel_room_links where id = '45300000-0000-4000-8000-000000000001';
    raise exception 'editor deleted a room link despite missing DELETE privilege';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.admin_update_hotel_user(
      '45100000-0000-4000-8000-000000000004',
      '45B Admin A',
      '45b-admin-a@example.invalid',
      'administrador',
      true
    );
    raise exception 'editor executed the administrator RPC';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values (
      'hotel-assets',
      '45000000-0000-4000-8000-00000000000a/logo/45400000-0000-4000-8000-000000000001.png'
    );
    raise exception 'authenticated inserted hotel-assets object without a Storage RLS policy';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '45100000-0000-4000-8000-000000000004', true);
do $$
declare
  visible_a integer;
  visible_b integer;
  affected integer;
begin
  select count(*) into visible_a from public.hotels where id = '45000000-0000-4000-8000-00000000000a';
  select count(*) into visible_b from public.hotels where id = '45000000-0000-4000-8000-00000000000b';
  if visible_a <> 1 or visible_b <> 0 then
    raise exception 'administrator hotel A/B SELECT isolation failed';
  end if;

  update public.hotel_sections set title = title where id = '45200000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'administrator A mutated hotel B content';
  end if;

  begin
    update public.hotels set name = name where id = '45000000-0000-4000-8000-00000000000b';
    raise exception 'administrator mutated hotels directly';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role service_role;
select public.record_admin_audit_event(
  '45100000-0000-4000-8000-000000000004',
  '45000000-0000-4000-8000-00000000000a',
  'synthetic.hotel_a',
  'test_fixture',
  null,
  '{"source":"synthetic_a","active":true}'::jsonb,
  '45b-synthetic-a'
);
select public.record_admin_audit_event(
  '45100000-0000-4000-8000-000000000006',
  '45000000-0000-4000-8000-00000000000b',
  'synthetic.hotel_b',
  'test_fixture',
  null,
  '{"source":"synthetic_b","active":true}'::jsonb,
  '45b-synthetic-b'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '45100000-0000-4000-8000-000000000004', true);
do $$
declare
  visible_a integer;
  visible_b integer;
  active_admins integer;
begin
  select count(*) into visible_a
  from public.admin_audit_log
  where action = 'synthetic.hotel_a'
    and metadata = '{"source":"synthetic_a","active":true}'::jsonb;
  select count(*) into visible_b
  from public.admin_audit_log
  where action = 'synthetic.hotel_b';
  if visible_a <> 1 or visible_b <> 0 then
    raise exception 'audit log hotel A/B isolation or scalar metadata failed';
  end if;

  begin
    perform public.admin_update_hotel_user(
      '45100000-0000-4000-8000-000000000004',
      '45B Admin A',
      '45b-admin-a@example.invalid',
      'editor',
      true
    );
    raise exception 'administrator removed their own access';
  exception when insufficient_privilege then
    null;
  end;

  -- Non-self transition: two active admins become one. This exercises the locked
  -- transactional count without being rejected by the separate self-lockout rule.
  perform public.admin_update_hotel_user(
    '45100000-0000-4000-8000-000000000005',
    '45B Second Admin A',
    '45b-second-admin-a@example.invalid',
    'editor',
    true
  );

  select count(*) into active_admins
  from public.profiles
  where hotel_id = '45000000-0000-4000-8000-00000000000a'
    and is_active = true
    and lower(trim(coalesce(role, ''))) in ('administrador', 'admin', 'owner');
  if active_admins <> 1 then
    raise exception 'last-administrator invariant failed after non-self transition';
  end if;

  if not exists (
    select 1
    from public.admin_audit_log
    where action = 'user.access_updated'
      and entity_id = '45100000-0000-4000-8000-000000000005'
      and metadata = jsonb_build_object(
        'previous_role', 'administrador',
        'new_role', 'editor',
        'previous_status', true,
        'new_status', true
      )
  ) then
    raise exception 'last-admin transition audit metadata is incompatible';
  end if;
end;
$$;

rollback;

-- CONCURRENCY REMAINS PENDING: a sequential script cannot prove advisory-lock behavior.
-- Run two simultaneous transactions against a fresh copy of the same synthetic fixtures:
-- session A authenticates as Admin A and targets Second Admin A; session B authenticates
-- as Second Admin A and targets Admin A. Hold session A before commit, then start session B.
-- Session B must wait for the hotel advisory lock. After the winner commits, the waiting
-- session must re-read its actor and fail if that actor lost administrator access. Verify
-- that exactly one active administrator remains. Record timings/backend IDs and do not mark
-- concurrency approved until blocking and the final invariant are observed in two sessions.
