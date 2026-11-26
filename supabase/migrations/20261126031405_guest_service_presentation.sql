-- Presentation metadata on the existing source. No editorial backfill, grants or RLS changes.
alter table public.hotel_sections
  add column if not exists guest_presentation jsonb;
alter table public.hotel_sections
  add constraint hotel_sections_guest_presentation_object
  check (guest_presentation is null or
    (jsonb_typeof(guest_presentation) = 'object' and octet_length(guest_presentation::text) <= 20000));
comment on column public.hotel_sections.guest_presentation is
  'Optional guest area/group/interaction and PT/EN/ES summary, hours, location, conditions. Does not authorize operations.';
