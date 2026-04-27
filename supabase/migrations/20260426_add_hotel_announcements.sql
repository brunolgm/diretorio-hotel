create table public.hotel_announcements (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text not null,
  body text null,
  category text not null default 'informativo',
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_announcements_category_check
    check (category in ('informativo', 'alerta', 'manutencao', 'promocao')),
  constraint hotel_announcements_date_window_check
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index hotel_announcements_hotel_id_idx
  on public.hotel_announcements(hotel_id);

create index hotel_announcements_public_visibility_idx
  on public.hotel_announcements(hotel_id, is_active, starts_at, ends_at);

create table public.hotel_announcement_translations (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.hotel_announcements(id) on delete cascade,
  language text not null,
  title text null,
  body text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_announcement_translations_language_check
    check (language in ('en', 'es')),
  constraint hotel_announcement_translations_unique_announcement_language
    unique (announcement_id, language)
);

create index hotel_announcement_translations_announcement_id_idx
  on public.hotel_announcement_translations(announcement_id);

create index hotel_announcement_translations_language_idx
  on public.hotel_announcement_translations(language);

alter table public.hotel_announcements enable row level security;

alter table public.hotel_announcement_translations enable row level security;

create policy "Public can read active hotel announcements"
  on public.hotel_announcements
  for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "Hotel users can read own announcements"
  on public.hotel_announcements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_announcements.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can insert own announcements"
  on public.hotel_announcements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_announcements.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can update own announcements"
  on public.hotel_announcements
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_announcements.hotel_id
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_announcements.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can delete own announcements"
  on public.hotel_announcements
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_announcements.hotel_id
        and p.is_active = true
    )
  );

create policy "Public can read translations for active hotel announcements"
  on public.hotel_announcement_translations
  for select
  using (
    exists (
      select 1
      from public.hotel_announcements a
      where a.id = hotel_announcement_translations.announcement_id
        and a.is_active = true
        and (a.starts_at is null or a.starts_at <= now())
        and (a.ends_at is null or a.ends_at >= now())
    )
  );

create policy "Hotel users can read own announcement translations"
  on public.hotel_announcement_translations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_announcements a
      join public.profiles p on p.hotel_id = a.hotel_id
      where a.id = hotel_announcement_translations.announcement_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can insert own announcement translations"
  on public.hotel_announcement_translations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.hotel_announcements a
      join public.profiles p on p.hotel_id = a.hotel_id
      where a.id = hotel_announcement_translations.announcement_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can update own announcement translations"
  on public.hotel_announcement_translations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_announcements a
      join public.profiles p on p.hotel_id = a.hotel_id
      where a.id = hotel_announcement_translations.announcement_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.hotel_announcements a
      join public.profiles p on p.hotel_id = a.hotel_id
      where a.id = hotel_announcement_translations.announcement_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can delete own announcement translations"
  on public.hotel_announcement_translations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_announcements a
      join public.profiles p on p.hotel_id = a.hotel_id
      where a.id = hotel_announcement_translations.announcement_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );
