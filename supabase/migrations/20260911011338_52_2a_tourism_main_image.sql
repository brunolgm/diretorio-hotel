-- Sprint 52.2A: image association only. No Storage writes or entitlement changes.
do $$ begin
  if to_regclass('public.hotel_tourism_items') is null
    or to_regprocedure('tourism_private.mutation_hotel()') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null then
    raise exception '52.2A preflight: tourism foundation or audit missing';
  end if;
  if to_regprocedure('public.update_current_hotel_tourism_image(uuid,text,timestamptz)') is not null then
    raise exception '52.2A preflight: image RPC already exists';
  end if;
end $$;

create function public.update_current_hotel_tourism_image(
  p_item_id uuid,
  p_main_image_path text,
  p_expected_updated_at timestamptz
)
returns table(item_id uuid,updated_at timestamptz,previous_image_path text,main_image_path text)
language plpgsql security definer set search_path='' as $$
declare
  target uuid:=tourism_private.mutation_hotel();
  previous public.hotel_tourism_items;
  resulting public.hotel_tourism_items;
begin
  select * into previous from public.hotel_tourism_items i
    where i.id=p_item_id and i.hotel_id=target for update;
  if not found then raise exception using errcode='P0002',message='tourism_item_not_found'; end if;
  if p_expected_updated_at is null or p_expected_updated_at<>previous.updated_at then
    raise exception using errcode='40001',message='tourism_revision_conflict'; end if;
  if p_main_image_path is not distinct from previous.main_image_path then
    raise exception using errcode='22023',message='tourism_image_unchanged'; end if;
  if p_main_image_path is not null and (
    pg_catalog.length(p_main_image_path)>512 or p_main_image_path !~ (
      '^'||target::text||'/tourism/'||previous.id::text||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')) then
    raise exception using errcode='22023',message='tourism_image_path_invalid';
  end if;
  update public.hotel_tourism_items i set main_image_path=p_main_image_path
    where i.id=previous.id and i.hotel_id=target returning * into resulting;
  perform public.record_admin_audit_event(auth.uid(),target,'tourism.image_updated','hotel_tourism_item',previous.id,
    pg_catalog.jsonb_build_object('had_image',previous.main_image_path is not null,
      'has_image',resulting.main_image_path is not null),null);
  return query select resulting.id,resulting.updated_at,previous.main_image_path,resulting.main_image_path;
end $$;

revoke all on function public.update_current_hotel_tourism_image(uuid,text,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.update_current_hotel_tourism_image(uuid,text,timestamptz) to authenticated;

comment on function public.update_current_hotel_tourism_image(uuid,text,timestamptz) is
  'Operator image association/removal with tenant ownership, expected revision and atomic audit. Returns previous/current paths for server-side cleanup after commit. Does not upload or validate Storage bytes.';
