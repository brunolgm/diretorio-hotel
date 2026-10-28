-- Shared optional editorial presentation; no seed, entitlement or operational writes.
begin;
create function public.valid_editorial_text(v jsonb, max_length integer) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if v is null or jsonb_typeof(v)<>'object' then return false; end if;
 return not exists(select 1 from jsonb_object_keys(v) k where k not in('pt','en','es'))
   and (select count(*)=3 from jsonb_object_keys(v))
   and not exists(select 1 from jsonb_each(v) e where jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>max_length or (e.value#>>'{}')~'[<>]');
end $$;
revoke all on function public.valid_editorial_text(jsonb,integer) from public,anon,authenticated,service_role;
create function public.valid_public_presentation(v jsonb, tenant uuid) returns boolean
language plpgsql immutable set search_path='' as $$
declare b jsonb; c jsonb; n jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or v->'version'<>'1'::jsonb
   or coalesce(v->>'heroTitleMode','') not in('media_title','hotel_name')
   or exists(select 1 from jsonb_object_keys(v) k where k not in('version','heroTitleMode','heroDesktopFocal','benefits','tourism'))
   or not(v ?& array['version','heroTitleMode','heroDesktopFocal','benefits','tourism']) then return false; end if;
 if v->'heroDesktopFocal'<>'null'::jsonb then
  c:=v->'heroDesktopFocal';
  if jsonb_typeof(c)<>'object' or not(c ?& array['x','y']) or exists(select 1 from jsonb_object_keys(c) k where k not in('x','y')) then return false; end if;
  foreach b in array array[c->'x',c->'y'] loop
   if jsonb_typeof(b)<>'number' then return false; end if;
   if (b#>>'{}')::numeric not between 0 and 100 then return false; end if;
  end loop;
 end if;
 if jsonb_typeof(v->'benefits')<>'array' then return false; end if;
 if jsonb_array_length(v->'benefits')>8 then return false; end if;
 for b in select value from jsonb_array_elements(v->'benefits') loop
  if jsonb_typeof(b)<>'object' then return false; end if;
  if coalesce(b->>'icon','') not in('location','bed','pool','fitness') or not public.valid_editorial_text(b->'label',120)
    or coalesce(btrim(b->'label'->>'pt'),'')='' or exists(select 1 from jsonb_object_keys(b) k where k not in('icon','label')) then return false; end if;
 end loop;
 c:=v->'tourism';
 if jsonb_typeof(c)<>'object' then return false; end if;
 if not public.valid_editorial_text(c->'title',160) or not public.valid_editorial_text(c->'description',600)
   or exists(select 1 from jsonb_object_keys(c) k where k not in('title','description','cards')) or jsonb_typeof(c->'cards') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'cards')>16 then return false; end if;
 for b in select value from jsonb_array_elements(c->'cards') loop
  if jsonb_typeof(b)<>'object' then return false; end if;
  if not public.valid_editorial_text(b->'title',120) or coalesce(btrim(b->'title'->>'pt'),'')=''
   or not(b ? 'image_path') or exists(select 1 from jsonb_object_keys(b) k where k not in('title','image_path')) then return false; end if;
  n:=b->'image_path';
  if n<>'null'::jsonb and (jsonb_typeof(n)<>'string' or not ((n#>>'{}') ~ ('^'||tenant::text||'/hero/editorial/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))) then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.valid_public_presentation(jsonb,uuid) from public,anon,authenticated,service_role;
create table public.hotel_public_presentation(
 hotel_id uuid primary key references public.hotels(id) on delete cascade,
 configuration jsonb not null,
 revision integer not null check(revision>0),
 check(public.valid_public_presentation(configuration,hotel_id))
);
alter table public.hotel_public_presentation enable row level security;
revoke all on table public.hotel_public_presentation from public,anon,authenticated,service_role;
grant select on table public.hotel_public_presentation to anon,authenticated;
create policy presentation_public_read on public.hotel_public_presentation for select to anon,authenticated using(
 public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'experience.appearance'));
create policy presentation_admin_read on public.hotel_public_presentation for select to authenticated using(
 public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'experience.appearance')
 and exists(select 1 from public.hotels h where h.id=hotel_id and h.platform_status<>'archived'));
create function public.save_current_hotel_public_presentation(p_expected_revision integer,p_configuration jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare target uuid; current_revision integer;
begin
 select p.hotel_id into target from public.profiles p where p.id=auth.uid() and p.is_active;
 if target is null or not public.has_active_hotel_role(target,'editor') or not public.is_hotel_module_enabled(target,'experience.appearance') then
  raise exception using errcode='42501',message='presentation_editor_required'; end if;
 perform 1 from public.hotels where id=target and platform_status<>'archived' for update;
 if not found then raise exception using errcode='42501',message='presentation_hotel_unavailable'; end if;
 select revision into current_revision from public.hotel_public_presentation where hotel_id=target;
 if p_expected_revision is null or p_expected_revision<>coalesce(current_revision,0) then raise exception using errcode='PT409',message='presentation_revision_conflict'; end if;
 if pg_column_size(p_configuration)>65536 or not public.valid_public_presentation(p_configuration,target) then raise exception using errcode='22023',message='presentation_configuration_invalid'; end if;
 insert into public.hotel_public_presentation values(target,p_configuration,coalesce(current_revision,0)+1)
 on conflict(hotel_id) do update set configuration=excluded.configuration,revision=excluded.revision;
 perform public.record_admin_audit_event(auth.uid(),target,'experience.presentation_updated','hotel',target,jsonb_build_object('revision',coalesce(current_revision,0)+1),null);
 return coalesce(current_revision,0)+1;
end $$;
revoke all on function public.save_current_hotel_public_presentation(integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_current_hotel_public_presentation(integer,jsonb) to authenticated;
commit;
