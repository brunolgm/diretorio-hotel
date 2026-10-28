begin;
create table public.hotel_bootstrap_items (
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 namespace text not null check(namespace ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
 item_key text not null check(item_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
 domain text not null,
 record_id uuid,
 input jsonb not null,
 snapshot jsonb not null,
 created_at timestamptz not null default now(),
 primary key(hotel_id,namespace,item_key)
);
alter table public.hotel_bootstrap_items enable row level security;
revoke all on public.hotel_bootstrap_items from public,anon,authenticated,service_role;
grant select on public.hotel_bootstrap_items to authenticated;
create policy bootstrap_read on public.hotel_bootstrap_items for select to authenticated
 using(public.has_active_hotel_role(hotel_id,'administrador'));

create table public.hotel_slug_aliases (
 slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 64),
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index hotel_slug_aliases_hotel_idx on public.hotel_slug_aliases(hotel_id);
alter table public.hotel_slug_aliases enable row level security;
revoke all on public.hotel_slug_aliases from public,anon,authenticated,service_role;
create function public.protect_hotel_slug_alias() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(5202801);
 if exists(select 1 from public.hotel_slug_aliases a where a.slug=new.slug and a.hotel_id<>new.id) then
  raise exception using errcode='23505',message='hotel_slug_reserved'; end if;
 return new;
end $$;
revoke all on function public.protect_hotel_slug_alias() from public,anon,authenticated,service_role;
create trigger protect_hotel_slug_alias before insert or update of slug on public.hotels
 for each row execute function public.protect_hotel_slug_alias();
create function public.resolve_public_hotel_slug(p_slug text) returns text language sql stable security definer set search_path='' as $$
 select h.slug from public.hotels h where public.is_hotel_publicly_active(h.id)
 and public.is_hotel_module_enabled(h.id,'core.directory')
 and (h.slug=lower(btrim(p_slug)) or exists(select 1 from public.hotel_slug_aliases a where a.hotel_id=h.id and a.slug=lower(btrim(p_slug)))) limit 1;
$$;
revoke all on function public.resolve_public_hotel_slug(text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_public_hotel_slug(text) to anon,authenticated;

create function public.update_current_hotel_slug(p_hotel_id uuid,p_expected_slug text,p_slug text)
returns text language plpgsql security definer set search_path='' as $$
declare previous text; normalized text:=lower(btrim(p_slug));
begin
 perform 1 from public.profiles p where p.id=auth.uid() and p.hotel_id=p_hotel_id and p.is_active for share;
 if auth.uid() is null or not found or not public.has_active_hotel_role(p_hotel_id,'administrador') then
  raise exception using errcode='42501',message='hotel_admin_required'; end if;
 perform pg_advisory_xact_lock(5202801);
 select h.slug into previous from public.hotels h where h.id=p_hotel_id and h.platform_status in('draft','suspended') for update;
 if not found then raise exception using errcode='42501',message='hotel_preparation_required'; end if;
 if normalized is null or length(normalized) not between 3 and 64 or normalized !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or normalized in('www','app','admin','api','platform','login') then
  raise exception using errcode='22023',message='hotel_slug_invalid'; end if;
 if previous=normalized then return previous; end if;
 if previous is distinct from p_expected_slug then raise exception using errcode='PT409',message='hotel_slug_revision_conflict'; end if;
 if exists(select 1 from public.hotels where slug=normalized and id<>p_hotel_id)
  or exists(select 1 from public.hotel_slug_aliases where slug=normalized and hotel_id<>p_hotel_id) then
  raise exception using errcode='23505',message='hotel_slug_conflict'; end if;
 insert into public.hotel_slug_aliases(slug,hotel_id) values(previous,p_hotel_id) on conflict(slug) do nothing;
 update public.hotels set slug=normalized where id=p_hotel_id;
 perform public.record_admin_audit_event(auth.uid(),p_hotel_id,'hotel.slug_updated','hotel',p_hotel_id,
  jsonb_build_object('previous_slug',previous,'slug',normalized),null);
 return normalized;
end $$;
revoke all on function public.update_current_hotel_slug(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.update_current_hotel_slug(uuid,text,text) to authenticated;

create function public.apply_current_hotel_bootstrap(p_hotel_id uuid,p_namespace text,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<bootstrap>>
declare
 entry jsonb; values_json jsonb; k text; dom text; item_key text; table_name text; module_key text;
 saved public.hotel_bootstrap_items; row_json jsonb; row_id uuid; old_hotel public.hotels; candidate public.hotels;
 allowed text[]; fields_sql text; item_count integer:=0; result jsonb:='[]'; patch jsonb:='{}'; airport uuid;
begin
 perform 1 from public.profiles p where p.id=auth.uid() and p.hotel_id=p_hotel_id and p.is_active for share;
 if auth.uid() is null or not found or not public.has_active_hotel_role(p_hotel_id,'administrador') then
  raise exception using errcode='42501',message='hotel_admin_required'; end if;
 if p_manifest ? 'slug' then perform pg_advisory_xact_lock(5202801); end if;
 select * into old_hotel from public.hotels where id=p_hotel_id and platform_status in('draft','suspended') for update;
 if not found then raise exception using errcode='42501',message='hotel_preparation_required'; end if;
 if p_namespace is null or p_namespace !~ '^[a-z0-9][a-z0-9-]{0,63}$' or p_manifest is null
  or jsonb_typeof(p_manifest)<>'object' or octet_length(p_manifest::text)>524288
  or exists(select 1 from jsonb_object_keys(p_manifest) x where x not in('hotel','slug','entries')) then
  raise exception using errcode='22023',message='bootstrap_manifest_invalid'; end if;
 if not public.is_hotel_module_enabled(p_hotel_id,'core.directory') then
  raise exception using errcode='42501',message='bootstrap_entitlement_required'; end if;
 if p_manifest ? 'hotel' then
  if jsonb_typeof(p_manifest->'hotel')<>'object' then raise exception using errcode='22023',message='bootstrap_hotel_invalid'; end if;
  for k,values_json in select * from jsonb_each(p_manifest->'hotel') loop
   if k not in('booking_url','website_url','logo_url','checkin_time','checkout_time','breakfast_hours','wifi_name')
    or jsonb_typeof(values_json)<>'string' then raise exception using errcode='22023',message='bootstrap_hotel_field_invalid'; end if;
   if k in('booking_url','website_url','logo_url') and ((values_json#>>'{}') !~ '^https://' or not tourism_private.valid_url(values_json#>>'{}')) then
    raise exception using errcode='22023',message='bootstrap_hotel_url_invalid'; end if;
   -- Initial configuration fills blanks only. Existing equivalent/curated values win.
   if coalesce(to_jsonb(old_hotel)->>k,'')='' then patch:=patch||jsonb_build_object(k,values_json); end if;
  end loop;
  if patch<>'{}' then
   candidate:=jsonb_populate_record(old_hotel,patch);
   update public.hotels set booking_url=candidate.booking_url,website_url=candidate.website_url,logo_url=candidate.logo_url,
    checkin_time=candidate.checkin_time,checkout_time=candidate.checkout_time,breakfast_hours=candidate.breakfast_hours,wifi_name=candidate.wifi_name where id=p_hotel_id;
  end if;
 end if;
 if p_manifest ? 'slug' then perform public.update_current_hotel_slug(p_hotel_id,p_manifest->'slug'->>'expected',p_manifest->'slug'->>'value'); end if;
 if jsonb_typeof(coalesce(p_manifest->'entries','[]'))<>'array' or jsonb_array_length(coalesce(p_manifest->'entries','[]'))>100 then
  raise exception using errcode='22023',message='bootstrap_entries_invalid'; end if;
 for entry in select * from jsonb_array_elements(coalesce(p_manifest->'entries','[]')) loop
  dom:=entry->>'domain'; item_key:=entry->>'key'; values_json:=entry->'values'; row_id:=null; row_json:=null;
  if item_key is null or item_key !~ '^[a-z0-9][a-z0-9-]{0,79}$' or values_json is null or jsonb_typeof(values_json)<>'object' then
   raise exception using errcode='22023',message='bootstrap_entry_invalid'; end if;
  table_name:=case dom when 'service' then 'hotel_sections' when 'department' then 'hotel_departments' when 'policy' then 'hotel_policies'
   when 'tourism' then 'hotel_tourism_items' when 'media' then 'hotel_public_experience_media' when 'flights' then 'hotel_flight_settings' end;
  module_key:=case dom when 'service' then 'content.services' when 'department' then 'content.departments' when 'policy' then 'content.policies'
   when 'tourism' then 'content.tourism' when 'media' then 'experience.appearance' when 'flights' then 'travel.flights' end;
  if table_name is null or not public.is_hotel_module_enabled(p_hotel_id,module_key) then
   raise exception using errcode='42501',message='bootstrap_domain_entitlement_required'; end if;
  select * into saved from public.hotel_bootstrap_items where hotel_id=p_hotel_id and namespace=p_namespace and hotel_bootstrap_items.item_key=bootstrap.item_key for update;
  if found then
   if saved.domain<>dom or saved.input<>values_json then raise exception using errcode='PT409',message='bootstrap_manifest_changed'; end if;
   if dom='media' then select to_jsonb(m) into row_json from public.hotel_public_experience_media m where m.hotel_id=p_hotel_id and m.slot=item_key;
   elsif dom='flights' then select to_jsonb(f) into row_json from public.hotel_flight_settings f where f.hotel_id=p_hotel_id;
   else execute format('select to_jsonb(r) from public.%I r where id=$1 and hotel_id=$2',table_name) into row_json using saved.record_id,p_hotel_id;
   end if;
   if row_json is null or (row_json-'created_at'-'updated_at')<>saved.snapshot then
    raise exception using errcode='PT409',message='bootstrap_admin_edit_conflict'; end if;
   result:=result||jsonb_build_array(jsonb_build_object('key',item_key,'domain',dom,'id',saved.record_id,'status','preserved')); continue;
  end if;
  if dom in('service','department','policy') then
   allowed:=case dom when 'service' then array['title','content','cta','url','category','icon','service_action_type','enabled','sort_order']
    when 'department' then array['name','description','hours','action','url','enabled'] else array['title','description','enabled'] end;
   if exists(select 1 from jsonb_object_keys(values_json) x where not x=any(allowed))
    or coalesce(values_json->>case when dom='department' then 'name' else 'title' end,'')='' then
    raise exception using errcode='22023',message='bootstrap_editorial_fields_invalid'; end if;
   if values_json ? 'url' and values_json->>'url' is not null and not tourism_private.valid_url(values_json->>'url') then
    raise exception using errcode='22023',message='bootstrap_editorial_url_invalid'; end if;
   if dom='service' and values_json->>'service_action_type'='external_url' and coalesce(values_json->>'url','')='' then
    raise exception using errcode='22023',message='bootstrap_external_url_required'; end if;
   execute format('select to_jsonb(r) from public.%I r where hotel_id=$1 and %I=$2 limit 1',table_name,case when dom='department' then 'name' else 'title' end)
    into row_json using p_hotel_id,values_json->>case when dom='department' then 'name' else 'title' end;
   if row_json is not null then raise exception using errcode='PT409',message='bootstrap_existing_editorial_conflict'; end if;
   row_id:=gen_random_uuid(); values_json:=values_json||jsonb_build_object('id',row_id,'hotel_id',p_hotel_id);
   select string_agg(format('%I',key),',') into fields_sql from jsonb_object_keys(values_json) key;
   execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) returning to_jsonb(%1$I)',table_name,fields_sql) into row_json using values_json;
   values_json:=entry->'values';
  elsif dom='tourism' then
   if exists(select 1 from public.hotel_tourism_items where hotel_id=p_hotel_id and name=values_json->>'name') then
    raise exception using errcode='PT409',message='bootstrap_existing_tourism_conflict'; end if;
   select to_jsonb(t),t.id into row_json,row_id from public.save_current_hotel_tourism_item(null,values_json) t;
  elsif dom='media' then
   if exists(select 1 from public.hotel_public_experience_media where hotel_id=p_hotel_id and slot=item_key) then
    raise exception using errcode='PT409',message='bootstrap_existing_media_conflict'; end if;
   perform public.update_current_hotel_experience_media(item_key,0,values_json);
   select to_jsonb(m) into row_json from public.hotel_public_experience_media m where m.hotel_id=p_hotel_id and m.slot=item_key;
  elsif dom='flights' then
   if exists(select 1 from public.hotel_flight_settings where hotel_id=p_hotel_id) or exists(select 1 from public.hotel_airports where hotel_id=p_hotel_id) then
    raise exception using errcode='PT409',message='bootstrap_existing_flights_conflict'; end if;
   if exists(select 1 from jsonb_object_keys(values_json) x where x not in('iata_code','home_card_enabled','home_card_title','home_card_description','departure_notice')) then
    raise exception using errcode='22023',message='bootstrap_flight_fields_invalid'; end if;
   select id into airport from public.airports where iata_code=values_json->>'iata_code' and is_active;
   if airport is null then raise exception using errcode='P0002',message='bootstrap_airport_missing'; end if;
   insert into public.hotel_airports(hotel_id,airport_id,sort_order,is_active) values(p_hotel_id,airport,1,true);
   insert into public.hotel_flight_settings(hotel_id,home_card_enabled,home_card_title,home_card_description,departure_notice)
    values(p_hotel_id,coalesce((values_json->>'home_card_enabled')::boolean,false),values_json->>'home_card_title',values_json->>'home_card_description',values_json->>'departure_notice');
   select to_jsonb(f) into row_json from public.hotel_flight_settings f where f.hotel_id=p_hotel_id;
  end if;
  insert into public.hotel_bootstrap_items(hotel_id,namespace,item_key,domain,record_id,input,snapshot)
   values(p_hotel_id,p_namespace,item_key,dom,row_id,values_json,row_json-'created_at'-'updated_at');
  result:=result||jsonb_build_array(jsonb_build_object('key',item_key,'domain',dom,'id',row_id,'status','created')); item_count:=item_count+1;
 end loop;
 if item_count>0 or patch<>'{}' then perform public.record_admin_audit_event(auth.uid(),p_hotel_id,'hotel.bootstrap_applied','hotel',p_hotel_id,
  jsonb_build_object('namespace',p_namespace,'created_count',item_count),null); end if;
 return result;
end $$;
revoke all on function public.apply_current_hotel_bootstrap(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.apply_current_hotel_bootstrap(uuid,text,jsonb) to authenticated;

create table public.hotel_public_experience_media_translations (
 hotel_id uuid not null,
 slot text not null,
 language text not null check(language in('en','es')),
 title text check(tourism_private.valid_text(title,240)),
 description text check(tourism_private.valid_text(description,6000)),
 alt_text text check(tourism_private.valid_text(alt_text,450)),
 cta_label text check(tourism_private.valid_text(cta_label,120)),
 updated_at timestamptz not null default now(),
 primary key(hotel_id,slot,language),
 foreign key(hotel_id,slot) references public.hotel_public_experience_media(hotel_id,slot) on delete cascade,
 check(coalesce(title,description,alt_text,cta_label) is not null)
);
alter table public.hotel_public_experience_media_translations enable row level security;
revoke all on public.hotel_public_experience_media_translations from public,anon,authenticated,service_role;
grant select on public.hotel_public_experience_media_translations to anon,authenticated;
create policy media_translation_read on public.hotel_public_experience_media_translations for select to anon,authenticated using(
 exists(select 1 from public.hotel_public_experience_media m where m.hotel_id=hotel_public_experience_media_translations.hotel_id and m.slot=hotel_public_experience_media_translations.slot and m.is_published)
 and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'experience.appearance')
);
create policy media_translation_editor_read on public.hotel_public_experience_media_translations for select to authenticated using(
 public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'experience.appearance')
 and exists(select 1 from public.hotels h where h.id=hotel_id and h.platform_status<>'archived')
);


create function public.invalidate_experience_media_translations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.title is distinct from old.title or new.description is distinct from old.description or new.alt_text is distinct from old.alt_text or new.cta_label is distinct from old.cta_label then
  delete from public.hotel_public_experience_media_translations where hotel_id=new.hotel_id and slot=new.slot;
 end if;
 return new;
end $$;
revoke all on function public.invalidate_experience_media_translations() from public,anon,authenticated,service_role;
create trigger invalidate_experience_media_translations after update on public.hotel_public_experience_media for each row execute function public.invalidate_experience_media_translations();
create function public.save_current_hotel_experience_media_translation(p_slot text,p_language text,p_expected_revision integer,p_fields jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid; source public.hotel_public_experience_media;
begin
 select p.hotel_id into target from public.profiles p where p.id=auth.uid() and p.is_active for share;
 if auth.uid() is null or target is null or not public.has_active_hotel_role(target,'editor')
  or not public.is_hotel_module_enabled(target,'content.languages') or not public.is_hotel_module_enabled(target,'experience.appearance') then
  raise exception using errcode='42501',message='experience_translation_authorization_required'; end if;
 perform 1 from public.hotels where id=target and platform_status<>'archived' for update;
 if not found then raise exception using errcode='42501',message='experience_translation_authorization_required'; end if;
 select * into source from public.hotel_public_experience_media where hotel_id=target and slot=p_slot for update;
 if not found then raise exception using errcode='P0002',message='experience_translation_source_missing'; end if;
 if p_expected_revision is null or source.revision<>p_expected_revision then return false; end if;
 if p_language is null or p_language not in('en','es') or p_fields is null or jsonb_typeof(p_fields)<>'object'
  or exists(select 1 from jsonb_object_keys(p_fields) x where x not in('title','description','alt_text','cta_label'))
  or exists(select 1 from jsonb_each(p_fields) e where jsonb_typeof(e.value) not in('string','null')) then raise exception using errcode='22023',message='experience_translation_invalid'; end if;
 insert into public.hotel_public_experience_media_translations(hotel_id,slot,language,title,description,alt_text,cta_label)
 values(target,p_slot,p_language,nullif(btrim(p_fields->>'title'),''),nullif(btrim(p_fields->>'description'),''),nullif(btrim(p_fields->>'alt_text'),''),nullif(btrim(p_fields->>'cta_label'),''))
 on conflict(hotel_id,slot,language) do update set title=excluded.title,description=excluded.description,alt_text=excluded.alt_text,cta_label=excluded.cta_label,updated_at=now();
 perform public.record_admin_audit_event(auth.uid(),target,'experience.media_translated','hotel',target,jsonb_build_object('slot',p_slot,'language',p_language,'revision',source.revision),null);
 return true;
end $$;
revoke all on function public.save_current_hotel_experience_media_translation(text,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_current_hotel_experience_media_translation(text,text,integer,jsonb) to authenticated;

create function public.apply_current_hotel_bootstrap_translation(p_hotel_id uuid,p_namespace text,p_key text,p_language text,p_fields jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.hotel_bootstrap_items; source jsonb; tab text; parent_key text; allowed text[]; fields_sql text; existing boolean;
begin
 if auth.uid() is null or not public.has_active_hotel_role(p_hotel_id,'administrador') or not public.is_hotel_module_enabled(p_hotel_id,'content.languages') then
  raise exception using errcode='42501',message='bootstrap_translation_authorization_required'; end if;
 perform 1 from public.hotels where id=p_hotel_id and platform_status in('draft','suspended') for update;
 if not found then raise exception using errcode='42501',message='hotel_preparation_required'; end if;
 if p_language is null or p_language not in('en','es') or p_fields is null or jsonb_typeof(p_fields)<>'object' then
  raise exception using errcode='22023',message='bootstrap_translation_invalid'; end if;
 select * into item from public.hotel_bootstrap_items where hotel_id=p_hotel_id and namespace=p_namespace and item_key=p_key;
 if not found then raise exception using errcode='P0002',message='bootstrap_translation_source_missing'; end if;
 if item.domain='media' then
  if not public.is_hotel_module_enabled(p_hotel_id,'experience.appearance') then raise exception using errcode='42501',message='bootstrap_translation_entitlement_required'; end if;
  select to_jsonb(m) into source from public.hotel_public_experience_media m where m.hotel_id=p_hotel_id and m.slot=p_key for update;
  if source is null or source-'created_at'-'updated_at'<>item.snapshot then raise exception using errcode='PT409',message='bootstrap_translation_source_changed'; end if;
  if exists(select 1 from jsonb_object_keys(p_fields) x where x not in('title','description','alt_text','cta_label'))
   or exists(select 1 from jsonb_each(p_fields) e where jsonb_typeof(e.value) not in('string','null')) then raise exception using errcode='22023',message='bootstrap_translation_field_invalid'; end if;
  if exists(select 1 from public.hotel_public_experience_media_translations where hotel_id=p_hotel_id and slot=p_key and language=p_language) then return false; end if;
  if not public.save_current_hotel_experience_media_translation(p_key,p_language,(source->>'revision')::integer,p_fields) then return false; end if;
  perform public.record_admin_audit_event(auth.uid(),p_hotel_id,'hotel.bootstrap_translation_created','hotel',p_hotel_id,jsonb_build_object('domain','media','language',p_language),null);
  return true;
 end if;
 tab:=case item.domain when 'service' then 'hotel_sections' when 'department' then 'hotel_departments' when 'policy' then 'hotel_policies' when 'tourism' then 'hotel_tourism_items' end;
 if tab is null then raise exception using errcode='22023',message='bootstrap_translation_domain_invalid'; end if;
 if not public.is_hotel_module_enabled(p_hotel_id,case item.domain when 'service' then 'content.services' when 'department' then 'content.departments' when 'policy' then 'content.policies' else 'content.tourism' end) then
  raise exception using errcode='42501',message='bootstrap_translation_entitlement_required'; end if;
 execute format('select to_jsonb(r) from public.%I r where id=$1 and hotel_id=$2 for update',tab) into source using item.record_id,p_hotel_id;
 if source is null or source-'created_at'-'updated_at'<>item.snapshot then raise exception using errcode='PT409',message='bootstrap_translation_source_changed'; end if;
 if item.domain='tourism' then
  if exists(select 1 from public.hotel_tourism_item_translations where item_id=item.record_id and language=p_language) then return false; end if;
  perform public.save_current_hotel_tourism_translation(item.record_id,p_language,(source->>'updated_at')::timestamptz,p_fields); return true;
 end if;
 allowed:=case item.domain when 'service' then array['title','content','cta','category'] when 'department' then array['name','description','action'] else array['title','description'] end;
 if exists(select 1 from jsonb_object_keys(p_fields) x where not x=any(allowed))
  or exists(select 1 from jsonb_each(p_fields) e where jsonb_typeof(e.value) not in('string','null')) then
  raise exception using errcode='22023',message='bootstrap_translation_field_invalid'; end if;
 tab:=case item.domain when 'service' then 'hotel_section_translations' when 'department' then 'hotel_department_translations' else 'hotel_policy_translations' end;
 parent_key:=case item.domain when 'service' then 'section_id' when 'department' then 'department_id' else 'policy_id' end;
 execute format('select exists(select 1 from public.%I where %I=$1 and language=$2)',tab,parent_key) into existing using item.record_id,p_language;
 if existing then return false; end if;
 p_fields:=p_fields||jsonb_build_object(parent_key,item.record_id,'language',p_language);
 select string_agg(format('%I',key),',') into fields_sql from jsonb_object_keys(p_fields) key;
 execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1)',tab,fields_sql) using p_fields;
 perform public.record_admin_audit_event(auth.uid(),p_hotel_id,'hotel.bootstrap_translation_created','hotel',p_hotel_id,jsonb_build_object('domain',item.domain,'language',p_language),null);
 return true;
end $$;
revoke all on function public.apply_current_hotel_bootstrap_translation(uuid,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.apply_current_hotel_bootstrap_translation(uuid,text,text,text,jsonb) to authenticated;
commit;