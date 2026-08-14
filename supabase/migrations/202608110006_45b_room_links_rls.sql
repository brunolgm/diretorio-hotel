-- Sprint 45B: room links, tokens and notes are editor-only and never anonymous.

do $$
declare
  unexpected_policies text;
begin
  if to_regclass('public.hotel_room_links') is null then
    raise exception '45B room-links preflight failed: hotel_room_links is missing';
  end if;

  select string_agg(policyname, ', ' order by policyname)
    into unexpected_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'hotel_room_links'
    and policyname not in (
      'Hotel users can read own room links',
      'Hotel users can insert own room links',
      'Hotel users can update own room links',
      'Hotel users can delete own room links'
    );

  if unexpected_policies is not null then
    raise exception '45B room-links preflight failed: review unexpected policies: %', unexpected_policies;
  end if;

  if exists (
    select 1
    from public.hotel_room_links
    where room_token !~ '^[A-Za-z0-9_-]{24}$'
  ) then
    raise exception '45B room-links preflight failed: existing room_token values must be exactly 24 base64url characters; review them without automatic rotation';
  end if;
end;
$$;

alter table public.hotel_room_links
  add constraint hotel_room_links_room_token_base64url_24_check
  check (room_token ~ '^[A-Za-z0-9_-]{24}$');

alter table public.hotel_room_links enable row level security;

drop policy if exists "Hotel users can read own room links" on public.hotel_room_links;
drop policy if exists "Hotel users can insert own room links" on public.hotel_room_links;
drop policy if exists "Hotel users can update own room links" on public.hotel_room_links;
drop policy if exists "Hotel users can delete own room links" on public.hotel_room_links;

create policy "45b_editor_read_room_links"
  on public.hotel_room_links
  for select
  to authenticated
  using (public.has_active_hotel_role(hotel_id, 'editor'));

create policy "45b_editor_insert_room_links"
  on public.hotel_room_links
  for insert
  to authenticated
  with check (public.has_active_hotel_role(hotel_id, 'editor'));

create policy "45b_editor_update_room_links"
  on public.hotel_room_links
  for update
  to authenticated
  using (public.has_active_hotel_role(hotel_id, 'editor'))
  with check (public.has_active_hotel_role(hotel_id, 'editor'));

revoke all on table public.hotel_room_links from public, anon, authenticated;
revoke all on table public.hotel_room_links from service_role;
grant select, insert, update on table public.hotel_room_links to authenticated;
grant select on table public.hotel_room_links to service_role;

comment on table public.hotel_room_links is
  'Contains 24-character base64url room tokens and internal notes. Editor-only administration has no DELETE; /r/[roomToken] resolves through a server-only client with service_role SELECT.';
