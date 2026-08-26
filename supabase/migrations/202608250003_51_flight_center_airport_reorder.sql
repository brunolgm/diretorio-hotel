-- Sprint 51, stage 3: atomic hotel-scoped airport ordering for the Flight Center admin.

do $$
begin
  if to_regclass('public.hotel_airports') is null
    or to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null
    or to_regprocedure('public.reorder_current_hotel_airports(uuid[])') is not null then
    raise exception '51 airport reorder preflight failed';
  end if;

  if not exists(
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid='public.hotel_airports'::regclass
      and c.conname='hotel_airports_sort_order_key'
      and c.condeferrable
  ) then
    raise exception '51 airport reorder preflight failed: deferrable order constraint is missing';
  end if;
end;
$$;

create function public.reorder_current_hotel_airports(p_airport_ids uuid[])
returns table(airport_id uuid,sort_order smallint)
language plpgsql security definer set search_path=''
as $$
declare
  actor_id uuid:=auth.uid();
  current_hotel_id uuid;
  requested_count integer:=coalesce(pg_catalog.array_length(p_airport_ids,1),0);
  configured_count integer;
begin
  select p.hotel_id into current_hotel_id
  from public.profiles p
  join public.hotels h on h.id=p.hotel_id
  where p.id=actor_id and p.is_active and h.platform_status<>'archived';

  if current_hotel_id is null
    or not public.has_active_hotel_role(current_hotel_id,'editor') then
    raise exception using errcode='42501',message='flight_editor_required';
  end if;

  if not public.is_hotel_module_enabled(current_hotel_id,'travel.flights') then
    raise exception using errcode='42501',message='flight_entitlement_required';
  end if;

  if requested_count<1 or requested_count>20
    or exists(select 1 from pg_catalog.unnest(p_airport_ids) requested(id) where requested.id is null)
    or (select count(distinct requested.id) from pg_catalog.unnest(p_airport_ids) requested(id))<>requested_count then
    raise exception using errcode='22023',message='flight_airport_order_invalid';
  end if;

  perform 1
  from public.hotel_airports ha
  where ha.hotel_id=current_hotel_id
  order by ha.sort_order
  for update;

  select count(*) into configured_count
  from public.hotel_airports ha
  where ha.hotel_id=current_hotel_id;

  if configured_count<>requested_count
    or exists(
      select 1
      from pg_catalog.unnest(p_airport_ids) requested(id)
      where not exists(
        select 1 from public.hotel_airports ha
        where ha.hotel_id=current_hotel_id and ha.airport_id=requested.id
      )
    ) then
    raise exception using errcode='22023',message='flight_airport_order_invalid';
  end if;

  set constraints public.hotel_airports_sort_order_key deferred;

  update public.hotel_airports ha
  set sort_order=ordered.position,
      updated_at=now()
  from (
    select requested.id,requested.ordinality::smallint as position
    from pg_catalog.unnest(p_airport_ids) with ordinality requested(id,ordinality)
  ) ordered
  where ha.hotel_id=current_hotel_id and ha.airport_id=ordered.id;

  perform public.record_admin_audit_event(
    actor_id,current_hotel_id,'flight.airports_reordered','hotel_airports',null,
    pg_catalog.jsonb_build_object('airport_count',requested_count),null
  );

  return query
  select ha.airport_id,ha.sort_order
  from public.hotel_airports ha
  where ha.hotel_id=current_hotel_id
  order by ha.sort_order;
end;
$$;

revoke all on function public.reorder_current_hotel_airports(uuid[])
from public,anon,authenticated,service_role;
grant execute on function public.reorder_current_hotel_airports(uuid[]) to authenticated;

comment on function public.reorder_current_hotel_airports(uuid[]) is
  'Atomically reorders every airport associated with the entitled current hotel.';
