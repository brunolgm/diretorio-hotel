create table public.hotel_analytics_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  hotel_slug text not null,
  event_type text not null,
  language text null,
  target_url text null,
  department_id uuid null references public.hotel_departments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hotel_analytics_events_event_type_check
    check (
      event_type in (
        'page_view',
        'language_selected',
        'whatsapp_click',
        'website_click',
        'booking_click',
        'department_click'
      )
    ),
  constraint hotel_analytics_events_language_check
    check (language is null or language in ('pt', 'en', 'es'))
);

create index hotel_analytics_events_hotel_id_created_at_idx
  on public.hotel_analytics_events(hotel_id, created_at desc);

create index hotel_analytics_events_event_type_created_at_idx
  on public.hotel_analytics_events(event_type, created_at desc);

create index hotel_analytics_events_department_id_idx
  on public.hotel_analytics_events(department_id);

alter table public.hotel_analytics_events enable row level security;

create policy "Allow public analytics inserts"
  on public.hotel_analytics_events
  for insert
  to anon, authenticated
  with check (true);
