-- Generic public composition. No tenant creation, entitlement provisioning or backfill.
-- Rollback: unpublish these slots through a future migration; retain rows and files.
begin;
create table public.hotel_public_experience_media (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  slot text not null check(slot in ('hero','about','restaurant','accommodation')),
  image_path text,
  mobile_image_path text,
  focal_x numeric not null default 50 check(focal_x between 0 and 100),
  focal_y numeric not null default 50 check(focal_y between 0 and 100),
  mobile_focal_x numeric not null default 50 check(mobile_focal_x between 0 and 100),
  mobile_focal_y numeric not null default 50 check(mobile_focal_y between 0 and 100),
  alt_text text not null default '' check(length(alt_text)<=300 and alt_text !~ '[<>[:cntrl:]]'),
  title text not null default '' check(length(title)<=160 and title !~ '[<>[:cntrl:]]'),
  description text not null default '' check(length(description)<=4000 and description !~ '[<>]'),
  cta_label text not null default '' check(length(cta_label)<=80 and cta_label !~ '[<>[:cntrl:]]'),
  cta_url text check(cta_url is null or (length(cta_url)<=2048 and cta_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]{1,5})?([/?#].*)?$' and cta_url !~ '[[:space:][:cntrl:]<>\\@]')),
  is_published boolean not null default false,
  revision integer not null default 1 check(revision>0),
  primary key(hotel_id,slot),
  check(not is_published or length(btrim(title))>0),
  check((image_path is null and mobile_image_path is null) or length(btrim(alt_text))>0),
  check(image_path is null or (length(image_path)<=512 and image_path ~ ('^'||hotel_id::text||'/hero/'||slot||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))),
  check(mobile_image_path is null or (length(mobile_image_path)<=512 and mobile_image_path ~ ('^'||hotel_id::text||'/hero/'||slot||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')))
);
alter table public.hotel_public_experience_media enable row level security;
revoke all on public.hotel_public_experience_media from public,anon,authenticated;
grant select on public.hotel_public_experience_media to anon,authenticated;
create policy experience_media_public_read on public.hotel_public_experience_media for select to anon,authenticated using (
  is_published and public.is_hotel_publicly_active(hotel_id)
  and public.is_hotel_module_enabled(hotel_id,'core.directory')
  and public.is_hotel_module_enabled(hotel_id,'experience.appearance')
  and (slot<>'restaurant' or public.is_hotel_module_enabled(hotel_id,'content.services'))
);
create policy experience_media_admin_read on public.hotel_public_experience_media for select to authenticated using (
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'experience.appearance')
  and exists(select 1 from public.hotels h where h.id=hotel_id and h.platform_status<>'archived')
);

create function public.update_current_hotel_experience_media(p_slot text,p_expected_revision integer,p_values jsonb)
returns table(revision integer,previous_image_path text,previous_mobile_image_path text)
language plpgsql security definer set search_path='' as $$
declare
  target uuid;
  previous public.hotel_public_experience_media%rowtype;
  candidate public.hotel_public_experience_media%rowtype;
  k text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='experience_session_required'; end if;
  select p.hotel_id into target from public.profiles p where p.id=auth.uid() and p.is_active for share;
  if target is null or not public.has_active_hotel_role(target,'editor') then
    raise exception using errcode='42501',message='experience_editor_required';
  end if;
  perform 1 from public.hotels h where h.id=target and h.platform_status<>'archived' for update;
  if not found or not public.is_hotel_module_enabled(target,'experience.appearance') then
    raise exception using errcode='42501',message='experience_entitlement_required';
  end if;
  if p_slot is null or p_slot not in('hero','about','restaurant','accommodation')
    or p_expected_revision is null or p_expected_revision<0
    or p_values is null or jsonb_typeof(p_values)<>'object' then
    raise exception using errcode='22023',message='experience_values_invalid';
  end if;
  for k in select jsonb_object_keys(p_values) loop
    if k not in('image_path','mobile_image_path','focal_x','focal_y','mobile_focal_x','mobile_focal_y','alt_text','title','description','cta_label','cta_url','is_published') then
      raise exception using errcode='22023',message='experience_field_invalid';
    end if;
  end loop;
  select m.* into previous from public.hotel_public_experience_media m where m.hotel_id=target and m.slot=p_slot for update;
  if coalesce(previous.revision,0)<>p_expected_revision then
    raise exception using errcode='PT409',message='experience_revision_conflict';
  end if;
  if previous.hotel_id is null then
    candidate.hotel_id:=target; candidate.slot:=p_slot;
    candidate.focal_x:=50; candidate.focal_y:=50; candidate.mobile_focal_x:=50; candidate.mobile_focal_y:=50;
    candidate.alt_text:=''; candidate.title:=''; candidate.description:=''; candidate.cta_label:=''; candidate.is_published:=false;
  else candidate:=previous;
  end if;
  candidate:=pg_catalog.jsonb_populate_record(candidate,p_values);
  candidate.revision:=coalesce(previous.revision,0)+1;
  insert into public.hotel_public_experience_media select candidate.*
  on conflict on constraint hotel_public_experience_media_pkey do update set
    image_path=excluded.image_path,mobile_image_path=excluded.mobile_image_path,
    focal_x=excluded.focal_x,focal_y=excluded.focal_y,mobile_focal_x=excluded.mobile_focal_x,mobile_focal_y=excluded.mobile_focal_y,
    alt_text=excluded.alt_text,title=excluded.title,description=excluded.description,
    cta_label=excluded.cta_label,cta_url=excluded.cta_url,is_published=excluded.is_published,revision=excluded.revision;
  perform public.record_admin_audit_event(auth.uid(),target,'experience.media_updated','hotel',target,
    pg_catalog.jsonb_build_object('slot',p_slot,'revision',candidate.revision),null);
  return query select candidate.revision,previous.image_path,previous.mobile_image_path;
end $$;
revoke all on function public.update_current_hotel_experience_media(text,integer,jsonb) from public,anon;
grant execute on function public.update_current_hotel_experience_media(text,integer,jsonb) to authenticated;
-- Storage policies are deliberately unchanged: only server-side privileged uploads.
commit;
