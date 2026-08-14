-- Sprint 45B: append-only administrative audit log.

do $$
begin
  if to_regclass('public.admin_audit_log') is not null then
    raise exception '45B audit preflight failed: public.admin_audit_log already exists and must be reviewed';
  end if;

  if to_regprocedure(
    'public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)'
  ) is not null then
    raise exception '45B audit preflight failed: record_admin_audit_event with the expected signature already exists and must be reviewed';
  end if;
end;
$$;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid not null,
  hotel_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  request_id text null,
  constraint admin_audit_log_action_check
    check (length(action) between 1 and 80 and action ~ '^[a-z0-9._-]+$'),
  constraint admin_audit_log_entity_type_check
    check (length(entity_type) between 1 and 80 and entity_type ~ '^[a-z0-9._-]+$'),
  constraint admin_audit_log_request_id_check
    check (request_id is null or length(request_id) between 1 and 100),
  constraint admin_audit_log_metadata_check
    check (
      pg_catalog.jsonb_typeof(metadata) = 'object'
      and pg_catalog.octet_length(metadata::text) <= 2048
      and not pg_catalog.jsonb_path_exists(
        metadata,
        '$.* ? (@.type() == "object" || @.type() == "array")'::jsonpath
      )
    ),
  constraint admin_audit_log_metadata_sensitive_keys_check
    check (
      not pg_catalog.jsonb_path_exists(
        metadata,
        '$.keyvalue() ? (@.key like_regex "^(password|senha|roomtoken|room_token|token|jwt|service_role|payload|cookie|authorization)$" flag "i")'::jsonpath
      )
    )
);

create index admin_audit_log_hotel_created_at_idx
  on public.admin_audit_log(hotel_id, created_at desc);
create index admin_audit_log_actor_created_at_idx
  on public.admin_audit_log(actor_user_id, created_at desc);
create index admin_audit_log_entity_idx
  on public.admin_audit_log(entity_type, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "45b_admin_read_own_hotel_audit"
  on public.admin_audit_log
  for select
  to authenticated
  using (public.has_active_hotel_role(hotel_id, 'administrador'));

revoke all on table public.admin_audit_log from public, anon, authenticated;
revoke all on table public.admin_audit_log from service_role;
grant select on table public.admin_audit_log to authenticated;

create function public.record_admin_audit_event(
  p_actor_user_id uuid,
  p_hotel_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if p_actor_user_id is null or p_hotel_id is null then
    raise exception using errcode = '22023', message = 'audit_actor_and_hotel_required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_user_id
      and p.hotel_id = p_hotel_id
      and p.is_active = true
      and pg_catalog.lower(pg_catalog.btrim(coalesce(p.role, ''))) in (
        'visualizador', 'operador', 'editor', 'administrador', 'admin', 'owner'
      )
  ) then
    raise exception using errcode = '42501', message = 'audit_actor_not_authorized';
  end if;

  if p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 2048
    or pg_catalog.jsonb_path_exists(
      p_metadata,
      '$.* ? (@.type() == "object" || @.type() == "array")'::jsonpath
    )
    or pg_catalog.jsonb_path_exists(
      p_metadata,
      '$.keyvalue() ? (@.key like_regex "^(password|senha|roomtoken|room_token|token|jwt|service_role|payload|cookie|authorization)$" flag "i")'::jsonpath
    )
  then
    raise exception using errcode = '22023', message = 'audit_metadata_invalid';
  end if;

  insert into public.admin_audit_log (
    actor_user_id, hotel_id, action, entity_type, entity_id, metadata, request_id
  ) values (
    p_actor_user_id, p_hotel_id, p_action, p_entity_type, p_entity_id,
    p_metadata, nullif(pg_catalog.btrim(p_request_id), '')
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.record_admin_audit_event(uuid, uuid, text, text, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_admin_audit_event(uuid, uuid, text, text, uuid, jsonb, text)
  to service_role;

comment on table public.admin_audit_log is
  'Append-only for application roles; database owner/superuser retains operational authority. Historical UUIDs intentionally have no destructive foreign keys.';
comment on function public.record_admin_audit_event(uuid, uuid, text, text, uuid, jsonb, text) is
  'Only application audit writer. SECURITY DEFINER validates active actor/hotel and accepts only shallow scalar metadata; executable solely by service_role.';
