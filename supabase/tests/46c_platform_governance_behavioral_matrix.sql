-- Self-contained Sprint 46C governance matrix for a disposable local database only.
-- Synthetic fixtures, helper trigger and all writes are reverted by ROLLBACK.

begin;

do $$
declare
  instance_id_is_nullable boolean;
begin
  if to_regprocedure('public.get_platform_hotel_detail(uuid)') is null
    or to_regprocedure('public.update_platform_hotel_brand(uuid,text)') is null
    or to_regprocedure('public.update_platform_hotel_status(uuid,text)') is null
    or to_regclass('public.platform_audit_log') is null
  then
    raise exception '46C behavioral preflight failed: apply 45B and 46A-46C in the disposable lab first';
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
    raise exception '46C behavioral preflight failed: auth.users.instance_id UUID column is missing';
  end if;

  if not instance_id_is_nullable and to_regclass('auth.instances') is null then
    raise exception '46C behavioral preflight failed: required auth.instances table is missing';
  end if;

  if exists (select 1 from public.hotels where platform_status <> 'active') then
    raise exception '46C behavioral preflight failed: pre-existing hotels were not preserved as active';
  end if;

  if exists (
    select 1 from public.hotels
    where id = any (array[
      '46c00000-0000-4000-8000-000000000001',
      '46c00000-0000-4000-8000-000000000002',
      '46c00000-0000-4000-8000-000000000003',
      '46c00000-0000-4000-8000-000000000004'
    ]::uuid[]) or slug like '46c-governance-%'
  ) or exists (
    select 1 from auth.users
    where id = any (array[
      '46c10000-0000-4000-8000-000000000001',
      '46c10000-0000-4000-8000-000000000002',
      '46c10000-0000-4000-8000-000000000003',
      '46c10000-0000-4000-8000-000000000004',
      '46c10000-0000-4000-8000-000000000005',
      '46c10000-0000-4000-8000-000000000006',
      '46c10000-0000-4000-8000-000000000007'
    ]::uuid[]) or email like '46c-%@example.invalid'
  ) or exists (
    select 1 from public.profiles
    where id = any (array[
      '46c10000-0000-4000-8000-000000000001',
      '46c10000-0000-4000-8000-000000000002',
      '46c10000-0000-4000-8000-000000000003',
      '46c10000-0000-4000-8000-000000000004',
      '46c10000-0000-4000-8000-000000000005',
      '46c10000-0000-4000-8000-000000000006',
      '46c10000-0000-4000-8000-000000000007'
    ]::uuid[])
  ) or exists (
    select 1 from public.platform_users
    where user_id = any (array[
      '46c10000-0000-4000-8000-000000000001',
      '46c10000-0000-4000-8000-000000000002',
      '46c10000-0000-4000-8000-000000000003',
      '46c10000-0000-4000-8000-000000000004',
      '46c10000-0000-4000-8000-000000000005',
      '46c10000-0000-4000-8000-000000000006',
      '46c10000-0000-4000-8000-000000000007'
    ]::uuid[])
  ) or exists (
    select 1 from public.hotel_sections
    where id = any (array[
      '46c30000-0000-4000-8000-000000000001',
      '46c30000-0000-4000-8000-000000000002',
      '46c30000-0000-4000-8000-000000000003',
      '46c30000-0000-4000-8000-000000000004'
    ]::uuid[])
  ) or exists (
    select 1 from public.hotel_room_links
    where id = any (array[
      '46c40000-0000-4000-8000-000000000001',
      '46c40000-0000-4000-8000-000000000002',
      '46c40000-0000-4000-8000-000000000003',
      '46c40000-0000-4000-8000-000000000004'
    ]::uuid[])
      or room_token in (
        '46cActiveRoomToken000001', '46cDraftRoomToken0000001',
        '46cSuspRoomToken00000001', '46cArchRoomToken00000001'
      )
  ) or exists (
    select 1 from public.platform_audit_log
    where entity_id = any (array[
      '46c00000-0000-4000-8000-000000000001',
      '46c00000-0000-4000-8000-000000000002',
      '46c00000-0000-4000-8000-000000000003',
      '46c00000-0000-4000-8000-000000000004'
    ]::uuid[])
  ) or exists (
    select 1 from auth.instances
    where id = '46c20000-0000-4000-8000-000000000001'
  ) then
    raise exception '46C fixture collision: aborting before synthetic setup';
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
        'id', '46c20000-0000-4000-8000-000000000001',
        'uuid', '46c20000-0000-4000-8000-000000000001',
        'raw_base_config', '{}',
        'created_at', now(),
        'updated_at', now()
      )
    )).*;
  end if;
end;
$$;

insert into public.hotels (
  id, name, slug, subdomain, city, brand_code, theme_preset, platform_status,
  logo_url, hero_image_url, wifi_name, wifi_password, whatsapp_number
)
values
  (
    '46c00000-0000-4000-8000-000000000001', '46C Governance Alpha',
    '46c-governance-alpha', '46c-alpha', '46C Synthetic City', null, 'mercure', 'active',
    'https://example.invalid/46c-logo.png', 'https://example.invalid/46c-hero.png',
    '46C Hidden Wifi', '46C-SECRET-PASSWORD', '+5500000000000'
  ),
  (
    '46c00000-0000-4000-8000-000000000002', '46C Governance Draft',
    '46c-governance-draft', null, '46C Synthetic City', 'novotel', 'novotel', 'draft',
    null, null, '46C Hidden Wifi Draft', '46C-DRAFT-SECRET', null
  ),
  (
    '46c00000-0000-4000-8000-000000000003', '46C Governance Suspended',
    '46c-governance-suspended', '46c-suspended', '46C Synthetic City', 'grand-mercure',
    'grand-mercure', 'suspended', null, null, '46C Hidden Wifi Suspended',
    '46C-SUSPENDED-SECRET', null
  ),
  (
    '46c00000-0000-4000-8000-000000000004', '46C Governance Archived',
    '46c-governance-archived', '46c-archived', '46C Synthetic City', 'mercure',
    'mercure', 'archived', null, null, '46C Hidden Wifi Archived',
    '46C-ARCHIVED-SECRET', null
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
    else '46c20000-0000-4000-8000-000000000001'::uuid
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
  ('46c10000-0000-4000-8000-000000000001'::uuid, '46c-platform-active@example.invalid'),
  ('46c10000-0000-4000-8000-000000000002'::uuid, '46c-platform-inactive@example.invalid'),
  ('46c10000-0000-4000-8000-000000000003'::uuid, '46c-hotel-only@example.invalid'),
  ('46c10000-0000-4000-8000-000000000004'::uuid, '46c-no-association@example.invalid'),
  ('46c10000-0000-4000-8000-000000000005'::uuid, '46c-archived-admin@example.invalid'),
  ('46c10000-0000-4000-8000-000000000006'::uuid, '46c-suspended-admin@example.invalid'),
  ('46c10000-0000-4000-8000-000000000007'::uuid, '46c-draft-admin@example.invalid')
) fixture(id, email);

delete from public.profiles
where id = any (array[
  '46c10000-0000-4000-8000-000000000001',
  '46c10000-0000-4000-8000-000000000002',
  '46c10000-0000-4000-8000-000000000003',
  '46c10000-0000-4000-8000-000000000004',
  '46c10000-0000-4000-8000-000000000005',
  '46c10000-0000-4000-8000-000000000006',
  '46c10000-0000-4000-8000-000000000007'
]::uuid[]);

insert into public.profiles (id, email, full_name, role, hotel_id, is_active)
values
  (
    '46c10000-0000-4000-8000-000000000003', '46c-hotel-only@example.invalid',
    '46C Hotel Only', 'administrador', '46c00000-0000-4000-8000-000000000001', true
  ),
  (
    '46c10000-0000-4000-8000-000000000005', '46c-archived-admin@example.invalid',
    '46C Archived Admin', 'administrador', '46c00000-0000-4000-8000-000000000004', true
  ),
  (
    '46c10000-0000-4000-8000-000000000006', '46c-suspended-admin@example.invalid',
    '46C Suspended Admin', 'administrador', '46c00000-0000-4000-8000-000000000003', true
  ),
  (
    '46c10000-0000-4000-8000-000000000007', '46c-draft-admin@example.invalid',
    '46C Draft Admin', 'administrador', '46c00000-0000-4000-8000-000000000002', true
  );

insert into public.hotel_sections (id, hotel_id, title, enabled)
values
  ('46c30000-0000-4000-8000-000000000001', '46c00000-0000-4000-8000-000000000001', '46C Active Section', true),
  ('46c30000-0000-4000-8000-000000000002', '46c00000-0000-4000-8000-000000000002', '46C Draft Section', true),
  ('46c30000-0000-4000-8000-000000000003', '46c00000-0000-4000-8000-000000000003', '46C Suspended Section', true),
  ('46c30000-0000-4000-8000-000000000004', '46c00000-0000-4000-8000-000000000004', '46C Archived Section', true);

insert into public.hotel_room_links (id, hotel_id, room_number, room_token, is_active)
values
  ('46c40000-0000-4000-8000-000000000001', '46c00000-0000-4000-8000-000000000001', '46C-A', '46cActiveRoomToken000001', true),
  ('46c40000-0000-4000-8000-000000000002', '46c00000-0000-4000-8000-000000000002', '46C-D', '46cDraftRoomToken0000001', true),
  ('46c40000-0000-4000-8000-000000000003', '46c00000-0000-4000-8000-000000000003', '46C-S', '46cSuspRoomToken00000001', true),
  ('46c40000-0000-4000-8000-000000000004', '46c00000-0000-4000-8000-000000000004', '46C-R', '46cArchRoomToken00000001', true);

do $$
declare
  lifecycle_safe_room_links integer;
begin
  begin
    update public.hotels
    set brand_code = '46c-invalid-brand'
    where id = '46c00000-0000-4000-8000-000000000001';
    raise exception '46C base constraint accepted an arbitrary brand';
  exception when check_violation then null;
  end;

  if (select brand_code from public.hotels where id = '46c00000-0000-4000-8000-000000000001') is not null then
    raise exception '46C failed brand constraint attempt changed the canonical nullable value';
  end if;

  select count(*) into lifecycle_safe_room_links
  from public.hotel_room_links rl
  join public.hotels h on h.id = rl.hotel_id and h.platform_status = 'active'
  where rl.id = any (array[
    '46c40000-0000-4000-8000-000000000001',
    '46c40000-0000-4000-8000-000000000002',
    '46c40000-0000-4000-8000-000000000003',
    '46c40000-0000-4000-8000-000000000004'
  ]::uuid[]) and rl.is_active = true;

  if lifecycle_safe_room_links <> 1 then
    raise exception '46C lifecycle-safe room token predicate did not isolate the active hotel';
  end if;
end;
$$;

insert into public.platform_users (user_id, role, is_active)
values
  ('46c10000-0000-4000-8000-000000000001', 'platform_admin', true),
  ('46c10000-0000-4000-8000-000000000002', 'platform_admin', false);

select set_config(
  'test.s46c_audit_baseline',
  (select count(*)::text from public.platform_audit_log),
  true
);

-- Anon has no EXECUTE on any governance contract.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare
  public_hotels_count integer;
  public_sections_count integer;
begin
  select count(*) into public_hotels_count
  from public.public_hotels
  where slug like '46c-governance-%';

  if public_hotels_count <> 1
    or not exists (
      select 1 from public.public_hotels where slug = '46c-governance-alpha'
    )
    or exists (
      select 1 from public.public_hotels
      where slug in (
        '46c-governance-draft', '46c-governance-suspended', '46c-governance-archived'
      )
    )
  then
    raise exception '46C public_hotels did not resolve only the active fixture';
  end if;

  select count(*) into public_sections_count
  from public.hotel_sections
  where id = any (array[
    '46c30000-0000-4000-8000-000000000001',
    '46c30000-0000-4000-8000-000000000002',
    '46c30000-0000-4000-8000-000000000003',
    '46c30000-0000-4000-8000-000000000004'
  ]::uuid[]);

  if public_sections_count <> 1
    or not public.is_hotel_publicly_active('46c00000-0000-4000-8000-000000000001')
    or public.is_hotel_publicly_active('46c00000-0000-4000-8000-000000000002')
    or public.is_hotel_publicly_active('46c00000-0000-4000-8000-000000000003')
    or public.is_hotel_publicly_active('46c00000-0000-4000-8000-000000000004')
  then
    raise exception '46C public content/lifecycle helper allowed a non-active hotel';
  end if;

  begin
    perform * from public.get_platform_hotel_detail('46c00000-0000-4000-8000-000000000001');
    raise exception '46C anon executed detail RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_brand(
      '46c00000-0000-4000-8000-000000000001', 'mercure'
    );
    raise exception '46C anon executed brand mutation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_status(
      '46c00000-0000-4000-8000-000000000001', 'suspended'
    );
    raise exception '46C anon executed status mutation';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Active platform_admin without profile receives minimal detail but no base-table access.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000001', true);
do $$
declare
  detail_rows integer;
  detail_payload jsonb;
  status_metrics jsonb;
  directory_rows integer;
  directory_statuses text[];
  visible_hotels integer;
begin
  if exists (
    select 1 from public.profiles
    where id = '46c10000-0000-4000-8000-000000000001'
  ) then
    raise exception '46C active platform fixture unexpectedly has a profile';
  end if;

  select count(*), jsonb_agg(to_jsonb(d))
    into detail_rows, detail_payload
  from public.get_platform_hotel_detail('46c00000-0000-4000-8000-000000000001') d;

  if detail_rows <> 1
    or detail_payload -> 0 ->> 'name' <> '46C Governance Alpha'
    or detail_payload -> 0 ->> 'platform_status' <> 'active'
  then
    raise exception '46C active platform detail is invalid';
  end if;

  if detail_payload::text ~* '(wifi|46C-SECRET|whatsapp|breakfast|checkin|checkout|room_token|profiles|analytics|notes)'
  then
    raise exception '46C detail exposed a prohibited field or value';
  end if;

  select m.hotels_by_status into status_metrics
  from public.get_platform_hotel_metrics() m;
  if coalesce((status_metrics ->> 'active')::integer, 0) < 1
    or coalesce((status_metrics ->> 'draft')::integer, 0) < 1
    or coalesce((status_metrics ->> 'suspended')::integer, 0) < 1
    or coalesce((status_metrics ->> 'archived')::integer, 0) < 1
  then
    raise exception '46C lifecycle metrics do not distinguish all canonical states';
  end if;

  select count(*), array_agg(d.platform_status order by d.platform_status)
    into directory_rows, directory_statuses
  from public.list_platform_hotels('46C Governance', 1, 20) d;

  if directory_rows <> 4
    or directory_statuses is distinct from array['active', 'archived', 'draft', 'suspended']::text[]
  then
    raise exception '46C global directory hid one or more non-active lifecycle states';
  end if;

  select count(*) into visible_hotels from public.hotels;
  if visible_hotels <> 0 then
    raise exception '46C platform identity leaked through hotels RLS';
  end if;

  begin
    update public.hotels set brand_code = 'mercure'
    where id = '46c00000-0000-4000-8000-000000000001';
    raise exception '46C platform browser performed direct hotels UPDATE';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.platform_audit_log;
    raise exception '46C platform browser read platform audit directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_audit_log (
      actor_user_id, action, entity_type, entity_id
    ) values (
      '46c10000-0000-4000-8000-000000000001', 'hotel.brand_updated', 'hotel',
      '46c00000-0000-4000-8000-000000000001'
    );
    raise exception '46C platform browser inserted platform audit directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_audit_log set action = 'tampered';
    raise exception '46C platform browser updated platform audit directly';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.platform_audit_log;
    raise exception '46C platform browser deleted platform audit directly';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.update_platform_hotel_brand(
      '46c00000-0000-4000-8000-000000000001', 'arbitrary-brand'
    );
    raise exception '46C accepted an invalid brand';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform * from public.update_platform_hotel_status(
      '46c00000-0000-4000-8000-000000000001', 'disabled'
    );
    raise exception '46C accepted an invalid status';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform * from public.update_platform_hotel_brand(
      '46c99999-0000-4000-8000-000000000001', 'mercure'
    );
    raise exception '46C updated a nonexistent hotel';
  exception when no_data_found then null;
  end;
  begin
    perform * from public.update_platform_hotel_status(
      '46c00000-0000-4000-8000-000000000002', 'suspended'
    );
    raise exception '46C accepted draft to suspended';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform * from public.update_platform_hotel_brand(
      '46c00000-0000-4000-8000-000000000004', 'novotel'
    );
    raise exception '46C changed the brand of an archived hotel';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform * from public.update_platform_hotel_status(
      '46c00000-0000-4000-8000-000000000004', 'active'
    );
    raise exception '46C reactivated archived terminal lifecycle';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- Successful mutations execute as the browser role through the narrow RPCs.
select * from public.update_platform_hotel_brand(
  '46c00000-0000-4000-8000-000000000001', 'mercure'
);
select * from public.update_platform_hotel_status(
  '46c00000-0000-4000-8000-000000000001', 'suspended'
);

reset role;
do $$
declare
  brand_audits integer;
  status_audits integer;
  brand_metadata jsonb;
  status_metadata jsonb;
begin
  if (select brand_code from public.hotels where id = '46c00000-0000-4000-8000-000000000001') <> 'mercure'
    or (select platform_status from public.hotels where id = '46c00000-0000-4000-8000-000000000001') <> 'suspended'
  then
    raise exception '46C successful governance mutation was not persisted inside the test transaction';
  end if;

  select count(*)
    into brand_audits
  from public.platform_audit_log
  where actor_user_id = '46c10000-0000-4000-8000-000000000001'
    and entity_id = '46c00000-0000-4000-8000-000000000001'
    and action = 'hotel.brand_updated';

  select metadata
    into brand_metadata
  from public.platform_audit_log
  where actor_user_id = '46c10000-0000-4000-8000-000000000001'
    and entity_id = '46c00000-0000-4000-8000-000000000001'
    and action = 'hotel.brand_updated';

  select count(*)
    into status_audits
  from public.platform_audit_log
  where actor_user_id = '46c10000-0000-4000-8000-000000000001'
    and entity_id = '46c00000-0000-4000-8000-000000000001'
    and action = 'hotel.status_updated';

  select metadata
    into status_metadata
  from public.platform_audit_log
  where actor_user_id = '46c10000-0000-4000-8000-000000000001'
    and entity_id = '46c00000-0000-4000-8000-000000000001'
    and action = 'hotel.status_updated';

  if brand_audits <> 1
    or brand_metadata <> '{"new_brand":"mercure","previous_brand":null}'::jsonb
    or status_audits <> 1
    or status_metadata <> '{"new_status":"suspended","previous_status":"active"}'::jsonb
  then
    raise exception '46C same-transaction audit metadata is invalid';
  end if;
end;
$$;

-- Force the audit INSERT to fail and prove the hotel update rolls back with it.
create function pg_temp.reject_46c_platform_audit()
returns trigger
language plpgsql
as $$
begin
  raise exception '46C synthetic audit failure';
end;
$$;

create trigger test_46c_reject_platform_audit
  before insert on public.platform_audit_log
  for each row execute function pg_temp.reject_46c_platform_audit();

set local role authenticated;
select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000001', true);
do $$
begin
  begin
    perform * from public.update_platform_hotel_brand(
      '46c00000-0000-4000-8000-000000000001', 'novotel'
    );
    raise exception '46C mutation survived the forced audit failure';
  exception when raise_exception then
    if sqlerrm <> '46C synthetic audit failure' then raise; end if;
  end;
end;
$$;

reset role;
drop trigger test_46c_reject_platform_audit on public.platform_audit_log;

do $$
begin
  if (select brand_code from public.hotels where id = '46c00000-0000-4000-8000-000000000001') <> 'mercure'
    or (select count(*) from public.platform_audit_log
        where entity_id = '46c00000-0000-4000-8000-000000000001'
          and action = 'hotel.brand_updated') <> 1
  then
    raise exception '46C audit failure did not roll back the brand mutation atomically';
  end if;
end;
$$;

-- Inactive, hotel-only and unassociated users cannot call global governance RPCs.
set local role authenticated;
select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000002', true);
do $$
begin
  begin
    perform * from public.get_platform_hotel_detail('46c00000-0000-4000-8000-000000000001');
    raise exception '46C inactive platform user read detail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_brand('46c00000-0000-4000-8000-000000000001', null);
    raise exception '46C inactive platform user changed brand';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_status('46c00000-0000-4000-8000-000000000001', 'active');
    raise exception '46C inactive platform user changed status';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.get_current_platform_access()) then
    raise exception '46C hotel admin unexpectedly has a platform association';
  end if;
  if not public.has_active_hotel_role(
    '46c00000-0000-4000-8000-000000000001', 'visualizador'
  ) or (select count(*) from public.hotels
        where id = '46c00000-0000-4000-8000-000000000001') <> 1
  then
    raise exception '46C suspended hotel admin lost the correction context';
  end if;
  begin
    perform * from public.get_platform_hotel_detail('46c00000-0000-4000-8000-000000000001');
    raise exception '46C hotel admin read global detail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_brand('46c00000-0000-4000-8000-000000000001', null);
    raise exception '46C hotel admin changed global brand';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.update_platform_hotel_status('46c00000-0000-4000-8000-000000000001', 'active');
    raise exception '46C hotel admin changed global status';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000007', true);
do $$
begin
  if not public.has_active_hotel_role(
    '46c00000-0000-4000-8000-000000000002', 'visualizador'
  ) or (select count(*) from public.hotels
        where id = '46c00000-0000-4000-8000-000000000002') <> 1
  then
    raise exception '46C draft hotel admin lost the preparation context';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000005', true);
do $$
begin
  if public.has_active_hotel_role(
    '46c00000-0000-4000-8000-000000000004', 'visualizador'
  ) or exists (
    select 1 from public.hotels where id = '46c00000-0000-4000-8000-000000000004'
  ) then
    raise exception '46C archived hotel retained an operational admin context';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '46c10000-0000-4000-8000-000000000004', true);
do $$
begin
  if exists (select 1 from public.get_current_platform_access()) then
    raise exception '46C unassociated user unexpectedly has platform access';
  end if;
  begin
    perform * from public.get_platform_hotel_detail('46c00000-0000-4000-8000-000000000001');
    raise exception '46C unassociated user read detail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.platform_audit_log)
      <> current_setting('test.s46c_audit_baseline')::bigint + 2
  then
    raise exception '46C unexpected audit count after authorized and rejected operations';
  end if;
end;
$$;

rollback;
