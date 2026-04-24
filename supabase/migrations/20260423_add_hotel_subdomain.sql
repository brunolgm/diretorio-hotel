alter table public.hotels
  add column subdomain text null;

alter table public.hotels
  add constraint hotels_subdomain_format_check
  check (
    subdomain is null
    or (
      subdomain = lower(subdomain)
      and subdomain ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$'
    )
  );

alter table public.hotels
  add constraint hotels_subdomain_reserved_check
  check (
    subdomain is null
    or subdomain not in ('www', 'app', 'admin', 'api', 'guestdesk')
  );

create unique index hotels_subdomain_unique_idx
  on public.hotels (subdomain)
  where subdomain is not null;
