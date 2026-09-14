-- Sprint 52.2B1 hotfix: functional revision conflicts map to HTTP 409.
-- CREATE OR REPLACE preserves existing ownership, ACLs and function comments.
-- Earlier applied migrations remain immutable.

create or replace function public.save_current_hotel_tourism_item(p_item_id uuid,p_changes jsonb,p_expected_updated_at timestamptz default null)
returns setof public.hotel_tourism_items language plpgsql security definer set search_path='' as $$
declare target uuid:=tourism_private.mutation_hotel(); previous public.hotel_tourism_items;
  candidate public.hotel_tourism_items; patch jsonb:=tourism_private.checked_patch(p_changes);
  base_slug text; attempt integer; saved boolean:=false;
begin
  if p_item_id is null then
    candidate:=pg_catalog.jsonb_populate_record(null::public.hotel_tourism_items,patch);
    candidate.id:=pg_catalog.gen_random_uuid(); candidate.hotel_id:=target;
    candidate.featured:=coalesce(candidate.featured,false);
    candidate.recommended_by_hotel:=coalesce(candidate.recommended_by_hotel,false);
    candidate.is_published:=coalesce(candidate.is_published,false);
    candidate.created_at:=pg_catalog.clock_timestamp(); candidate.updated_at:=candidate.created_at;
    select coalesce(max(i.sort_order),-1)+1 into candidate.sort_order from public.hotel_tourism_items i where i.hotel_id=target;
    base_slug:=pg_catalog.lower(pg_catalog.normalize(candidate.name,'NFD'));
    base_slug:=pg_catalog.regexp_replace(base_slug,U&'[\0300-\036f]','','g');
    base_slug:=pg_catalog.btrim(pg_catalog.regexp_replace(base_slug,'[^a-z0-9]+','-','g'),'-');
    base_slug:=coalesce(nullif(base_slug,''),'item');
    for attempt in 0..8 loop
      candidate.slug:=case when attempt=0 then pg_catalog.rtrim(pg_catalog.left(base_slug,100),'-')
        else pg_catalog.rtrim(pg_catalog.left(base_slug,60),'-')||'-'||pg_catalog.replace(candidate.id::text,'-','')||'-'||attempt::text end;
      begin
        insert into public.hotel_tourism_items select candidate.*;
        saved:=true; exit;
      exception when unique_violation then
        if not exists(select 1 from public.hotel_tourism_items i where i.hotel_id=target and i.slug=candidate.slug) then raise; end if;
      end;
    end loop;
    if not saved then raise exception using errcode='23505',message='tourism_slug_collision'; end if;
    perform public.record_admin_audit_event(auth.uid(),target,'tourism.created','hotel_tourism_item',candidate.id,
      pg_catalog.jsonb_build_object('type',candidate.type,'category_key',candidate.category_key,'is_published',candidate.is_published),null);
  else
    select * into previous from public.hotel_tourism_items i where i.id=p_item_id and i.hotel_id=target for update;
    if not found then raise exception using errcode='P0002',message='tourism_item_not_found'; end if;
    if p_expected_updated_at is null or p_expected_updated_at<>previous.updated_at then
      raise exception using errcode='PT409',message='tourism_revision_conflict'; end if;
    candidate:=pg_catalog.jsonb_populate_record(previous,patch);
    update public.hotel_tourism_items set
      name=candidate.name,
      short_description=candidate.short_description,
      full_description=candidate.full_description,
      address=candidate.address,
      map_url=candidate.map_url,
      official_website_url=candidate.official_website_url,
      phone=candidate.phone,
      whatsapp_number=candidate.whatsapp_number,
      opening_hours=candidate.opening_hours,
      price_info=candidate.price_info,
      duration_info=candidate.duration_info,
      type=candidate.type,
      category_key=candidate.category_key,
      featured=candidate.featured,
      recommended_by_hotel=candidate.recommended_by_hotel,
      is_published=candidate.is_published
    where id=previous.id returning * into candidate;
    delete from public.hotel_tourism_item_translations t where t.item_id=candidate.id and coalesce(case when previous.name is distinct from candidate.name then null else t.name end,case when previous.short_description is distinct from candidate.short_description then null else t.short_description end,case when previous.full_description is distinct from candidate.full_description then null else t.full_description end,case when previous.opening_hours is distinct from candidate.opening_hours then null else t.opening_hours end,case when previous.price_info is distinct from candidate.price_info then null else t.price_info end,case when previous.duration_info is distinct from candidate.duration_info then null else t.duration_info end) is null;
    update public.hotel_tourism_item_translations t set
      name=case when previous.name is distinct from candidate.name then null else t.name end,
      short_description=case when previous.short_description is distinct from candidate.short_description then null else t.short_description end,
      full_description=case when previous.full_description is distinct from candidate.full_description then null else t.full_description end,
      opening_hours=case when previous.opening_hours is distinct from candidate.opening_hours then null else t.opening_hours end,
      price_info=case when previous.price_info is distinct from candidate.price_info then null else t.price_info end,
      duration_info=case when previous.duration_info is distinct from candidate.duration_info then null else t.duration_info end
    where t.item_id=candidate.id and (previous.name is distinct from candidate.name or previous.short_description is distinct from candidate.short_description or previous.full_description is distinct from candidate.full_description or previous.opening_hours is distinct from candidate.opening_hours or previous.price_info is distinct from candidate.price_info or previous.duration_info is distinct from candidate.duration_info);
    perform public.record_admin_audit_event(auth.uid(),target,'tourism.updated','hotel_tourism_item',candidate.id,
      pg_catalog.jsonb_build_object('type',candidate.type,'category_key',candidate.category_key,
        'featured',candidate.featured,'recommended_by_hotel',candidate.recommended_by_hotel,'is_published',candidate.is_published),null);
  end if;
  if candidate.is_published is distinct from coalesce(previous.is_published,false) then
    perform public.record_admin_audit_event(auth.uid(),target,
      case when candidate.is_published then 'tourism.published' else 'tourism.unpublished' end,
      'hotel_tourism_item',candidate.id,pg_catalog.jsonb_build_object('is_published',candidate.is_published),null);
  end if;
  return next candidate;
end $$;

create or replace function public.delete_current_hotel_tourism_item(p_item_id uuid,p_expected_updated_at timestamptz)
returns table(deleted_id uuid,main_image_path text) language plpgsql security definer set search_path='' as $$
declare target uuid:=tourism_private.mutation_hotel(); previous public.hotel_tourism_items;
begin
  select * into previous from public.hotel_tourism_items i where i.id=p_item_id and i.hotel_id=target for update;
  if not found then raise exception using errcode='P0002',message='tourism_item_not_found'; end if;
  if p_expected_updated_at is null or p_expected_updated_at<>previous.updated_at then
    raise exception using errcode='PT409',message='tourism_revision_conflict'; end if;
  delete from public.hotel_tourism_items i where i.id=previous.id and i.hotel_id=target;
  perform public.record_admin_audit_event(auth.uid(),target,'tourism.deleted','hotel_tourism_item',previous.id,
    pg_catalog.jsonb_build_object('type',previous.type,'category_key',previous.category_key),null);
  return query select previous.id,previous.main_image_path;
end $$;

create or replace function public.update_current_hotel_tourism_image(
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
    raise exception using errcode='PT409',message='tourism_revision_conflict'; end if;
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
