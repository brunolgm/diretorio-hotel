-- Presentation metadata on the existing source. No editorial backfill or RLS changes.
alter table public.hotel_sections
  add column if not exists guest_presentation jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.hotel_sections'::regclass and conname='hotel_sections_guest_presentation_object') then
    alter table public.hotel_sections
      add constraint hotel_sections_guest_presentation_object
      check (guest_presentation is null or
        (jsonb_typeof(guest_presentation) = 'object' and octet_length(guest_presentation::text) <= 20000));
  end if;
end $$;
-- Existing Admin writes are granted per column, not per table. Match that boundary:
-- this grants only the new editorial column; tenant/role RLS remains authoritative.
grant insert (guest_presentation), update (guest_presentation)
  on public.hotel_sections to authenticated;
comment on column public.hotel_sections.guest_presentation is
  'Optional guest area/group/interaction and PT/EN/ES summary, hours, location, conditions. Does not authorize operations.';
