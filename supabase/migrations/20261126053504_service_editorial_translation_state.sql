-- Additive extension of the existing service translation contract. No editorial backfill.
begin;
alter table public.hotel_section_translations
 add column if not exists guest_fields jsonb not null default '{}'::jsonb,
 add column if not exists editorial_state jsonb not null default '{}'::jsonb;
alter table public.hotel_section_translations add constraint service_translation_guest_fields_limit
 check(jsonb_typeof(guest_fields)='object' and octet_length(guest_fields::text)<=20000);
alter table public.hotel_section_translations add constraint service_translation_state_limit
 check(jsonb_typeof(editorial_state)='object' and octet_length(editorial_state::text)<=16000);
-- Existing column grants remain unchanged. The new columns can only be written by the scoped RPC.
create function public.service_editorial_source(s jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('title',nullif(btrim(s->>'title'),''),'content',nullif(btrim(s->>'content'),''),
 'category',nullif(btrim(s->>'category'),''),'cta',nullif(btrim(s->>'cta'),''),
 'summary',nullif(btrim(s#>>'{guest_presentation,summary,pt}'),''),
 'hours',nullif(btrim(s#>>'{guest_presentation,hours,pt}'),''),
 'location',nullif(btrim(s#>>'{guest_presentation,location,pt}'),''),
 'conditions',nullif(btrim(s#>>'{guest_presentation,conditions,pt}'),''));
$$;
revoke all on function public.service_editorial_source(jsonb) from public,anon,authenticated,service_role;

create function public.invalidate_service_editorial_translations() returns trigger
language plpgsql security definer set search_path='' as $$
declare f text; lang text; src jsonb; prev jsonb; t public.hotel_section_translations; state jsonb; val text;
begin
 new.updated_at:=clock_timestamp();
 src:=public.service_editorial_source(to_jsonb(new));prev:=public.service_editorial_source(to_jsonb(old));
 if src is not distinct from prev then return new;end if;
 for lang in select unnest(array['en','es']) loop
  select * into t from public.hotel_section_translations where section_id=old.id and language=lang for update;
  state:=coalesce(t.editorial_state,'{}');
  for f in select jsonb_object_keys(src) loop
   if src->f is distinct from prev->f then
    val:=case when f in('title','content','category','cta') then to_jsonb(t)->>f else coalesce(t.guest_fields->>f,old.guest_presentation#>>array[f,lang]) end;
    if val is not null or state ? f then
     state:=jsonb_set(state,array[f],jsonb_build_object('origin',coalesce(state#>>array[f,'origin'],'legacy'),'status','stale','revision',new.updated_at));
    end if;
   end if;
  end loop;
  if state<>'{}' then
   insert into public.hotel_section_translations(section_id,language,editorial_state,updated_at) values(old.id,lang,state,clock_timestamp())
   on conflict(section_id,language) do update set editorial_state=excluded.editorial_state,updated_at=excluded.updated_at;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.invalidate_service_editorial_translations() from public,anon,authenticated,service_role;
create trigger service_editorial_source_changed before update on public.hotel_sections
 for each row execute function public.invalidate_service_editorial_translations();

-- Direct edits through existing column grants are manual, never silently treated as Google output.
create function public.mark_direct_service_translation_review() returns trigger
language plpgsql set search_path='' as $$
declare f text; prior jsonb;
begin
 prior:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 for f in select unnest(array['title','content','category','cta']) loop
  if (nullif(btrim(to_jsonb(new)->>f),'') is not null or nullif(btrim(prior->>f),'') is not null)
   and to_jsonb(new)->f is distinct from prior->f and new.editorial_state->f is not distinct from (prior->'editorial_state')->f then
   new.editorial_state:=jsonb_set(new.editorial_state,array[f],jsonb_build_object('origin','manual','status','current','revision',clock_timestamp()));
  end if;
 end loop;
 new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function public.mark_direct_service_translation_review() from public,anon,authenticated,service_role;
create trigger service_translation_direct_review before insert or update on public.hotel_section_translations
 for each row execute function public.mark_direct_service_translation_review();

create function public.save_current_hotel_service_translation(
 p_section_id uuid,p_language text,p_expected_source_version timestamptz,
 p_expected_translation_version timestamptz,p_fields jsonb,p_origin text,p_replace_manual boolean default false
) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.hotel_sections;t public.hotel_section_translations;h uuid; f text; val text; origin text; current_value text; state jsonb; guests jsonb; translated jsonb; sources jsonb;
begin
 select p.hotel_id into h from public.profiles p join public.hotels hotel on hotel.id=p.hotel_id
 where p.id=auth.uid() and p.is_active and hotel.platform_status='active';
 if h is null or not public.has_active_hotel_role(h,'operador') or not public.is_hotel_module_enabled(h,'content.services')
  or not public.is_hotel_module_enabled(h,'content.languages') then raise exception using errcode='42501',message='service_translation_access_denied';end if;
 if p_language not in('en','es') or p_language is null or p_expected_source_version is null or p_origin not in('auto','manual','failed') or p_origin is null
  or p_fields is null or jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>100000
  or exists(select 1 from jsonb_object_keys(p_fields) k where k not in('title','content','category','cta','summary','hours','location','conditions')) then
  raise exception using errcode='22023',message='service_translation_invalid';end if;
 select * into s from public.hotel_sections where id=p_section_id and hotel_id=h for update;
 if not found then raise exception using errcode='42501',message='service_translation_scope_denied';end if;
 if s.updated_at is distinct from p_expected_source_version then return false;end if;
 select * into t from public.hotel_section_translations where section_id=s.id and language=p_language for update;
 if t.updated_at is distinct from p_expected_translation_version then return false;end if;
 state:=coalesce(t.editorial_state,'{}');guests:=coalesce(t.guest_fields,'{}');translated:=coalesce(to_jsonb(t),'{}');sources:=public.service_editorial_source(to_jsonb(s));
 for f,val in select key,value#>>'{}' from jsonb_each(p_fields) loop
  if jsonb_typeof(p_fields->f) not in('string','null') or length(coalesce(val,''))>(case when f='content' then 30000 when f='conditions' then 4000 else 300 end) then
   raise exception using errcode='22023',message='service_translation_field_limit';end if;
  current_value:=case when f in('title','content','category','cta') then translated->>f else coalesce(guests->>f,s.guest_presentation#>>array[f,p_language]) end;
  origin:=coalesce(state#>>array[f,'origin'],case when current_value is not null then 'legacy' else 'auto' end);
  if p_origin='failed' and origin in('manual','legacy') then continue;end if;
  if p_origin in('auto','failed') and origin in('manual','legacy') and not coalesce(p_replace_manual,false) then continue;end if;
  if p_origin<>'failed' then
   if f in('title','content','category','cta') then translated:=jsonb_set(translated,array[f],coalesce(p_fields->f,'null'));
   else guests:=jsonb_set(guests,array[f],coalesce(p_fields->f,'null'));end if;
  end if;
  state:=jsonb_set(state,array[f],jsonb_build_object('origin',case when p_origin='manual' then 'manual' else 'auto' end,
    'status',case when p_origin='failed' then 'failed' when sources->>f is not null and nullif(btrim(val),'') is null then 'stale' else 'current' end,'revision',clock_timestamp()));
 end loop;
 insert into public.hotel_section_translations(section_id,language,title,content,category,cta,guest_fields,editorial_state,updated_at)
 values(s.id,p_language,translated->>'title',translated->>'content',translated->>'category',translated->>'cta',guests,state,clock_timestamp())
 on conflict(section_id,language) do update set title=excluded.title,content=excluded.content,category=excluded.category,cta=excluded.cta,guest_fields=excluded.guest_fields,editorial_state=excluded.editorial_state,updated_at=excluded.updated_at;
 return true;
end $$;
revoke all on function public.save_current_hotel_service_translation(uuid,text,timestamptz,timestamptz,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_current_hotel_service_translation(uuid,text,timestamptz,timestamptz,jsonb,text,boolean) to authenticated;
comment on column public.hotel_section_translations.editorial_state is 'Per-field provenance and invalidation. Legacy text is protected; no bulk translation or editorial backfill.';
commit;
