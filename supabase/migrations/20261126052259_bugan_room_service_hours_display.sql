begin;
-- Read-only presentation of the existing calendar; no pricing or order changes.
create function fb_order_private.bugan_room_service_hours(h uuid,outlet uuid,moment timestamptz) returns jsonb
language plpgsql stable set search_path='' as $$
declare s fb_order_private.availability_scopes%rowtype;zone text;local_time timestamp;
 start_at integer;end_at integer;minute integer;windows integer;days integer;consistent boolean;reopens timestamptz;
begin
 if not fb_order_private.native_hotel(h) or not exists(
  select 1 from public.hotels hotel join public.hotel_fb_outlets o on o.hotel_id=hotel.id
  where hotel.id=h and hotel.slug='bugan-recife' and hotel.platform_status='active'
   and o.id=outlet and o.type='room_service' and o.is_published and o.action_type<>'external_url'
 ) then return null;end if;
 select * into s from fb_order_private.availability_scopes where hotel_id=h and outlet_id=outlet;
 if not found or s.always_open then return null;end if;
 select timezone into zone from fb_order_private.hotel_settings where hotel_id=h;
 if zone is null then return null;end if;
 select count(*),count(distinct weekday),min(start_minute),min(end_minute),
  bool_and(not next_day) and min(start_minute)=max(start_minute) and min(end_minute)=max(end_minute)
 into windows,days,start_at,end_at,consistent
 from fb_order_private.availability_windows where hotel_id=h and scope_id=s.id;
 if windows<>7 or days<>7 or consistent is distinct from true then return null;end if;
 local_time:=moment at time zone zone;
 minute:=extract(hour from local_time)::int*60+extract(minute from local_time)::int;
 if not fb_order_private.scope_available(h,'outlet',outlet,moment)
  and exists(select 1 from fb_order_private.outlet_settings where hotel_id=h and id=outlet and mode='native' and accepting) then
  with candidates as (
   select ((local_time::date+day)+make_interval(mins=>start_at)) at time zone zone as at
   from generate_series(0,7) day
   union select s.closed_until where s.closed_until is not null
   union select ends_at from fb_order_private.availability_exceptions where hotel_id=h and scope_id=s.id and not available
   union select starts_at from fb_order_private.availability_exceptions where hotel_id=h and scope_id=s.id and available
  ) select min(at) into reopens from candidates where at>moment and at<=moment+interval '8 days'
   and fb_order_private.scope_available(h,'outlet',outlet,at);
 end if;
 return jsonb_build_object('timezone',zone,'start_minute',start_at,'end_minute',end_at,
  'outside_regular_hours',minute<start_at or minute>=end_at,'reopens_at',reopens);
end $$;
revoke all on function fb_order_private.bugan_room_service_hours(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
create function public.get_bugan_room_service_hours(p_hotel_id uuid,p_outlet_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform fb_order_private.service_only();
 return fb_order_private.bugan_room_service_hours(p_hotel_id,p_outlet_id,clock_timestamp());
end $$;
revoke all on function public.get_bugan_room_service_hours(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_bugan_room_service_hours(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
