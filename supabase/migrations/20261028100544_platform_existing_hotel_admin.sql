begin;

-- Extend the controlled writer without changing its validation, privileges or history.
do $$ declare definition text; begin
  select pg_get_functiondef('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure) into definition;
  if strpos(definition, '''hotel.created''') = 0 or strpos(definition, '''hotel.admin_added''') > 0
    or strpos(definition, 'platform_audit_metadata_invalid') = 0 then
    raise exception 'Platform audit contract drifted; review before applying';
  end if;
  execute replace(definition, '''hotel.created''', '''hotel.created'',''hotel.admin_added''');
end $$;

create function public.assert_platform_hotel_admin_target(p_hotel_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_status text;
begin
  -- Lock authorization through the transaction, including concurrent deactivation.
  perform 1 from public.platform_users pu where pu.user_id=auth.uid()
    and pu.role='platform_admin' and pu.is_active for share;
  if auth.uid() is null or not found then
    raise exception using errcode='42501',message='active_platform_admin_required';
  end if;
  select h.platform_status into target_status from public.hotels h where h.id=p_hotel_id for update;
  if not found then raise exception using errcode='P0002',message='platform_hotel_not_found'; end if;
  if target_status='archived' then raise exception using errcode='55000',message='platform_hotel_archived'; end if;
end $$;
revoke all on function public.assert_platform_hotel_admin_target(uuid) from public,anon,authenticated,service_role;

create function public.check_platform_hotel_admin_creation(p_hotel_id uuid,p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare normalized_email text:=pg_catalog.lower(pg_catalog.btrim(p_email));
begin
  perform public.assert_platform_hotel_admin_target(p_hotel_id);
  if normalized_email is null or length(normalized_email)>254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023',message='platform_admin_email_invalid';
  end if;
  if exists(select 1 from auth.users u where pg_catalog.lower(u.email)=normalized_email)
    or exists(select 1 from public.profiles p where pg_catalog.lower(p.email)=normalized_email) then
    raise exception using errcode='23505',message='platform_admin_identity_exists';
  end if;
  return true;
end $$;

create function public.add_platform_hotel_admin(
  p_hotel_id uuid,p_user_id uuid,p_email text,p_full_name text,p_operation_id uuid
)
returns table(hotel_id uuid,admin_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  normalized_email text:=pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_name text:=pg_catalog.btrim(p_full_name);
  identity_email text;
  provenance jsonb;
  existing_hotel uuid;
  profile_exists boolean;
begin
  perform public.assert_platform_hotel_admin_target(p_hotel_id);
  if p_user_id is null or p_operation_id is null or normalized_name is null
    or length(normalized_name) not between 1 and 120 or normalized_email is null
    or length(normalized_email)>254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023',message='platform_admin_fields_invalid';
  end if;
  select pg_catalog.lower(u.email),u.raw_app_meta_data->'platform_hotel_admin'
    into identity_email,provenance from auth.users u where u.id=p_user_id for update;
  if not found or identity_email is distinct from normalized_email
    or provenance->>'operation_id' is distinct from p_operation_id::text
    or provenance->>'hotel_id' is distinct from p_hotel_id::text
    or provenance->>'actor_id' is distinct from auth.uid()::text then
    raise exception using errcode='42501',message='platform_admin_identity_provenance_invalid';
  end if;
  if exists(select 1 from public.platform_users pu where pu.user_id=p_user_id) then
    raise exception using errcode='55000',message='platform_admin_identity_incompatible';
  end if;
  select p.hotel_id into existing_hotel from public.profiles p where p.id=p_user_id for update;
  profile_exists:=found;
  if profile_exists and existing_hotel is not null then
    raise exception using errcode='23505',message='platform_admin_identity_exists';
  end if;
  if exists(select 1 from public.profiles p where pg_catalog.lower(p.email)=normalized_email and p.id<>p_user_id) then
    raise exception using errcode='23505',message='platform_admin_identity_exists';
  end if;
  -- A profile automatically created by an Auth hook may exist, but must be unbound.
  if profile_exists then
    update public.profiles p set email=normalized_email,full_name=normalized_name,
      role='administrador',hotel_id=p_hotel_id,is_active=true,updated_at=now() where p.id=p_user_id;
  else
    insert into public.profiles(id,email,full_name,role,hotel_id,is_active)
      values(p_user_id,normalized_email,normalized_name,'administrador',p_hotel_id,true);
  end if;
  -- Existing policy excludes names/emails from global audit metadata. UUID identifies the user.
  perform public.record_platform_audit_event(auth.uid(),'hotel.admin_added','hotel',p_hotel_id,
    pg_catalog.jsonb_build_object('admin_user_id',p_user_id,'role','administrador','is_active',true,'result','success'),p_operation_id::text);
  return query select p_hotel_id,p_user_id;
end $$;
revoke all on function public.check_platform_hotel_admin_creation(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.add_platform_hotel_admin(uuid,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.check_platform_hotel_admin_creation(uuid,text) to authenticated;
grant execute on function public.add_platform_hotel_admin(uuid,uuid,text,text,uuid) to authenticated;
comment on function public.add_platform_hotel_admin(uuid,uuid,text,text,uuid) is
  'Active Platform Admin adds a newly provisioned identity to an existing non-archived hotel. No transfer, replacement, lifecycle or entitlement changes.';
commit;