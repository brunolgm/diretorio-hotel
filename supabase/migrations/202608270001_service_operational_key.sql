do $$
begin
  if to_regclass('public.hotel_sections') is null then
    raise exception '52 operational key preflight: hotel_sections is missing';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hotel_sections'
      and column_name = 'operational_key'
  ) then
    raise exception '52 operational key preflight: operational_key already exists';
  end if;
end
$$;

alter table public.hotel_sections
  add column operational_key text null;

alter table public.hotel_sections
  add constraint hotel_sections_operational_key_check
  check (operational_key is null or operational_key in ('breakfast'));

create unique index hotel_sections_hotel_operational_key_unique
  on public.hotel_sections(hotel_id, operational_key)
  where operational_key is not null;

grant insert (operational_key) on table public.hotel_sections to authenticated;
grant update (operational_key) on table public.hotel_sections to authenticated;

create function public.enforce_hotel_section_operational_key_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  operational_key_changed boolean;
begin
  operational_key_changed := case
    when tg_op = 'INSERT' then new.operational_key is not null
    else new.operational_key is distinct from old.operational_key
  end;

  if current_user = 'authenticated'
    and operational_key_changed
    and not public.has_active_hotel_role(new.hotel_id, 'editor') then
    raise insufficient_privilege
      using message = 'editor role required to change service operational function';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_hotel_section_operational_key_editor()
  from public, anon, authenticated, service_role;

create trigger hotel_sections_operational_key_editor_guard
before insert or update of operational_key on public.hotel_sections
for each row execute function public.enforce_hotel_section_operational_key_editor();

comment on column public.hotel_sections.operational_key is
  'Non-translatable semantic link to a canonical hotel operational field. Initial catalog: breakfast.';
