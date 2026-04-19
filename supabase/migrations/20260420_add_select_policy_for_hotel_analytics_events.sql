create policy "Allow hotel users to view their analytics"
  on public.hotel_analytics_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.hotel_id = hotel_analytics_events.hotel_id
    )
  );
