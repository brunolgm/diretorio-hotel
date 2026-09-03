-- LibGuest AI Analytics Phase 2: content-free, tenant-scoped persistence.

do $$
begin
  if to_regclass('public.hotels') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.platform_users') is null
    or to_regclass('public.hotel_module_entitlements') is null then
    raise exception 'assistant analytics preflight: required authorization tables are missing';
  end if;
  if to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('auth.uid()') is null then
    raise exception 'assistant analytics preflight: required authorization helpers are missing';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'assistant analytics preflight: gen_random_uuid() is unavailable';
  end if;
  if to_regclass('public.assistant_analytics_events') is not null
    or to_regclass('public.assistant_analytics_events_hotel_occurred_idx') is not null
    or to_regclass('public.assistant_analytics_events_occurred_idx') is not null
    or exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'record_assistant_analytics_event',
        'get_hotel_assistant_analytics_summary',
        'get_platform_assistant_analytics_summary',
        'purge_assistant_analytics_events',
        '_build_assistant_analytics_summary'
      )
    ) then
    raise exception 'assistant analytics preflight: target object name already exists';
  end if;
end $$;

create table public.assistant_analytics_events (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  language text,
  assistant_route text not null,
  resolution_path text not null,
  outcome text not null,
  capability text,
  housekeeping_request_type text,
  action_type text,
  tourism_source text,
  classifier_intent text,
  classifier_confidence_band text,
  classifier_calls smallint not null,
  full_ai_calls smallint not null,
  total_upstream_calls smallint not null,
  total_latency_ms integer not null,
  classifier_latency_ms integer,
  full_ai_latency_ms integer,
  constraint assistant_analytics_events_schema_version_check
    check (schema_version = 1),
  constraint assistant_analytics_events_language_check
    check (language is null or language in ('pt', 'en', 'es')),
  constraint assistant_analytics_events_route_check
    check (assistant_route in ('deterministic', 'capability', 'clarification', 'classification', 'ai')),
  constraint assistant_analytics_events_resolution_path_check
    check (resolution_path in ('deterministic', 'direct_ai', 'classifier_to_capability', 'classifier_to_ai', 'classifier_failed_to_ai')),
  constraint assistant_analytics_events_outcome_check
    check (outcome in ('success', 'privacy_blocked', 'rate_limited', 'hotel_unavailable', 'assistant_failed', 'invalid_upstream_response')),
  constraint assistant_analytics_events_capability_check
    check (capability is null or capability in ('human_handoff', 'reception_contact', 'housekeeping_contact', 'housekeeping_request')),
  constraint assistant_analytics_events_housekeeping_request_type_check
    check (housekeeping_request_type is null or housekeeping_request_type in ('towels', 'room_cleaning')),
  constraint assistant_analytics_events_action_type_check
    check (action_type is null or action_type in ('open_url', 'confirm_request')),
  constraint assistant_analytics_events_tourism_source_check
    check (tourism_source is null or tourism_source in ('libguest_curated', 'general_ai', 'unavailable')),
  constraint assistant_analytics_events_classifier_intent_check
    check (classifier_intent is null or classifier_intent in (
      'human_handoff', 'reception_contact', 'housekeeping_contact',
      'housekeeping_request_towels', 'housekeeping_request_room_cleaning',
      'hotel_information', 'flight_information', 'tourism', 'sales', 'general_chat', 'unknown'
    )),
  constraint assistant_analytics_events_classifier_confidence_check
    check (classifier_confidence_band is null or classifier_confidence_band in ('high', 'medium', 'low', 'invalid')),
  constraint assistant_analytics_events_call_ranges_check
    check (classifier_calls in (0, 1) and full_ai_calls in (0, 1) and total_upstream_calls between 0 and 2),
  constraint assistant_analytics_events_call_total_check
    check (total_upstream_calls = classifier_calls + full_ai_calls),
  constraint assistant_analytics_events_resolution_calls_check
    check (
      (resolution_path = 'deterministic' and classifier_calls = 0 and full_ai_calls = 0 and total_upstream_calls = 0)
      or (resolution_path = 'direct_ai' and classifier_calls = 0 and full_ai_calls = 1 and total_upstream_calls = 1)
      or (resolution_path = 'classifier_to_capability' and classifier_calls = 1 and full_ai_calls = 0 and total_upstream_calls = 1)
      or (resolution_path in ('classifier_to_ai', 'classifier_failed_to_ai') and classifier_calls = 1 and full_ai_calls = 1 and total_upstream_calls = 2)
    ),
  constraint assistant_analytics_events_total_latency_check
    check (total_latency_ms between 0 and 600000),
  constraint assistant_analytics_events_classifier_latency_check
    check (
      (classifier_calls = 0 and classifier_latency_ms is null and classifier_intent is null and classifier_confidence_band is null)
      or (classifier_calls = 1 and classifier_latency_ms between 0 and 600000 and classifier_confidence_band is not null)
    ),
  constraint assistant_analytics_events_full_ai_latency_check
    check (
      (full_ai_calls = 0 and full_ai_latency_ms is null)
      or (full_ai_calls = 1 and full_ai_latency_ms between 0 and 600000)
    ),
  constraint assistant_analytics_events_housekeeping_type_check
    check (capability = 'housekeeping_request' or housekeeping_request_type is null),
  constraint assistant_analytics_events_privacy_path_check
    check (outcome <> 'privacy_blocked' or (assistant_route = 'deterministic' and resolution_path = 'deterministic'))
);

comment on table public.assistant_analytics_events is
  'Append-only LibGuest AI aggregate events. Contains no conversation, context, guest identifiers, URLs, or arbitrary metadata.';

create index assistant_analytics_events_hotel_occurred_idx
  on public.assistant_analytics_events (hotel_id, occurred_at desc);
create index assistant_analytics_events_occurred_idx
  on public.assistant_analytics_events (occurred_at);

alter table public.assistant_analytics_events enable row level security;
alter table public.assistant_analytics_events force row level security;
revoke all on table public.assistant_analytics_events from public, anon, authenticated, service_role;

create function public.record_assistant_analytics_event(
  p_schema_version smallint,
  p_occurred_at timestamptz,
  p_hotel_id uuid,
  p_language text,
  p_assistant_route text,
  p_resolution_path text,
  p_outcome text,
  p_capability text,
  p_housekeeping_request_type text,
  p_action_type text,
  p_tourism_source text,
  p_classifier_intent text,
  p_classifier_confidence_band text,
  p_classifier_calls smallint,
  p_full_ai_calls smallint,
  p_total_upstream_calls smallint,
  p_total_latency_ms integer,
  p_classifier_latency_ms integer,
  p_full_ai_latency_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if not exists (select 1 from public.hotels h where h.id = p_hotel_id) then
    raise exception using errcode = '22023', message = 'assistant_analytics_hotel_invalid';
  end if;

  insert into public.assistant_analytics_events (
    schema_version, occurred_at, hotel_id, language, assistant_route,
    resolution_path, outcome, capability, housekeeping_request_type,
    action_type, tourism_source, classifier_intent, classifier_confidence_band,
    classifier_calls, full_ai_calls, total_upstream_calls, total_latency_ms,
    classifier_latency_ms, full_ai_latency_ms
  ) values (
    p_schema_version, p_occurred_at, p_hotel_id, p_language, p_assistant_route,
    p_resolution_path, p_outcome, p_capability, p_housekeeping_request_type,
    p_action_type, p_tourism_source, p_classifier_intent, p_classifier_confidence_band,
    p_classifier_calls, p_full_ai_calls, p_total_upstream_calls, p_total_latency_ms,
    p_classifier_latency_ms, p_full_ai_latency_ms
  ) returning id into created_id;

  return created_id;
end;
$$;

create function public._build_assistant_analytics_summary(
  p_hotel_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected as (
    select e.*
    from public.assistant_analytics_events e
    where (p_hotel_id is null or e.hotel_id = p_hotel_id)
      and e.occurred_at >= p_from
      and e.occurred_at < p_to
  ), metrics as (
    select
      count(*)::bigint as total_handled,
      count(*) filter (where outcome not in ('privacy_blocked', 'rate_limited', 'hotel_unavailable'))::bigint as ai_eligible,
      count(*) filter (where total_upstream_calls = 0)::bigint as zero_upstream,
      count(*) filter (where classifier_calls = 1)::bigint as classifier_messages,
      count(*) filter (where full_ai_calls = 1)::bigint as full_ai_messages,
      count(*) filter (where total_upstream_calls = 2)::bigint as two_call_messages,
      count(*) filter (where resolution_path = 'classifier_to_capability')::bigint as classifier_to_capability,
      count(*) filter (where resolution_path = 'classifier_to_ai')::bigint as classifier_to_ai,
      count(*) filter (where resolution_path = 'classifier_failed_to_ai')::bigint as classifier_failures_to_ai,
      count(*) filter (where resolution_path = 'direct_ai')::bigint as direct_ai_messages,
      count(*) filter (where outcome = 'privacy_blocked')::bigint as privacy_blocked,
      count(*) filter (where outcome = 'rate_limited')::bigint as rate_limited,
      count(*) filter (where outcome = 'assistant_failed')::bigint as assistant_failures,
      coalesce(sum(classifier_calls), 0)::bigint as classifier_calls,
      coalesce(sum(full_ai_calls), 0)::bigint as full_ai_calls,
      coalesce(sum(total_upstream_calls), 0)::bigint as upstream_calls,
      count(*) filter (
        where outcome not in ('privacy_blocked', 'rate_limited', 'hotel_unavailable') and full_ai_calls = 0
      )::bigint as deflected,
      round(avg(total_latency_ms), 2) as average_latency,
      percentile_disc(0.95) within group (order by total_latency_ms) as p95_latency
    from selected
  )
  select jsonb_build_object(
    'totalHandledMessages', m.total_handled,
    'aiEligibleMessages', m.ai_eligible,
    'zeroUpstreamMessages', m.zero_upstream,
    'classifierMessages', m.classifier_messages,
    'fullAiMessages', m.full_ai_messages,
    'twoCallMessages', m.two_call_messages,
    'classifierToCapability', m.classifier_to_capability,
    'classifierToAi', m.classifier_to_ai,
    'classifierFailuresToAi', m.classifier_failures_to_ai,
    'directAiMessages', m.direct_ai_messages,
    'privacyBlockedMessages', m.privacy_blocked,
    'rateLimitedMessages', m.rate_limited,
    'assistantFailures', m.assistant_failures,
    'totalClassifierCalls', m.classifier_calls,
    'totalFullAiCalls', m.full_ai_calls,
    'totalUpstreamCalls', m.upstream_calls,
    'fullAiDeflectionRate', case when m.ai_eligible = 0 then null else m.deflected::numeric / m.ai_eligible end,
    'upstreamCallsAvoidedVsAllMaya', case when m.ai_eligible = 0 then null else m.ai_eligible - m.upstream_calls end,
    'upstreamCallReductionRate', case when m.ai_eligible = 0 then null else (m.ai_eligible - m.upstream_calls)::numeric / m.ai_eligible end,
    'averageLatencyMs', m.average_latency,
    'p95LatencyMs', m.p95_latency,
    'capabilities', jsonb_build_object(
      'human_handoff', (select count(*) from selected where capability = 'human_handoff'),
      'reception_contact', (select count(*) from selected where capability = 'reception_contact'),
      'housekeeping_contact', (select count(*) from selected where capability = 'housekeeping_contact'),
      'housekeeping_request', (select count(*) from selected where capability = 'housekeeping_request')
    ),
    'tourismSources', jsonb_build_object(
      'libguest_curated', (select count(*) from selected where tourism_source = 'libguest_curated'),
      'general_ai', (select count(*) from selected where tourism_source = 'general_ai'),
      'unavailable', (select count(*) from selected where tourism_source = 'unavailable')
    )
  )
  from metrics m;
$$;

create function public.get_hotel_assistant_analytics_summary(
  p_hotel_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception using errcode = '22023', message = 'assistant_analytics_period_invalid';
  end if;
  if not exists (select 1 from public.hotels h where h.id = p_hotel_id) then
    raise exception using errcode = '22023', message = 'assistant_analytics_hotel_invalid';
  end if;
  if auth.uid() is null or not public.has_active_hotel_role(p_hotel_id, 'visualizador') then
    raise exception using errcode = '42501', message = 'assistant_analytics_hotel_access_denied';
  end if;
  if not public.is_hotel_module_enabled(p_hotel_id, 'analytics.basic') then
    raise exception using errcode = '42501', message = 'analytics_basic_required';
  end if;
  return public._build_assistant_analytics_summary(p_hotel_id, p_from, p_to);
end;
$$;

create function public.get_platform_assistant_analytics_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_hotel_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception using errcode = '22023', message = 'assistant_analytics_period_invalid';
  end if;
  if not exists (
    select 1 from public.platform_users pu
    where pu.user_id = auth.uid() and pu.role = 'platform_admin' and pu.is_active
  ) then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;
  if p_hotel_id is not null and not exists (select 1 from public.hotels h where h.id = p_hotel_id) then
    raise exception using errcode = '22023', message = 'assistant_analytics_hotel_invalid';
  end if;
  return public._build_assistant_analytics_summary(p_hotel_id, p_from, p_to);
end;
$$;

create function public.purge_assistant_analytics_events(p_retention_days integer default 180)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed bigint;
begin
  if p_retention_days is null or p_retention_days < 30 or p_retention_days > 730 then
    raise exception using errcode = '22023', message = 'assistant_analytics_retention_invalid';
  end if;
  delete from public.assistant_analytics_events
  where occurred_at < now() - make_interval(days => p_retention_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.record_assistant_analytics_event(smallint,timestamptz,uuid,text,text,text,text,text,text,text,text,text,text,smallint,smallint,smallint,integer,integer,integer) from public, anon, authenticated, service_role;
revoke all on function public._build_assistant_analytics_summary(uuid,timestamptz,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.get_hotel_assistant_analytics_summary(uuid,timestamptz,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.get_platform_assistant_analytics_summary(timestamptz,timestamptz,uuid) from public, anon, authenticated, service_role;
revoke all on function public.purge_assistant_analytics_events(integer) from public, anon, authenticated, service_role;

grant execute on function public.record_assistant_analytics_event(smallint,timestamptz,uuid,text,text,text,text,text,text,text,text,text,text,smallint,smallint,smallint,integer,integer,integer) to service_role;
grant execute on function public.get_hotel_assistant_analytics_summary(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.get_platform_assistant_analytics_summary(timestamptz,timestamptz,uuid) to authenticated;
grant execute on function public.purge_assistant_analytics_events(integer) to service_role;

comment on function public.record_assistant_analytics_event(smallint,timestamptz,uuid,text,text,text,text,text,text,text,text,text,text,smallint,smallint,smallint,integer,integer,integer) is
  'Service-only allowlisted insertion surface for resolved AssistantAnalyticsEvent v1 records.';
comment on function public.purge_assistant_analytics_events(integer) is
  'Service-only retention mechanism; invoke from a separately monitored production job.';
