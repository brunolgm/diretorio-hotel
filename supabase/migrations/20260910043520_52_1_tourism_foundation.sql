-- Sprint 52.1: domain only. No entitlement provisioning, Storage or legacy changes.
do $$ begin
  if to_regclass('public.hotel_tourism_items') is not null
    or to_regclass('public.hotel_tourism_item_translations') is not null
    or exists(select 1 from pg_catalog.pg_namespace where nspname='tourism_private') then
    raise exception '52.1 preflight: tourism objects already exist';
  end if;
  if to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
    or to_regprocedure('public.is_hotel_publicly_active(uuid)') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null then
    raise exception '52.1 preflight: authorization/audit dependencies missing';
  end if;
end $$;

create schema tourism_private;
revoke all on schema tourism_private from public,anon,authenticated,service_role;

-- Only plain text; angle brackets are deliberately rejected, never interpreted as HTML.
create function tourism_private.valid_text(value text, max_length integer)
returns boolean language sql immutable set search_path='' as $$
  select value is null or (pg_catalog.length(value) between 1 and max_length
    and value=pg_catalog.btrim(value,E' \t\n\r') and value !~ '[<>]'
    and pg_catalog.regexp_replace(value,E'[\t\n\r]','','g') !~ '[[:cntrl:]]');
$$;
create function tourism_private.valid_url(value text)
returns boolean language sql immutable set search_path='' as $$
  select value is null or (value ~* '^https?://[^/?#[:space:]@:]+' and value !~ '[[:space:][:cntrl:]\\]'
    and pg_catalog.split_part(pg_catalog.split_part(value,'/',3),'?',1) !~ '@'
    and value !~* '^https?://[^/?#]*@'
    and value ~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#].*)?$');
$$;

create table public.hotel_tourism_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  slug text not null check(length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  type text not null check(type in ('PLACE','EXPERIENCE','GASTRONOMY')),
  category_key text not null,
  name text not null check(tourism_private.valid_text(name,160)),
  short_description text not null check(tourism_private.valid_text(short_description,500)),
  full_description text null check(tourism_private.valid_text(full_description,10000)),
  address text null check(tourism_private.valid_text(address,500)),
  map_url text null check(tourism_private.valid_text(map_url,2048)),
  official_website_url text null check(tourism_private.valid_text(official_website_url,2048)),
  phone text null check(tourism_private.valid_text(phone,16)),
  whatsapp_number text null check(tourism_private.valid_text(whatsapp_number,16)),
  opening_hours text null check(tourism_private.valid_text(opening_hours,1000)),
  price_info text null check(tourism_private.valid_text(price_info,300)),
  duration_info text null check(tourism_private.valid_text(duration_info,200)),
  main_image_path text null check(main_image_path is null or (
    length(main_image_path)<=512 and main_image_path ~ (
      '^' || hotel_id::text || '/tourism/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'))),
  recommended_by_hotel boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0 check(sort_order>=0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_tourism_items_hotel_slug_key unique(hotel_id,slug),
  constraint hotel_tourism_items_category_pair_check check (
(type = 'PLACE' and category_key in ('sights','beaches_and_nature','culture_and_history','neighborhoods_and_regions','shopping'))
    or (type = 'EXPERIENCE' and category_key in ('tours','local_culture','nature_and_adventure','nightlife','wellness'))
    or (type = 'GASTRONOMY' and category_key in ('restaurants','bars','cafes_and_bakeries','local_cuisine','markets_and_fairs'))
  ),
  check(phone is null or phone ~ '^\+[1-9][0-9]{1,14}$'),
  check(whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{1,14}$'),
  check(tourism_private.valid_url(map_url)),
  check(tourism_private.valid_url(official_website_url))
);
create index hotel_tourism_items_admin_order_idx on public.hotel_tourism_items(hotel_id,sort_order,id);
create index hotel_tourism_items_public_order_idx on public.hotel_tourism_items(hotel_id,sort_order,id) where is_published;

create table public.hotel_tourism_item_translations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.hotel_tourism_items(id) on delete cascade,
  language text not null check(language in ('en','es')),
  name text null check(tourism_private.valid_text(name,240)),
  short_description text null check(tourism_private.valid_text(short_description,750)),
  full_description text null check(tourism_private.valid_text(full_description,15000)),
  opening_hours text null check(tourism_private.valid_text(opening_hours,1500)),
  price_info text null check(tourism_private.valid_text(price_info,450)),
  duration_info text null check(tourism_private.valid_text(duration_info,300)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id,language),
  check(coalesce(name,short_description,full_description,opening_hours,price_info,duration_info) is not null)
);

create function tourism_private.protect_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception using errcode='22023',message='tourism_identity_immutable';
  end if;
  if tg_table_name='hotel_tourism_items' then
    if new.hotel_id is distinct from old.hotel_id or new.slug is distinct from old.slug then
      raise exception using errcode='22023',message='tourism_ownership_slug_immutable';
    end if;
  else
    if new.item_id is distinct from old.item_id or new.language is distinct from old.language then
      raise exception using errcode='22023',message='tourism_translation_identity_immutable';
    end if;
  end if;
  -- now() alone cannot distinguish successive changes in a single transaction.
  new.updated_at:=greatest(pg_catalog.clock_timestamp(),old.updated_at+interval '1 microsecond');
  return new;
end $$;
create trigger tourism_item_identity before update on public.hotel_tourism_items
  for each row execute function tourism_private.protect_identity();
create trigger tourism_translation_identity before update on public.hotel_tourism_item_translations
  for each row execute function tourism_private.protect_identity();

-- Every mutation takes the same hotel row lock, including insertion into an empty catalog.
create function tourism_private.mutation_hotel()
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='tourism_session_required'; end if;
  select p.hotel_id into target from public.profiles p where p.id=auth.uid() and p.is_active for share;
  if target is null or not public.has_active_hotel_role(target,'operador') then
    raise exception using errcode='42501',message='tourism_operator_required';
  end if;
  perform 1 from public.hotels h where h.id=target and h.platform_status<>'archived' for update;
  if not found or not public.is_hotel_module_enabled(target,'content.tourism') then
    raise exception using errcode='42501',message='tourism_entitlement_required';
  end if;
  return target;
end $$;

create function tourism_private.checked_patch(p_patch jsonb,p_translation boolean default false)
returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; result jsonb:='{}'; allowed text[];
begin
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch)<>'object' then
    raise exception using errcode='22023',message='tourism_patch_invalid'; end if;
  if p_patch='{}'::jsonb then
    raise exception using errcode='22023',message='tourism_patch_empty'; end if;
  allowed:=case when p_translation then array['name','short_description','full_description','opening_hours','price_info','duration_info']
    else array['name','short_description','full_description','opening_hours','price_info','duration_info','type','category_key','address','map_url','official_website_url','phone','whatsapp_number','featured','recommended_by_hotel','is_published'] end;
  for k,v in select * from pg_catalog.jsonb_each(p_patch) loop
    if not k=any(allowed) then raise exception using errcode='22023',message='tourism_field_not_writable'; end if;
    if k=any(array['featured','recommended_by_hotel','is_published']) then
      if pg_catalog.jsonb_typeof(v)<>'boolean' then raise exception using errcode='22023',message='tourism_boolean_required'; end if;
    else
      if pg_catalog.jsonb_typeof(v) not in ('string','null') then raise exception using errcode='22023',message='tourism_text_required'; end if;
      if k in ('map_url','official_website_url') and (v#>>'{}') ~ '[[:cntrl:]]' then
        raise exception using errcode='22023',message='tourism_url_invalid'; end if;
      v:=coalesce(pg_catalog.to_jsonb(nullif(pg_catalog.btrim(v#>>'{}',E' \t\n\r'),'')),'null'::jsonb);
    end if;
    result:=result||pg_catalog.jsonb_build_object(k,v);
  end loop;
  return result;
end $$;

create function public.save_current_hotel_tourism_item(p_item_id uuid,p_changes jsonb,p_expected_updated_at timestamptz default null)
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
      raise exception using errcode='40001',message='tourism_revision_conflict'; end if;
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

create function public.reorder_current_hotel_tourism_items(p_item_ids uuid[])
returns setof public.hotel_tourism_items language plpgsql security definer set search_path='' as $$
declare target uuid:=tourism_private.mutation_hotel(); requested integer:=pg_catalog.cardinality(p_item_ids); actual integer;
begin
  select count(*) into actual from public.hotel_tourism_items i where i.hotel_id=target;
  if p_item_ids is null or coalesce(pg_catalog.array_ndims(p_item_ids),1)<>1 or requested<>actual
    or exists(select 1 from pg_catalog.unnest(p_item_ids) x(id) where id is null)
    or (select count(distinct id) from pg_catalog.unnest(p_item_ids) x(id))<>actual
    or exists(select 1 from pg_catalog.unnest(p_item_ids) x(id) where not exists(
      select 1 from public.hotel_tourism_items i where i.id=x.id and i.hotel_id=target)) then
    raise exception using errcode='22023',message='tourism_order_invalid';
  end if;
  update public.hotel_tourism_items i set sort_order=(x.position-1)::integer
    from pg_catalog.unnest(p_item_ids) with ordinality x(id,position) where i.id=x.id and i.hotel_id=target;
  perform public.record_admin_audit_event(auth.uid(),target,'tourism.reordered','hotel_tourism_item',null,
    pg_catalog.jsonb_build_object('item_count',actual),null);
  return query select * from public.hotel_tourism_items i where i.hotel_id=target order by i.sort_order,i.id;
end $$;

-- Returned owned path is for a future server-side cleanup; no Storage operation here.
create function public.delete_current_hotel_tourism_item(p_item_id uuid,p_expected_updated_at timestamptz)
returns table(deleted_id uuid,main_image_path text) language plpgsql security definer set search_path='' as $$
declare target uuid:=tourism_private.mutation_hotel(); previous public.hotel_tourism_items;
begin
  select * into previous from public.hotel_tourism_items i where i.id=p_item_id and i.hotel_id=target for update;
  if not found then raise exception using errcode='P0002',message='tourism_item_not_found'; end if;
  if p_expected_updated_at is null or p_expected_updated_at<>previous.updated_at then
    raise exception using errcode='40001',message='tourism_revision_conflict'; end if;
  delete from public.hotel_tourism_items i where i.id=previous.id and i.hotel_id=target;
  perform public.record_admin_audit_event(auth.uid(),target,'tourism.deleted','hotel_tourism_item',previous.id,
    pg_catalog.jsonb_build_object('type',previous.type,'category_key',previous.category_key),null);
  return query select previous.id,previous.main_image_path;
end $$;

create function public.save_current_hotel_tourism_translation(p_item_id uuid,p_language text,p_expected_updated_at timestamptz,p_changes jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid:=tourism_private.mutation_hotel(); parent public.hotel_tourism_items;
  candidate public.hotel_tourism_item_translations; patch jsonb:=tourism_private.checked_patch(p_changes,true);
begin
  if not public.is_hotel_module_enabled(target,'content.languages') then
    raise exception using errcode='42501',message='tourism_languages_required'; end if;
  if p_language is null or p_language not in ('en','es') then raise exception using errcode='22023',message='tourism_language_invalid'; end if;
  select * into parent from public.hotel_tourism_items i where i.id=p_item_id and i.hotel_id=target for update;
  if not found then raise exception using errcode='P0002',message='tourism_item_not_found'; end if;
  if p_expected_updated_at is null then raise exception using errcode='22023',message='tourism_revision_required'; end if;
  if p_expected_updated_at<>parent.updated_at then return false; end if;
  select * into candidate from public.hotel_tourism_item_translations t where t.item_id=p_item_id and t.language=p_language;
  candidate:=pg_catalog.jsonb_populate_record(candidate,patch);
  candidate.id:=coalesce(candidate.id,pg_catalog.gen_random_uuid());
  candidate.item_id:=p_item_id; candidate.language:=p_language;
  candidate.created_at:=coalesce(candidate.created_at,pg_catalog.clock_timestamp()); candidate.updated_at:=pg_catalog.clock_timestamp();
  if parent.name is null then candidate.name:=null; end if;
  if parent.short_description is null then candidate.short_description:=null; end if;
  if parent.full_description is null then candidate.full_description:=null; end if;
  if parent.opening_hours is null then candidate.opening_hours:=null; end if;
  if parent.price_info is null then candidate.price_info:=null; end if;
  if parent.duration_info is null then candidate.duration_info:=null; end if;
  insert into public.hotel_tourism_item_translations select candidate.*
  on conflict(item_id,language) do update set
    name=excluded.name,
    short_description=excluded.short_description,
    full_description=excluded.full_description,
    opening_hours=excluded.opening_hours,
    price_info=excluded.price_info,
    duration_info=excluded.duration_info;
  perform public.record_admin_audit_event(auth.uid(),target,'tourism.updated','hotel_tourism_item',p_item_id,
    pg_catalog.jsonb_build_object('language',p_language),null);
  return true;
end $$;

alter table public.hotel_tourism_items enable row level security;
alter table public.hotel_tourism_item_translations enable row level security;
create policy tourism_public_read on public.hotel_tourism_items for select to anon,authenticated using (
  is_published and public.is_hotel_publicly_active(hotel_id)
  and public.is_hotel_module_enabled(hotel_id,'core.directory')
  and public.is_hotel_module_enabled(hotel_id,'content.tourism'));
create policy tourism_admin_read on public.hotel_tourism_items for select to authenticated using (
  public.has_active_hotel_role(hotel_id,'visualizador')
  and exists(select 1 from public.hotels h where h.id=hotel_id and h.platform_status<>'archived')
  and public.is_hotel_module_enabled(hotel_id,'content.tourism'));
create policy tourism_translation_public_read on public.hotel_tourism_item_translations for select to anon,authenticated using (
  exists(select 1 from public.hotel_tourism_items i where i.id=item_id and i.is_published
    and public.is_hotel_publicly_active(i.hotel_id)
    and public.is_hotel_module_enabled(i.hotel_id,'core.directory')
    and public.is_hotel_module_enabled(i.hotel_id,'content.tourism')
    and public.is_hotel_module_enabled(i.hotel_id,'content.languages')));
create policy tourism_translation_admin_read on public.hotel_tourism_item_translations for select to authenticated using (
  exists(select 1 from public.hotel_tourism_items i join public.hotels h on h.id=i.hotel_id
    where i.id=item_id and h.platform_status<>'archived'
    and public.has_active_hotel_role(i.hotel_id,'visualizador')
    and public.is_hotel_module_enabled(i.hotel_id,'content.tourism')));

revoke all on public.hotel_tourism_items,public.hotel_tourism_item_translations from public,anon,authenticated,service_role;
grant select on public.hotel_tourism_items,public.hotel_tourism_item_translations to anon,authenticated;
revoke all on all functions in schema tourism_private from public,anon,authenticated,service_role;
revoke all on function public.save_current_hotel_tourism_item(uuid,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.save_current_hotel_tourism_item(uuid,jsonb,timestamptz) to authenticated;
revoke all on function public.reorder_current_hotel_tourism_items(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.reorder_current_hotel_tourism_items(uuid[]) to authenticated;
revoke all on function public.delete_current_hotel_tourism_item(uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.delete_current_hotel_tourism_item(uuid,timestamptz) to authenticated;
revoke all on function public.save_current_hotel_tourism_translation(uuid,text,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_current_hotel_tourism_translation(uuid,text,timestamptz,jsonb) to authenticated;

comment on table public.hotel_tourism_items is 'Sprint 52.1 canonical tourism domain. Opt-in remains coming_soon. RPC-only writes; manual order, no legacy coupling.';
comment on column public.hotel_tourism_items.main_image_path is 'Reserved for future validated hotel-assets upload: hotel_id/tourism/item_id/uuid.ext. No upload or association RPC in 52.1.';
comment on function public.save_current_hotel_tourism_translation(uuid,text,timestamptz,jsonb) is 'Authenticated operator context required; false means stale parent revision discarded. No external translation integration.';
