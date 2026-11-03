-- ONLY an empty disposable database named fb_s53. This is not a migration.
do $$ begin if current_database()<>'fb_s53' or to_regclass('public.hotels') is not null then raise exception '53 local bootstrap requires empty fb_s53'; end if; end $$;
create table public.hotels(id uuid primary key,name text not null,platform_status text not null default 'active');
create table public.profiles(id uuid primary key,hotel_id uuid references public.hotels(id),role text,is_active boolean not null default true);
create table public.hotel_module_entitlements(hotel_id uuid references public.hotels(id),module_key text,is_enabled boolean,enabled_at timestamptz,enabled_by uuid,disabled_at timestamptz,disabled_by uuid,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(hotel_id,module_key));
create table public.platform_users(user_id uuid primary key,role text,is_active boolean);
create table public.platform_audit_log(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),actor_user_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb,request_id text);
create table public.hotel_sections(id uuid primary key,hotel_id uuid references public.hotels(id),title text,content text,url text,service_action_type text,enabled boolean);
-- Canonical pre-Sprint-53 composite key from the unchanged service_room_guides migration.
alter table public.hotel_sections add constraint hotel_sections_id_hotel_id_key unique(id,hotel_id);
-- Minimal managed Storage contract: structural grants, RLS, no hotel-assets browser policy.
create schema if not exists storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default clock_timestamp(),metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
-- Canonical role helper is appended by the local runner from migration 45B.
create function public.is_hotel_module_enabled(p_hotel_id uuid,p_module_key text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hotel_module_entitlements where hotel_id=p_hotel_id and module_key=p_module_key and is_enabled);
$$;
revoke all on function public.is_hotel_module_enabled(uuid,text) from public;
grant execute on function public.is_hotel_module_enabled(uuid,text) to anon,authenticated,service_role;
