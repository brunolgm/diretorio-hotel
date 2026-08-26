create table public.hotel_promotional_banners (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  title text not null,
  subtitle text null,
  image_url text null,
  cta_label text null,
  cta_url text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_promotional_banners_date_window_check
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index hotel_promotional_banners_hotel_id_idx
  on public.hotel_promotional_banners(hotel_id);

create index hotel_promotional_banners_public_visibility_idx
  on public.hotel_promotional_banners(hotel_id, is_active, display_order, starts_at, ends_at);

create table public.hotel_promotional_banner_translations (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.hotel_promotional_banners(id) on delete cascade,
  language text not null,
  title text null,
  subtitle text null,
  cta_label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_promotional_banner_translations_language_check
    check (language in ('en', 'es')),
  constraint hotel_promotional_banner_translations_unique_banner_language
    unique (banner_id, language)
);

create index hotel_promotional_banner_translations_banner_id_idx
  on public.hotel_promotional_banner_translations(banner_id);

create index hotel_promotional_banner_translations_language_idx
  on public.hotel_promotional_banner_translations(language);

alter table public.hotel_promotional_banners enable row level security;

alter table public.hotel_promotional_banner_translations enable row level security;

create policy "Public can read active promotional banners"
  on public.hotel_promotional_banners
  for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "Hotel users can read own promotional banners"
  on public.hotel_promotional_banners
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_promotional_banners.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can insert own promotional banners"
  on public.hotel_promotional_banners
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_promotional_banners.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can update own promotional banners"
  on public.hotel_promotional_banners
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_promotional_banners.hotel_id
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_promotional_banners.hotel_id
        and p.is_active = true
    )
  );

create policy "Hotel users can delete own promotional banners"
  on public.hotel_promotional_banners
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.hotel_id = hotel_promotional_banners.hotel_id
        and p.is_active = true
    )
  );

create policy "Public can read translations for active promotional banners"
  on public.hotel_promotional_banner_translations
  for select
  using (
    exists (
      select 1
      from public.hotel_promotional_banners b
      where b.id = hotel_promotional_banner_translations.banner_id
        and b.is_active = true
        and (b.starts_at is null or b.starts_at <= now())
        and (b.ends_at is null or b.ends_at >= now())
    )
  );

create policy "Hotel users can read own promotional banner translations"
  on public.hotel_promotional_banner_translations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_promotional_banners b
      join public.profiles p on p.hotel_id = b.hotel_id
      where b.id = hotel_promotional_banner_translations.banner_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can insert own promotional banner translations"
  on public.hotel_promotional_banner_translations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.hotel_promotional_banners b
      join public.profiles p on p.hotel_id = b.hotel_id
      where b.id = hotel_promotional_banner_translations.banner_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can update own promotional banner translations"
  on public.hotel_promotional_banner_translations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_promotional_banners b
      join public.profiles p on p.hotel_id = b.hotel_id
      where b.id = hotel_promotional_banner_translations.banner_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.hotel_promotional_banners b
      join public.profiles p on p.hotel_id = b.hotel_id
      where b.id = hotel_promotional_banner_translations.banner_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );

create policy "Hotel users can delete own promotional banner translations"
  on public.hotel_promotional_banner_translations
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.hotel_promotional_banners b
      join public.profiles p on p.hotel_id = b.hotel_id
      where b.id = hotel_promotional_banner_translations.banner_id
        and p.id = auth.uid()
        and p.is_active = true
    )
  );
