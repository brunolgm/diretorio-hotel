-- Initial, pre-migration application tables, reconstructed from the tracked types.
-- Local physical schema only: Auth/Storage are supplied by their actual services.
-- No replacement auth functions, mocked role helpers or production data.
do $$ begin
 if current_database()<>'fb_s53_auth' or to_regclass('public.hotels') is not null
 then raise exception 'Requires empty disposable fb_s53_auth'; end if;
end $$;
create table public.hotels(
 id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,
 city text,booking_url text,website_url text,instagram_url text,whatsapp_number text,
 wifi_name text,wifi_password text,breakfast_hours text,checkin_time text,checkout_time text,logo_url text,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,email text,full_name text,role text,
 hotel_id uuid references public.hotels(id),created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.hotel_sections(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete cascade,
 title text not null,icon text,content text,cta text,url text,category text,enabled boolean default true,sort_order integer default 0,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.hotel_departments(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete cascade,
 name text not null,description text,hours text,action text,url text,enabled boolean default true,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
create table public.hotel_policies(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete cascade,
 title text not null,description text,enabled boolean default true,
 created_at timestamptz default now(),updated_at timestamptz default now()
);
