-- Sprint 45B: transactional profile update with last-active-admin protection.

do $$
begin
  if to_regprocedure('public.admin_update_hotel_user(uuid,text,text,text,boolean)') is not null then
    raise exception '45B last-admin preflight failed: public.admin_update_hotel_user(uuid,text,text,text,boolean) already exists and must be reviewed before applying';
  end if;
end;
$$;

create function public.admin_update_hotel_user(
  p_target_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_is_active boolean
)
returns table (
  id uuid,
  hotel_id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  actor_hotel_id uuid;
  active_admin_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select * into actor_profile
  from public.profiles p
  where p.id = auth.uid();

  if actor_profile.id is null
    or actor_profile.is_active is not true
    or lower(trim(coalesce(actor_profile.role, ''))) not in ('administrador', 'admin', 'owner')
    or actor_profile.hotel_id is null
  then
    raise exception using errcode = '42501', message = 'administrator_required';
  end if;

  actor_hotel_id := actor_profile.hotel_id;

  if p_role not in ('visualizador', 'operador', 'editor', 'administrador') then
    raise exception using errcode = '22023', message = 'invalid_role';
  end if;

  if nullif(trim(p_full_name), '') is null or nullif(trim(p_email), '') is null then
    raise exception using errcode = '22023', message = 'invalid_profile_fields';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_hotel_id::text, 45002));

  -- Re-read and lock the actor only after taking the hotel-wide lock. Taking row locks
  -- first would allow two administrators targeting each other to deadlock.
  select * into actor_profile
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if actor_profile.id is null
    or actor_profile.is_active is not true
    or lower(trim(coalesce(actor_profile.role, ''))) not in ('administrador', 'admin', 'owner')
    or actor_profile.hotel_id is null
    or actor_profile.hotel_id <> actor_hotel_id
  then
    raise exception using errcode = '42501', message = 'administrator_required';
  end if;

  select * into target_profile
  from public.profiles p
  where p.id = p_target_user_id
    and p.hotel_id = actor_profile.hotel_id
  for update;

  if target_profile.id is null then
    raise exception using errcode = 'P0002', message = 'target_profile_not_found';
  end if;

  -- Product rule: administrators cannot remove, demote, or deactivate their own
  -- access. A different active administrator must perform that operation.
  if target_profile.id = actor_profile.id
    and (p_is_active is not true or p_role <> 'administrador')
  then
    raise exception using errcode = '42501', message = 'cannot_remove_own_administrator_access';
  end if;

  update public.profiles p
  set full_name = trim(p_full_name),
      email = lower(trim(p_email)),
      role = p_role,
      is_active = p_is_active,
      updated_at = now()
  where p.id = target_profile.id;

  select count(*) into active_admin_count
  from public.profiles p
  where p.hotel_id = actor_profile.hotel_id
    and p.is_active = true
    and lower(trim(coalesce(p.role, ''))) in ('administrador', 'admin', 'owner');

  if active_admin_count < 1 then
    raise exception using errcode = '23514', message = 'last_active_administrator_required';
  end if;

  perform public.record_admin_audit_event(
    actor_profile.id,
    actor_profile.hotel_id,
    'user.access_updated',
    'profile',
    target_profile.id,
    jsonb_build_object(
      'previous_role', target_profile.role,
      'new_role', p_role,
      'previous_status', target_profile.is_active,
      'new_status', p_is_active
    ),
    null
  );

  return query
  select p.id, p.hotel_id, p.full_name, p.email, p.role, p.is_active
  from public.profiles p
  where p.id = target_profile.id;
end;
$$;

revoke all on function public.admin_update_hotel_user(uuid, text, text, text, boolean)
  from public, anon, service_role;
grant execute on function public.admin_update_hotel_user(uuid, text, text, text, boolean)
  to authenticated;

comment on function public.admin_update_hotel_user(uuid, text, text, text, boolean) is
  'Authenticated-admin RPC. Serializes changes per hotel, prevents administrator self-lockout, and rolls back if no active administrator would remain.';
