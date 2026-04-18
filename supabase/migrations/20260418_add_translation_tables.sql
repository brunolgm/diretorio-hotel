create table public.hotel_section_translations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.hotel_sections(id) on delete cascade,
  language text not null,
  title text,
  content text,
  cta text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_section_translations_language_check
    check (language in ('en', 'es')),
  constraint hotel_section_translations_unique_section_language
    unique (section_id, language)
);

create index hotel_section_translations_section_id_idx
  on public.hotel_section_translations(section_id);

create index hotel_section_translations_language_idx
  on public.hotel_section_translations(language);

create table public.hotel_department_translations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.hotel_departments(id) on delete cascade,
  language text not null,
  name text,
  description text,
  action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_department_translations_language_check
    check (language in ('en', 'es')),
  constraint hotel_department_translations_unique_department_language
    unique (department_id, language)
);

create index hotel_department_translations_department_id_idx
  on public.hotel_department_translations(department_id);

create index hotel_department_translations_language_idx
  on public.hotel_department_translations(language);

create table public.hotel_policy_translations (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.hotel_policies(id) on delete cascade,
  language text not null,
  title text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_policy_translations_language_check
    check (language in ('en', 'es')),
  constraint hotel_policy_translations_unique_policy_language
    unique (policy_id, language)
);

create index hotel_policy_translations_policy_id_idx
  on public.hotel_policy_translations(policy_id);

create index hotel_policy_translations_language_idx
  on public.hotel_policy_translations(language);
