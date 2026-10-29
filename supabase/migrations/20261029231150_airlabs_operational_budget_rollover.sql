-- Decision 2026-10-29: operational validity, not a provider billing cycle.
-- Opt-in only; parent counters/dates are preserved. A chain cannot spend more
-- than its original authorized capacity. No credit replenishment or new grants.
alter table flight_private.budgets
  add column rollover_enabled boolean not null default false,
  add column rolled_from timestamptz,
  add constraint airlabs_budget_rollover_parent foreign key(provider,account_scope,rolled_from)
    references flight_private.budgets(provider,account_scope,period_start),
  add constraint airlabs_budget_rollover_one_child unique(provider,account_scope,rolled_from),
  add constraint airlabs_budget_rollover_forward check(rolled_from is null or rolled_from<period_start);
comment on column flight_private.budgets.rollover_enabled is
  'Opt-in operational validity renewal; never replenishes capacity or infers billing.';
comment on column flight_private.budgets.rolled_from is
  'Predecessor in the same provider/account; successor cap is its unused capacity.';

create or replace function public.admit_airlabs_query(p_account_scope text,p_hotel_id uuid,p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  q flight_private.query_cache%rowtype;
  policy flight_private.rate_policies%rowtype;
  budget flight_private.budgets%rowtype;
  moment timestamptz;
  identity text;
  departure_day date;
  kind text:=p_query->>'query_type';
  start_at timestamptz;
  scope_name text;
  scope_identity text;
  scope_limit integer;
  counter bigint;
  blocked boolean:=false;
begin
  if p_query is null or jsonb_typeof(p_query)<>'object'
    or (p_query - array['provider','contract_version','query_type','flight_iata','departure_date','departure_airport','arrival_airport'])<>'{}'::jsonb
    or (p_query->>'provider') is distinct from 'airlabs'
    or (p_query->>'contract_version') is distinct from '1'
    or kind is null or kind not in ('schedule','live')
    or coalesce(p_query->>'flight_iata','') !~ '^(?=[A-Z0-9]?[A-Z])[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$'
    or coalesce(p_query->>'departure_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(p_query->>'departure_airport','') !~ '^[A-Z]{3}$'
    or coalesce(p_query->>'arrival_airport','') !~ '^[A-Z]{3}$'
    or p_query->>'departure_airport'=p_query->>'arrival_airport'
    or coalesce(p_account_scope,'') !~ '^[a-z0-9_-]{1,64}$' then
    raise exception using errcode='22023',message='airlabs_query_invalid';
  end if;
  begin
    departure_day:=(p_query->>'departure_date')::date;
    if to_char(departure_day,'YYYY-MM-DD') is distinct from p_query->>'departure_date' then
      raise exception using errcode='22023',message='airlabs_query_invalid';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode='22023',message='airlabs_query_invalid';
  end;
  if not exists(select 1 from public.public_hotels where id=p_hotel_id)
    or not exists(select 1 from public.get_public_hotel_flight_center(p_hotel_id) a
      where a.airport_iata_code=p_query->>'departure_airport') then
    return jsonb_build_object('status','forbidden');
  end if;
  identity:='airlabs:1:'||kind||':'||(p_query->>'flight_iata')||':'||to_char(departure_day,'YYYY-MM-DD')||':'||(p_query->>'departure_airport')||':'||(p_query->>'arrival_airport');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('airlabs:'||p_account_scope,5101));
  moment:=clock_timestamp();
  select * into policy from flight_private.rate_policies where account_scope=p_account_scope for share;
  if not found then return jsonb_build_object('status','coordinator_unavailable'); end if;
  start_at:=to_timestamp(floor(extract(epoch from moment)/policy.window_seconds)*policy.window_seconds);
  foreach scope_name in array array['global','hotel','occurrence'] loop
    scope_identity:=case scope_name when 'global' then 'airlabs' when 'hotel' then p_hotel_id::text else identity end;
    scope_limit:=case scope_name when 'global' then policy.global_limit when 'hotel' then policy.hotel_limit else policy.occurrence_limit end;
    insert into flight_private.rate_buckets values(p_account_scope,scope_name,scope_identity,start_at,start_at+make_interval(secs=>policy.window_seconds),1)
    on conflict(account_scope,scope,scope_key) do update set
      used_total=case when flight_private.rate_buckets.window_start=excluded.window_start then least(flight_private.rate_buckets.used_total+1,2147483648) else 1 end,
      window_start=excluded.window_start,expires_at=excluded.expires_at
    returning used_total into counter;
    blocked:=blocked or counter>scope_limit;
  end loop;
  if blocked then return jsonb_build_object('status','rate_limited'); end if;
  insert into flight_private.query_cache(canonical_key,provider,contract_version,query_type,flight_iata,departure_date,departure_airport,arrival_airport)
  values(identity,'airlabs',1,kind,p_query->>'flight_iata',departure_day,p_query->>'departure_airport',p_query->>'arrival_airport')
  on conflict do nothing;
  select * into q from flight_private.query_cache where canonical_key=identity for update;
  moment:=clock_timestamp();
  if q.fresh_until>moment then
    return jsonb_build_object('status','cache_hit','data',q.normalized_result,'error',q.result_error);
  end if;
  if exists(select 1 from flight_private.query_cooldowns where canonical_key=identity
    and account_scope=p_account_scope and cooldown_until>moment) then
    return jsonb_build_object('status','provider_cooldown');
  end if;
  if q.lease_until>moment then return jsonb_build_object('status','in_progress'); end if;
  -- Opt-in operational renewal carries unused capacity, never provider billing credit.
  -- The account advisory lock and cache row lock above serialize this transition.
  if (select count(*) from flight_private.budgets where provider='airlabs' and account_scope=p_account_scope and period_start<=moment and period_end>moment)=0 then
    select * into budget from flight_private.budgets
      where provider='airlabs' and account_scope=p_account_scope
      order by period_start desc limit 1 for update;
    if not found or not budget.rollover_enabled or budget.suspended
      or budget.period_start>moment or budget.period_end>moment then
      return jsonb_build_object('status','budget_unavailable');
    end if;
    insert into flight_private.budgets(provider,account_scope,period_start,period_end,
      limit_total,used_total,suspended,rollover_enabled,rolled_from)
    values('airlabs',p_account_scope,moment,moment+interval '720 hours',
      budget.limit_total-budget.used_total,0,false,true,budget.period_start);
  end if;
  -- Ambiguous periods still fail closed. No inferred billing renewal or counter reset.
  if (select count(*) from flight_private.budgets where provider='airlabs' and account_scope=p_account_scope and period_start<=moment and period_end>moment)<>1 then
    return jsonb_build_object('status','budget_unavailable');
  end if;
  select * into budget from flight_private.budgets where provider='airlabs' and account_scope=p_account_scope and period_start<=moment and period_end>moment for update;
  if budget.suspended then return jsonb_build_object('status','budget_unavailable'); end if;
  if budget.used_total>=budget.limit_total then return jsonb_build_object('status','quota_exhausted'); end if;
  update flight_private.budgets set used_total=used_total+1,updated_at=moment
  where provider='airlabs' and account_scope=p_account_scope and period_start=budget.period_start;
  update flight_private.query_cache set owner_token=gen_random_uuid(),owner_account_scope=p_account_scope,lease_until=moment+interval '15 seconds',
    retain_until=greatest(retain_until,moment+interval '1 day'),updated_at=moment
  where canonical_key=identity returning * into q;
  return jsonb_build_object('status','fetch_allowed','canonical_key',identity,'owner_token',q.owner_token,'lease_until',q.lease_until);
end;
$$;
