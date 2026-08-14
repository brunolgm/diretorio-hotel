-- Sprint 46A: isolated platform identity and authorization foundation.
-- Provisioning is intentionally restricted to a controlled database-owner operation.

do $$
begin
  if to_regclass('public.platform_users') is not null then
    raise exception '46A preflight failed: public.platform_users already exists and must be reviewed';
  end if;

  if to_regprocedure('public.get_current_platform_access()') is not null then
    raise exception '46A preflight failed: public.get_current_platform_access() already exists and must be reviewed';
  end if;

  if to_regclass('auth.users') is null then
    raise exception '46A preflight failed: auth.users is missing';
  end if;
end;
$$;

create table public.platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_users_role_check
    check (role in ('platform_admin'))
);

alter table public.platform_users enable row level security;

-- No table policy is intentional. Browser roles cannot enumerate or mutate platform identities.
revoke all on table public.platform_users from public, anon, authenticated, service_role;

create function public.get_current_platform_access()
returns table (
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select pu.role, pu.is_active
  from public.platform_users pu
  where pu.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_current_platform_access()
  from public, anon, authenticated, service_role;
grant execute on function public.get_current_platform_access()
  to authenticated;

comment on table public.platform_users is
  'Platform-global identities, independent from hotel-scoped profiles. Provisioning is administrative only.';
comment on function public.get_current_platform_access() is
  'Returns only the current authenticated user platform role and activity; does not expose the platform directory.';
