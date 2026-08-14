-- Sprint 46B: narrow read-only platform dashboard and hotel directory contracts.
-- No policy or grant on public.hotels is introduced by this migration.

do $$
begin
  if to_regprocedure('public.get_platform_hotel_metrics()') is not null then
    raise exception '46B preflight failed: public.get_platform_hotel_metrics() already exists and must be reviewed';
  end if;

  if to_regprocedure('public.list_platform_hotels(text,integer,integer)') is not null then
    raise exception '46B preflight failed: public.list_platform_hotels(text,integer,integer) already exists and must be reviewed';
  end if;

  if to_regclass('public.platform_users') is null
    or to_regclass('public.hotels') is null
  then
    raise exception '46B preflight failed: required 46A/platform hotel objects are missing';
  end if;
end;
$$;

create function public.get_platform_hotel_metrics()
returns table (
  total_hotels bigint,
  hotels_by_brand jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active = true
      and pu.role = 'platform_admin'
  ) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;

  return query
  select
    (select count(*) from public.hotels),
    coalesce(
      (
        select jsonb_object_agg(grouped.brand_key, grouped.hotel_count order by grouped.brand_key)
        from (
          select
            coalesce(nullif(pg_catalog.btrim(h.brand_code), ''), 'unassigned') as brand_key,
            count(*) as hotel_count
          from public.hotels h
          group by coalesce(nullif(pg_catalog.btrim(h.brand_code), ''), 'unassigned')
        ) grouped
      ),
      '{}'::jsonb
    );
end;
$$;

create function public.list_platform_hotels(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  total_count bigint,
  id uuid,
  name text,
  slug text,
  subdomain text,
  city text,
  brand_code text,
  theme_preset text,
  logo_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(pg_catalog.btrim(p_search), '');
  escaped_search text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active = true
      and pu.role = 'platform_admin'
  ) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;

  if p_page is null or p_page < 1 or p_page > 100000 then
    raise exception using errcode = '22023', message = 'platform_directory_page_invalid';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 50 then
    raise exception using errcode = '22023', message = 'platform_directory_page_size_invalid';
  end if;

  if normalized_search is not null and length(normalized_search) > 100 then
    raise exception using errcode = '22023', message = 'platform_directory_search_too_long';
  end if;

  escaped_search := replace(
    replace(
      replace(normalized_search, E'\\', E'\\\\'),
      '%',
      E'\\%'
    ),
    '_',
    E'\\_'
  );

  return query
  with filtered_hotels as (
    select
      h.id,
      h.name,
      h.slug,
      h.subdomain,
      h.city,
      h.brand_code,
      h.theme_preset,
      h.logo_url
    from public.hotels h
    where normalized_search is null
      or h.name ilike '%' || escaped_search || '%' escape E'\\'
      or h.slug ilike '%' || escaped_search || '%' escape E'\\'
      or coalesce(h.subdomain, '') ilike '%' || escaped_search || '%' escape E'\\'
      or coalesce(h.city, '') ilike '%' || escaped_search || '%' escape E'\\'
  )
  select
    count(*) over() as total_count,
    fh.id,
    fh.name,
    fh.slug,
    fh.subdomain,
    fh.city,
    fh.brand_code,
    fh.theme_preset,
    fh.logo_url
  from filtered_hotels fh
  order by lower(fh.name), fh.id
  limit p_page_size
  offset ((p_page::bigint - 1) * p_page_size::bigint);
end;
$$;

revoke all on function public.get_platform_hotel_metrics()
  from public, anon, authenticated, service_role;
grant execute on function public.get_platform_hotel_metrics()
  to authenticated;

revoke all on function public.list_platform_hotels(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_platform_hotels(text, integer, integer)
  to authenticated;

comment on function public.get_platform_hotel_metrics() is
  '46B read-only global totals. Self-authorizes an active platform_admin and exposes only total and brand distribution.';
comment on function public.list_platform_hotels(text, integer, integer) is
  '46B paginated read-only hotel directory. Self-authorizes an active platform_admin; no operational credentials or child data are returned.';
