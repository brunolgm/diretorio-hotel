alter table public.hotel_analytics_events
  add column session_id text null;

create index hotel_analytics_events_hotel_id_session_id_created_at_idx
  on public.hotel_analytics_events(hotel_id, session_id, created_at desc);
