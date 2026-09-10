-- AirLabs v1 infrastructure. No operational budget or rate policy is seeded.
do $$
begin
  if to_regnamespace('flight_private') is not null
    or to_regprocedure('public.get_public_hotel_flight_center(uuid)') is null
    or to_regclass('public.public_hotels') is null then
    raise exception '51 AirLabs coordinator preflight failed';
  end if;
end;
$$;

create schema flight_private;
revoke all on schema flight_private from public, anon, authenticated, service_role;

create table flight_private.budgets (
  provider text not null check(provider='airlabs'),
  account_scope text not null check(account_scope ~ '^[a-z0-9_-]{1,64}$'),
  period_start timestamptz not null,
  period_end timestamptz not null check(period_end>period_start),
  limit_total bigint not null check(limit_total>=0),
  used_total bigint not null default 0 check(used_total>=0 and used_total<=limit_total),
  suspended boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(provider,account_scope,period_start)
);
comment on column flight_private.budgets.used_total is 'Reservation is consumption; no automatic refunds, including timeout/crash.';

create table flight_private.rate_policies (
  account_scope text primary key check(account_scope ~ '^[a-z0-9_-]{1,64}$'),
  window_seconds integer not null check(window_seconds between 1 and 3600),
  global_limit integer not null check(global_limit>0),
  hotel_limit integer not null check(hotel_limit>0),
  occurrence_limit integer not null check(occurrence_limit>0)
);
create table flight_private.rate_buckets (
  account_scope text not null references flight_private.rate_policies(account_scope),
  scope text not null check(scope in ('global','hotel','occurrence')),
  scope_key text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  used_total bigint not null check(used_total>0),
  primary key(account_scope,scope,scope_key)
);
create index rate_buckets_expiry on flight_private.rate_buckets(expires_at);

create table flight_private.query_cache (
  canonical_key text primary key,
  provider text not null check(provider='airlabs'),
  contract_version integer not null check(contract_version=1),
  query_type text not null check(query_type in ('schedule','live')),
  flight_iata text not null check(flight_iata ~ '^(?=[A-Z0-9]?[A-Z])[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$'),
  departure_date date not null,
  departure_airport text not null check(departure_airport ~ '^[A-Z]{3}$'),
  arrival_airport text not null check(arrival_airport ~ '^[A-Z]{3}$' and arrival_airport<>departure_airport),
  normalized_result jsonb,
  result_error text check(result_error='not_found'),
  fetched_at timestamptz,
  source_updated_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz not null default clock_timestamp()+interval '1 day',
  owner_token uuid,
  owner_account_scope text check(owner_account_scope ~ '^[a-z0-9_-]{1,64}$'),
  lease_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check((owner_token is null)=(lease_until is null)),
  check((owner_token is null)=(owner_account_scope is null)),
  check(normalized_result is null or result_error is null)
);
create index query_cache_retention on flight_private.query_cache(retain_until);
-- Technical failures are account-local control state, never aviation cache.
create table flight_private.query_cooldowns (
  canonical_key text not null references flight_private.query_cache(canonical_key) on delete cascade,
  account_scope text not null check(account_scope ~ '^[a-z0-9_-]{1,64}$'),
  created_at timestamptz not null,
  cooldown_until timestamptz not null,
  primary key(canonical_key,account_scope)
);
create index query_cooldowns_expiry on flight_private.query_cooldowns(cooldown_until);
alter table flight_private.query_cooldowns enable row level security;
alter table flight_private.budgets enable row level security;
alter table flight_private.rate_policies enable row level security;
alter table flight_private.rate_buckets enable row level security;
alter table flight_private.query_cache enable row level security;
revoke all on all tables in schema flight_private from public,anon,authenticated,service_role;

-- Account lock serializes rate/budget decisions; cache row lock also deduplicates
-- across account scopes. Always acquire in this order. HTTP runs after commit.
create function public.admit_airlabs_query(p_account_scope text,p_hotel_id uuid,p_query jsonb)
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
  -- Zero or overlapping active periods fail closed. No calendar assumptions.
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

-- Validate a compact normalized projection. No provider text, URLs or nested raw
-- fields can cross this boundary. The transport's richer response stays in memory.
create function flight_private.valid_projection(p jsonb,kind text) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb;
begin
  if p is null or jsonb_typeof(p)<>'object' then return false; end if;
  if kind='live' then
    return (select count(*)=3 from jsonb_object_keys(p)) and (p-array['liveStatus','liveSourceType','updatedAt'])='{}'::jsonb
      and p->>'liveStatus' in ('scheduled','en-route','unknown')
      and p->>'liveSourceType' in ('adsb','unknown')
      and coalesce(p->>'updatedAt','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3})?Z$';
  end if;
  if (select count(*) from jsonb_object_keys(p))<>18 then return false; end if;
  foreach k in array array['flightNumber','airlineCode','departureAirport','arrivalAirport','scheduleStatus','fetchedAt'] loop
    if jsonb_typeof(p->k) is distinct from 'string' then return false; end if;
  end loop;
  if (p-array['flightNumber','airlineCode','departureAirport','arrivalAirport','scheduledDeparture','estimatedDeparture','actualDeparture','scheduledArrival','estimatedArrival','actualArrival','departureTerminal','departureGate','arrivalTerminal','arrivalGate','scheduleStatus','delayedMinutes','updatedAt','fetchedAt'])<>'{}'::jsonb
    or coalesce(p->>'flightNumber','') !~ '^[0-9]{1,4}[A-Z]?$'
    or coalesce(p->>'airlineCode','') !~ '^(?=[A-Z0-9]?[A-Z])[A-Z0-9]{2}$'
    or coalesce(p->>'departureAirport','') !~ '^[A-Z]{3}$'
    or coalesce(p->>'arrivalAirport','') !~ '^[A-Z]{3}$'
    or coalesce(p->>'scheduleStatus','') not in ('scheduled','active','landed','cancelled','unknown') then return false; end if;
  foreach k in array array['scheduledDeparture','estimatedDeparture','actualDeparture','scheduledArrival','estimatedArrival','actualArrival'] loop
    v:=p->k;
    if v is null then return false; end if;
    if v<>'null'::jsonb then
      if jsonb_typeof(v)<>'object' then return false; end if;
      if (select count(*) from jsonb_object_keys(v))<>2 or (v-array['local','utc'])<>'{}'::jsonb then return false; end if;
      if v->>'local' is not null and v->>'local' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$' then return false; end if;
      if v->>'utc' is not null and v->>'utc' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3})?Z$' then return false; end if;
    end if;
  end loop;
  foreach k in array array['departureTerminal','departureGate','arrivalTerminal','arrivalGate'] loop
    if p->k is null or (p->>'scheduleStatus') is null then return false; end if;
    if jsonb_typeof(p->k) not in ('null','string') then return false; end if;
    if p->>k is not null and p->>k !~ '^[A-Za-z0-9 ./-]{1,20}$' then return false; end if;
  end loop;
  if jsonb_typeof(p->'delayedMinutes') is distinct from 'object'
    or ((p->'delayedMinutes')-array['departure','arrival'])<>'{}'::jsonb then return false; end if;
  foreach k in array array['departure','arrival'] loop
    v:=p->'delayedMinutes'->k;
    if v is null then return false; end if;
    if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,4}$') then return false; end if;
    if v<>'null'::jsonb and v::integer>2880 then return false; end if;
  end loop;
  if coalesce(p->>'fetchedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3})?Z$' then return false; end if;
  return p->>'updatedAt' is null or p->>'updatedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{3})?Z$';
end;
$$;

create function public.publish_airlabs_query(p_canonical_key text,p_owner_token uuid,p_result jsonb,p_ttl_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare q flight_private.query_cache%rowtype; moment timestamptz;
begin
  select * into q from flight_private.query_cache where canonical_key=p_canonical_key for update;
  moment:=clock_timestamp();
  if not found or q.owner_token is distinct from p_owner_token or p_owner_token is null or q.lease_until<=moment then return false; end if;
  if flight_private.valid_projection(p_result,q.query_type) is distinct from true
    or p_ttl_seconds is null or not(case when q.query_type='live' then p_ttl_seconds between 1 and 300
      when p_result->>'scheduleStatus'='landed' then p_ttl_seconds=21600
      when p_result->>'scheduleStatus'='cancelled' then p_ttl_seconds=3600
      when p_result->>'scheduleStatus'='active' then p_ttl_seconds=900
      else p_ttl_seconds in (900,3600) end)
    or (q.query_type='schedule' and ((p_result->>'airlineCode')||(p_result->>'flightNumber') is distinct from q.flight_iata
      or p_result->>'departureAirport' is distinct from q.departure_airport
      or p_result->>'arrivalAirport' is distinct from q.arrival_airport
      or left(p_result->'scheduledDeparture'->>'local',10) is distinct from q.departure_date::text)) then
    raise exception using errcode='22023',message='airlabs_result_invalid';
  end if;
  update flight_private.query_cache set normalized_result=p_result,result_error=null,fetched_at=moment,
    source_updated_at=(p_result->>'updatedAt')::timestamptz,
    fresh_until=moment+make_interval(secs=>p_ttl_seconds),retain_until=moment+interval '1 day',
    owner_token=null,owner_account_scope=null,lease_until=null,updated_at=moment where canonical_key=p_canonical_key;
  return true;
end;
$$;

create function public.close_airlabs_query(p_canonical_key text,p_owner_token uuid,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
declare moment timestamptz; q flight_private.query_cache%rowtype;
begin
  if p_error is null or p_error not in ('not_found','provider_error') then raise exception 'airlabs_error_invalid'; end if;
  select * into q from flight_private.query_cache where canonical_key=p_canonical_key for update;
  moment:=clock_timestamp();
  if not found or p_owner_token is null or q.owner_token is distinct from p_owner_token or q.lease_until<=moment then return false; end if;
  if p_error='provider_error' then
    insert into flight_private.query_cooldowns values(p_canonical_key,q.owner_account_scope,moment,moment+interval '60 seconds')
    on conflict(canonical_key,account_scope) do update set created_at=excluded.created_at,cooldown_until=excluded.cooldown_until;
    update flight_private.query_cache set owner_token=null,owner_account_scope=null,lease_until=null,updated_at=moment
    where canonical_key=p_canonical_key;
    return true;
  end if;
  update flight_private.query_cache set normalized_result=null,result_error=p_error,fetched_at=moment,source_updated_at=null,
    fresh_until=moment+interval '10 minutes',
    retain_until=moment+interval '1 day',owner_token=null,owner_account_scope=null,lease_until=null,updated_at=moment where canonical_key=p_canonical_key;
  return true;
end;
$$;

create function public.cleanup_airlabs_queries(p_batch_size integer default 500)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer; buckets integer; cooldowns integer;
begin
  if p_batch_size is null or p_batch_size not between 1 and 1000 then raise exception 'airlabs_batch_invalid'; end if;
  with candidates as (select canonical_key from flight_private.query_cache where retain_until<clock_timestamp()
    and (lease_until is null or lease_until<clock_timestamp()) order by retain_until limit p_batch_size for update skip locked)
  delete from flight_private.query_cache q using candidates c where q.canonical_key=c.canonical_key;
  get diagnostics removed=row_count;
  with candidates as (select account_scope,scope,scope_key from flight_private.rate_buckets where expires_at<clock_timestamp()
    order by expires_at limit p_batch_size for update skip locked)
  delete from flight_private.rate_buckets b using candidates c where (b.account_scope,b.scope,b.scope_key)=(c.account_scope,c.scope,c.scope_key);
  get diagnostics buckets=row_count;
  with candidates as (select canonical_key,account_scope from flight_private.query_cooldowns where cooldown_until<clock_timestamp()
    order by cooldown_until limit p_batch_size for update skip locked)
  delete from flight_private.query_cooldowns d using candidates c where (d.canonical_key,d.account_scope)=(c.canonical_key,c.account_scope);
  get diagnostics cooldowns=row_count;
  return removed+buckets+cooldowns;
end;
$$;
revoke all on all functions in schema flight_private from public,anon,authenticated,service_role;
revoke all on function public.admit_airlabs_query(text,uuid,jsonb),public.publish_airlabs_query(text,uuid,jsonb,integer),public.close_airlabs_query(text,uuid,text),public.cleanup_airlabs_queries(integer) from public,anon,authenticated,service_role;
grant execute on function public.admit_airlabs_query(text,uuid,jsonb),public.publish_airlabs_query(text,uuid,jsonb,integer),public.close_airlabs_query(text,uuid,text),public.cleanup_airlabs_queries(integer) to service_role;
