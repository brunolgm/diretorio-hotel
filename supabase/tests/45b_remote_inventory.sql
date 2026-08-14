-- READ-ONLY inventory for a preview/clone. Do not run against production without approval.
-- Export the result and compare it with docs/SPRINT_45B_RLS_GOVERNANCE.md before applying migrations.

select n.nspname as schemaname,
       c.relname,
       c.relkind,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'public_hotels';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = any (array[
  'hotels', 'profiles', 'hotel_sections', 'hotel_departments', 'hotel_policies',
  'hotel_section_translations', 'hotel_department_translations', 'hotel_policy_translations',
  'hotel_announcements', 'hotel_announcement_translations',
  'hotel_promotional_banners', 'hotel_promotional_banner_translations',
  'hotel_analytics_events', 'hotel_room_links', 'admin_audit_log'
])) or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select n.nspname as schemaname, c.relname as tablename,
       c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relname = any (array[
    'hotels', 'profiles', 'hotel_sections', 'hotel_departments', 'hotel_policies',
    'hotel_section_translations', 'hotel_department_translations', 'hotel_policy_translations',
    'hotel_announcements', 'hotel_announcement_translations',
    'hotel_promotional_banners', 'hotel_promotional_banner_translations',
    'hotel_analytics_events', 'hotel_room_links', 'admin_audit_log', 'objects'
  ])
order by n.nspname, c.relname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated', 'service_role')
  and table_schema in ('public', 'storage')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where grantee in ('anon', 'authenticated', 'service_role')
  and table_schema in ('public', 'storage')
order by table_schema, table_name, column_name, grantee, privilege_type;

select n.nspname as function_schema, p.proname, p.prosecdef, p.proconfig,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, identity_arguments;

select p.proname,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       access_role.role_name,
       case
         when access_role.role_name = 'public' then exists (
           select 1
           from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
           where acl.grantee = 0
             and acl.privilege_type = 'EXECUTE'
         )
         else has_function_privilege(access_role.role_name, p.oid, 'EXECUTE')
       end as has_execute,
       p.proname in (
         'has_active_hotel_role',
         'has_active_hotel_path_role',
         'record_admin_audit_event',
         'admin_update_hotel_user'
       ) as is_45b_function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values
  ('public'),
  ('anon'),
  ('authenticated'),
  ('service_role')
) as access_role(role_name)
where n.nspname = 'public'
order by is_45b_function desc, p.proname, identity_arguments, access_role.role_name;

select count(*) as total_room_links,
       count(*) filter (where room_token ~ '^[A-Za-z0-9_-]{24}$') as compatible_room_tokens,
       count(*) filter (where room_token !~ '^[A-Za-z0-9_-]{24}$') as incompatible_room_tokens
from public.hotel_room_links;

select n.nspname as table_schema,
       c.relname as table_name,
       con.conname as constraint_name,
       con.contype as constraint_type,
       con.convalidated as is_validated,
       con.condeferrable as is_deferrable,
       con.condeferred as is_initially_deferred,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('hotel_room_links', 'admin_audit_log')
order by c.relname, con.conname;

select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'hotel-assets';

select required_privilege.privilege_type,
       has_table_privilege(
         'service_role',
         'storage.objects',
         required_privilege.privilege_type
       ) as service_role_has_privilege
from (values
  ('SELECT'),
  ('INSERT'),
  ('UPDATE'),
  ('DELETE')
) as required_privilege(privilege_type)
order by required_privilege.privilege_type;
