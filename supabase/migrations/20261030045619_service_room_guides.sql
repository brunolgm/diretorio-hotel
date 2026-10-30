begin;
-- Optional structured child of the existing Services domain. No tenant seed or module enablement.
create schema if not exists libguest_room_guides_private;
revoke all on schema libguest_room_guides_private from public,anon,authenticated,service_role;
create function libguest_room_guides_private.localized(v jsonb,n integer,required boolean) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='object' and (select count(*)=3 from jsonb_object_keys(v)) and v ?& array['pt','en','es'] and not exists(select 1 from jsonb_each(v) e where jsonb_typeof(e.value)<>'string' or char_length(e.value#>>'{}')>n or ((e.value#>>'{}')~'[<>]' or translate(e.value#>>'{}',chr(9)||chr(10)||chr(13),'')~'[[:cntrl:]]') or (required and btrim(e.value#>>'{}')='')),false)
$$;
create function libguest_room_guides_private.url(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select v='null'::jsonb or coalesce(jsonb_typeof(v)='string' and char_length(v#>>'{}')<=2048 and (v#>>'{}')~'^https://[^/@[:space:]<>]+([/?#][^[:space:]<>]*)?$' and (v#>>'{}')!~*'^https://shre[.]ink([/:?#]|$)',false)
$$;
create function libguest_room_guides_private.valid(v jsonb,h uuid,s uuid,ready boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; x jsonb; nums text[]:=array[]::text[]; ids text[]:=array[]::text[]; begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>262144 or not(v ?& array['version','category','applicability','steps','channels','source','manual_url']) or (select count(*)<>7 from jsonb_object_keys(v)) or jsonb_typeof(v->'version')<>'number' or v->>'version'<>'1' or not coalesce(v->>'category' in ('tv','shower','air_conditioning','voice_assistant','other'),false) or not libguest_room_guides_private.url(v->'manual_url') then return false; end if;
 a:=v->'applicability';if jsonb_typeof(a)<>'object' or not(a ?& array['scope','label','categories']) or (select count(*)<>3 from jsonb_object_keys(a)) or not coalesce(a->>'scope' in ('unconfirmed','all','categories'),false) or (ready and a->>'scope'='unconfirmed') or not libguest_room_guides_private.localized(a->'label',240,ready and a->>'scope'='categories') or jsonb_typeof(a->'categories')<>'array' then return false;end if;
 if jsonb_array_length(a->'categories')>30 or (a->>'scope'='categories' and jsonb_array_length(a->'categories')=0) then return false;end if;
 for x in select value from jsonb_array_elements(a->'categories') loop if jsonb_typeof(x)<>'string' or char_length(x#>>'{}') not between 1 and 100 or (x#>>'{}')~'[<>]' then return false;end if;end loop;
 a:=v->'source';if jsonb_typeof(a)<>'object' or not(a ?& array['url','sha256']) or (select count(*)<>2 from jsonb_object_keys(a)) or not libguest_room_guides_private.url(a->'url') or not(a->'sha256'='null'::jsonb or (jsonb_typeof(a->'sha256')='string' and a->>'sha256'~'^[a-f0-9]{64}$')) then return false;end if;
 if jsonb_typeof(v->'steps')<>'array' or jsonb_typeof(v->'channels')<>'array' then return false;end if;
 if jsonb_array_length(v->'steps')>20 or (ready and jsonb_array_length(v->'steps')=0) or jsonb_array_length(v->'channels')>500 then return false;end if;
 for x in select value from jsonb_array_elements(v->'steps') loop
  if jsonb_typeof(x)<>'object' or not(x ?& array['key','title','body','image_path','alt']) or (select count(*)<>5 from jsonb_object_keys(x)) or jsonb_typeof(x->'key')<>'string' or (x->>'key')!~'^[a-z0-9-]{1,50}$' or x->>'key'=any(ids) or not libguest_room_guides_private.localized(x->'title',180,ready) or not libguest_room_guides_private.localized(x->'body',3000,ready) or not libguest_room_guides_private.localized(x->'alt',240,ready and x->'image_path'<>'null'::jsonb) then return false;end if;
  if x->'image_path'<>'null'::jsonb and (jsonb_typeof(x->'image_path')<>'string' or (x->>'image_path')!~('^'||h::text||'/room-guides/'||s::text||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.](jpg|png|webp)$')) then return false;end if;
  ids:=array_append(ids,x->>'key');
 end loop;
 for x in select value from jsonb_array_elements(v->'channels') loop
  if jsonb_typeof(x)<>'object' or not(x ?& array['number','name','quality','category','kind']) or (select count(*)<>5 from jsonb_object_keys(x)) or jsonb_typeof(x->'number')<>'string' or (x->>'number')!~'^[0-9]{1,4}$' then return false;end if;
  if (x->>'number')::integer<1 or ((x->>'number')::integer)::text=any(nums) or jsonb_typeof(x->'name')<>'string' or char_length(btrim(x->>'name')) not between 1 and 160 or x->>'name'~'[<>]' or not coalesce(x->>'quality' in ('SD','HD','unspecified'),false) or not coalesce(x->>'kind' in ('linear','application','review'),false) or (ready and x->>'kind'='review') or (x->>'kind'='linear' and x->>'name'~*'netflix') or not(x->'category'='null'::jsonb or (jsonb_typeof(x->'category')='string' and char_length(btrim(x->>'category')) between 1 and 100 and x->>'category'!~'[<>]')) then return false;end if;
  nums:=array_append(nums,((x->>'number')::integer)::text);
 end loop;return true;
 exception when others then return false;
end $$;
create table public.hotel_service_guides(
 service_id uuid primary key references public.hotel_sections(id) on delete cascade,
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 source_key text null, draft jsonb not null, published jsonb null, media_paths text[] not null default array[]::text[] check(cardinality(media_paths)<=512),
 revision integer not null check(revision>0),published_revision integer null,published_at timestamptz null,updated_at timestamptz not null default now(),
 unique(hotel_id,source_key),
 check(libguest_room_guides_private.valid(draft,hotel_id,service_id,false) is true),
 check(published is null or libguest_room_guides_private.valid(published,hotel_id,service_id,true) is true)
);
alter table public.hotel_service_guides enable row level security;
revoke all on public.hotel_service_guides from public,anon,authenticated,service_role;
grant select on public.hotel_service_guides to authenticated;
create policy service_guides_operator_read on public.hotel_service_guides for select to authenticated using(
 public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.services') and public.is_hotel_module_enabled(hotel_id,'content.languages') and exists(select 1 from public.hotels h where h.id=hotel_id and h.platform_status<>'archived'));
create function libguest_room_guides_private.editor() returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;begin select hotel_id into h from public.profiles where id=auth.uid() and is_active;
 if h is null or not public.has_active_hotel_role(h,'operador') or (not public.is_hotel_module_enabled(h,'content.services') or not public.is_hotel_module_enabled(h,'content.languages')) then raise exception using errcode='42501',message='guide_operator_required';end if;
 perform 1 from public.hotels where id=h and platform_status<>'archived' for update;if not found then raise exception using errcode='42501',message='guide_hotel_unavailable';end if;return h;end $$;
create function public.get_current_hotel_service_guide(p_service_id uuid) returns table(hotel_id uuid,service_id uuid,draft jsonb,published jsonb,revision integer) language plpgsql security definer set search_path='' as $$
declare h uuid:=libguest_room_guides_private.editor();begin
 if not exists(select 1 from public.hotel_sections s where s.id=p_service_id and s.hotel_id=h) then raise exception using errcode='42501',message='guide_service_unavailable';end if;
 return query select h,p_service_id,g.draft,g.published,coalesce(g.revision,0) from (select 1) anchor left join public.hotel_service_guides g on g.service_id=p_service_id and g.hotel_id=h;
end $$;
create function public.save_current_hotel_service_guide(p_service_id uuid,p_expected_revision integer,p_configuration jsonb,p_publish boolean default false,p_review_confirmed boolean default false) returns table(revision integer,is_published boolean) language plpgsql security definer set search_path='' as $$
declare h uuid:=libguest_room_guides_private.editor(); current_revision integer; path text;begin
 if p_publish is null or p_review_confirmed is null then raise exception using errcode='22023',message='guide_flags_invalid';end if;
 perform 1 from public.hotel_sections s where s.id=p_service_id and s.hotel_id=h for update;if not found then raise exception using errcode='42501',message='guide_service_unavailable';end if;
 select g.revision into current_revision from public.hotel_service_guides g where g.service_id=p_service_id;
 if p_expected_revision is null or p_expected_revision<>coalesce(current_revision,0) then raise exception using errcode='PT409',message='guide_revision_conflict';end if;
 if not coalesce(libguest_room_guides_private.valid(p_configuration,h,p_service_id,coalesce(p_publish,false)),false) or (p_publish and p_review_confirmed is distinct from true) then raise exception using errcode='22023',message='guide_review_or_configuration_invalid';end if;
 if p_publish and not exists(select 1 from public.hotel_sections s where s.id=p_service_id and s.enabled and s.service_action_type='standard' and nullif(btrim(s.url),'') is null and char_length(btrim(s.content))>=60) then raise exception using errcode='22023',message='guide_native_service_required';end if;
 for path in select value->>'image_path' from jsonb_array_elements(p_configuration->'steps') where value->'image_path'<>'null'::jsonb loop
  if not exists(select 1 from storage.objects o where o.bucket_id='hotel-assets' and o.name=path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')) then raise exception using errcode='22023',message='guide_media_unavailable';end if;
 end loop;
 insert into public.hotel_service_guides as g(service_id,hotel_id,draft,revision,published,published_revision,published_at,media_paths) values(p_service_id,h,p_configuration,coalesce(current_revision,0)+1,case when p_publish then p_configuration end,case when p_publish then coalesce(current_revision,0)+1 end,case when p_publish then now() end,array(select value->>'image_path' from jsonb_array_elements(p_configuration->'steps') where value->'image_path'<>'null'::jsonb))
 on conflict(service_id) do update set media_paths=array(select distinct retained.asset_path from unnest(g.media_paths||excluded.media_paths) as retained(asset_path)),draft=excluded.draft,revision=excluded.revision,published=case when p_publish then excluded.published else g.published end,published_revision=case when p_publish then excluded.published_revision else g.published_revision end,published_at=case when p_publish then excluded.published_at else g.published_at end,updated_at=now();
 perform public.record_admin_audit_event(auth.uid(),h,case when p_publish then 'service.guide_published' else 'service.guide_draft_saved' end,'hotel_section',p_service_id,jsonb_build_object('revision',coalesce(current_revision,0)+1),null);
 return query select coalesce(current_revision,0)+1,p_publish;
end $$;
create function public.get_public_hotel_service_guides(p_hotel_id uuid,p_service_id uuid default null) returns table(service_id uuid,configuration jsonb,revision integer) language sql stable security definer set search_path='' as $$
 select g.service_id,case when p_service_id is null then jsonb_build_object('category',g.published->'category','applicability',g.published->'applicability') else g.published end,g.published_revision
 from public.hotel_service_guides g join public.hotel_sections s on s.id=g.service_id and s.hotel_id=g.hotel_id
 where g.hotel_id=p_hotel_id and (p_service_id is null or g.service_id=p_service_id) and g.published is not null and s.enabled and s.service_action_type='standard' and nullif(btrim(s.url),'') is null and char_length(btrim(s.content))>=60 and public.is_hotel_publicly_active(g.hotel_id) and public.is_hotel_module_enabled(g.hotel_id,'core.directory') and public.is_hotel_module_enabled(g.hotel_id,'content.services') and public.is_hotel_module_enabled(g.hotel_id,'content.languages')
$$;
create function public.get_current_hotel_published_service_guides(p_service_id uuid default null) returns table(service_id uuid,configuration jsonb,revision integer) language sql stable security definer set search_path='' as $$
 select g.service_id,case when p_service_id is null then jsonb_build_object('category',g.published->'category','applicability',g.published->'applicability') else g.published end,g.published_revision
 from public.hotel_service_guides g join public.hotel_sections s on s.id=g.service_id and s.hotel_id=g.hotel_id join public.profiles p on p.id=auth.uid() and p.hotel_id=g.hotel_id and p.is_active
 join public.hotels h on h.id=g.hotel_id and h.platform_status<>'archived'
 where (p_service_id is null or g.service_id=p_service_id) and g.published is not null and s.enabled and s.service_action_type='standard' and nullif(btrim(s.url),'') is null and char_length(btrim(s.content))>=60 and public.has_active_hotel_role(g.hotel_id,'operador') and public.is_hotel_module_enabled(g.hotel_id,'content.services') and public.is_hotel_module_enabled(g.hotel_id,'content.languages')
$$;
create function public.create_current_hotel_room_guide(p_source_key text,p_title jsonb,p_content jsonb,p_configuration jsonb) returns table(service_id uuid,revision integer) language plpgsql security definer set search_path='' as $$
declare h uuid:=libguest_room_guides_private.editor();s uuid;begin
 if p_source_key is null or p_source_key!~'^[a-z0-9-]{1,80}$' or not libguest_room_guides_private.localized(p_title,180,true) or not libguest_room_guides_private.localized(p_content,3000,true) then raise exception using errcode='22023',message='guide_parent_invalid';end if;
 select g.service_id into s from public.hotel_service_guides g where g.hotel_id=h and g.source_key=p_source_key;
 if s is not null then return query select s,g.revision from public.hotel_service_guides g where g.service_id=s;return;end if;
 s:=gen_random_uuid();if not coalesce(libguest_room_guides_private.valid(p_configuration,h,s,false),false) then raise exception using errcode='22023',message='guide_configuration_invalid';end if;
 -- New parents start disabled; existing operational services are never rewritten.
 insert into public.hotel_sections(id,hotel_id,title,content,service_action_type,enabled,sort_order,category) values(s,h,p_title->>'pt',p_content->>'pt','standard',false,coalesce((select max(sort_order)+1 from public.hotel_sections where hotel_id=h),0),'Guias do Quarto');
 insert into public.hotel_section_translations(section_id,language,title,content,category) select s,l,p_title->>l,p_content->>l,case when l='en' then 'Room guides' else 'Guías de la habitación' end from unnest(array['en','es']) l;
 insert into public.hotel_service_guides(service_id,hotel_id,source_key,draft,revision) values(s,h,p_source_key,p_configuration,1);
 perform public.record_admin_audit_event(auth.uid(),h,'service.guide_prepared','hotel_section',s,jsonb_build_object('revision',1,'source_key',p_source_key),null);
 return query select s,1;
end $$;
revoke all on all functions in schema libguest_room_guides_private from public,anon,authenticated,service_role;
revoke all on function public.get_current_hotel_service_guide(uuid),public.save_current_hotel_service_guide(uuid,integer,jsonb,boolean,boolean),public.get_public_hotel_service_guides(uuid,uuid),public.get_current_hotel_published_service_guides(uuid),public.create_current_hotel_room_guide(text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_current_hotel_service_guide(uuid),public.save_current_hotel_service_guide(uuid,integer,jsonb,boolean,boolean),public.get_current_hotel_published_service_guides(uuid),public.create_current_hotel_room_guide(text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.get_public_hotel_service_guides(uuid,uuid) to anon,authenticated;
-- No Storage write policy, entitlement/baseline change, seed or lifecycle update.
-- Behavioral rollback: future migration revokes RPC exposure; drafts/published snapshots remain intact.
commit;
