create policy "Hotel users can upload promotional banners"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'hotel-assets'
    and (storage.foldername(name))[1] = 'promotional-banners'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id::text = (storage.foldername(name))[2]
    )
  );

create policy "Hotel users can update promotional banners"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'hotel-assets'
    and (storage.foldername(name))[1] = 'promotional-banners'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id::text = (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'hotel-assets'
    and (storage.foldername(name))[1] = 'promotional-banners'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id::text = (storage.foldername(name))[2]
    )
  );

create policy "Hotel users can delete promotional banners"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'hotel-assets'
    and (storage.foldername(name))[1] = 'promotional-banners'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.hotel_id::text = (storage.foldername(name))[2]
    )
  );
