create table public.hotel_room_links (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_number text not null,
  label text null,
  room_token text not null unique,
  restaurant_menu_url text null,
  is_active boolean not null default true,
  notes text null,
  last_token_rotated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_links_unique_hotel_room_number
    unique (hotel_id, room_number)
);

create index hotel_room_links_hotel_id_idx
  on public.hotel_room_links(hotel_id);

create index hotel_room_links_room_token_idx
  on public.hotel_room_links(room_token);

create index hotel_room_links_hotel_id_is_active_idx
  on public.hotel_room_links(hotel_id, is_active);

alter table public.hotel_room_links enable row level security;

create policy "Hotel users can read own room links"
  on public.hotel_room_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id = hotel_room_links.hotel_id
    )
  );

create policy "Hotel users can insert own room links"
  on public.hotel_room_links
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id = hotel_room_links.hotel_id
    )
  );

create policy "Hotel users can update own room links"
  on public.hotel_room_links
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id = hotel_room_links.hotel_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id = hotel_room_links.hotel_id
    )
  );

create policy "Hotel users can delete own room links"
  on public.hotel_room_links
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id = hotel_room_links.hotel_id
    )
  );
