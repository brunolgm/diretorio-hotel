-- Sprint 51, stage 9: privacy-bounded analytics events for the public Flight Center.

do $$
begin
  if to_regclass('public.hotel_analytics_events') is null
    or not exists(
      select 1
      from pg_catalog.pg_constraint c
      where c.conrelid=to_regclass('public.hotel_analytics_events')
        and c.conname='hotel_analytics_events_event_type_check'
        and c.contype='c'
    )
    or exists(
      select 1
      from pg_catalog.pg_constraint c
      where c.conrelid=to_regclass('public.hotel_analytics_events')
        and c.conname='hotel_analytics_events_flight_metadata_check'
    ) then
    raise exception '51 flight center analytics preflight failed';
  end if;
end;
$$;

alter table public.hotel_analytics_events
  drop constraint hotel_analytics_events_event_type_check,
  add constraint hotel_analytics_events_event_type_check check(event_type in(
    'page_view','language_selected','whatsapp_click','website_click','booking_click',
    'department_click','service_view','flight_center_view','flight_saved','flight_removed',
    'flight_official_link_click','flight_calendar_download','flight_route_open',
    'flight_service_action'
  )),
  add constraint hotel_analytics_events_flight_metadata_check check(
    event_type not in(
      'flight_center_view','flight_saved','flight_removed','flight_official_link_click',
      'flight_calendar_download','flight_route_open','flight_service_action'
    )
    or case when pg_catalog.jsonb_typeof(metadata)='object' then
      (
        (
          event_type='flight_service_action'
          and metadata ? 'action'
          and (metadata-'action')='{}'::jsonb
          and metadata->>'action' in('transfer','wake_up','breakfast_box','reception')
        )
        or (event_type<>'flight_service_action' and metadata='{}'::jsonb)
      )
    else false end
  );

comment on constraint hotel_analytics_events_flight_metadata_check
on public.hotel_analytics_events is
  'Flight Center analytics stores no itinerary or guest data; only the closed hotel-service action enum is allowed.';
