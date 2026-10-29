-- Optional V3/V4 selector in the existing presentation. No table, seed, tenant or entitlement writes.
-- Existing RPC retains authorization, revision, row lock, audit and grants. Missing selector remains V3.
begin;
create or replace function public.valid_public_presentation(v jsonb, tenant uuid) returns boolean
language plpgsql immutable set search_path='' as $$
declare b jsonb; c jsonb; n jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or v->'version'<>'1'::jsonb
   or coalesce(v->>'heroTitleMode','') not in('media_title','hotel_name')
   or exists(select 1 from jsonb_object_keys(v) k where k not in('version','experienceVersion','heroTitleMode','heroDesktopFocal','benefits','tourism'))
   or not(v ?& array['version','heroTitleMode','heroDesktopFocal','benefits','tourism']) then return false; end if;
 if v ? 'experienceVersion' and (jsonb_typeof(v->'experienceVersion') is distinct from 'string' or v->>'experienceVersion' not in('v3','v4')) then return false; end if;
 if v->'heroDesktopFocal'<>'null'::jsonb then
  c:=v->'heroDesktopFocal';
  if jsonb_typeof(c)<>'object' or not(c ?& array['x','y']) or exists(select 1 from jsonb_object_keys(c) k where k not in('x','y')) then return false; end if;
  foreach b in array array[c->'x',c->'y'] loop
   if jsonb_typeof(b)<>'number' then return false; end if;
   if (b#>>'{}')::numeric not between 0 and 100 then return false; end if;
  end loop;
 end if;
 if jsonb_typeof(v->'benefits')<>'array' then return false; end if;
 if jsonb_array_length(v->'benefits')>8 then return false; end if;
 for b in select value from jsonb_array_elements(v->'benefits') loop
  if jsonb_typeof(b)<>'object' then return false; end if;
  if coalesce(b->>'icon','') not in('location','bed','pool','fitness') or not public.valid_editorial_text(b->'label',120)
    or coalesce(btrim(b->'label'->>'pt'),'')='' or exists(select 1 from jsonb_object_keys(b) k where k not in('icon','label')) then return false; end if;
 end loop;
 c:=v->'tourism';
 if jsonb_typeof(c)<>'object' then return false; end if;
 if not public.valid_editorial_text(c->'title',160) or not public.valid_editorial_text(c->'description',600)
   or exists(select 1 from jsonb_object_keys(c) k where k not in('title','description','cards')) or jsonb_typeof(c->'cards') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'cards')>16 then return false; end if;
 for b in select value from jsonb_array_elements(c->'cards') loop
  if jsonb_typeof(b)<>'object' then return false; end if;
  if not public.valid_editorial_text(b->'title',120) or coalesce(btrim(b->'title'->>'pt'),'')=''
   or not(b ? 'image_path') or exists(select 1 from jsonb_object_keys(b) k where k not in('title','image_path')) then return false; end if;
  n:=b->'image_path';
  if n<>'null'::jsonb and (jsonb_typeof(n)<>'string' or not ((n#>>'{}') ~ ('^'||tenant::text||'/hero/editorial/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))) then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.valid_public_presentation(jsonb,uuid) from public,anon,authenticated,service_role;

commit;
