alter table public.profiles
  add column is_active boolean not null default true;
