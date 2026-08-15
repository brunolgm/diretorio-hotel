import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = (name: string) =>
  readFileSync(join(root, 'supabase', 'migrations', name), 'utf8');

test('RLS baseline centralizes active hotel and role checks', () => {
  const sql = migration('202608110001_45b_authz_helpers_and_rls_baseline.sql');
  const preflightIndex = sql.indexOf('do $$');
  const helperIndex = sql.indexOf('create function public.has_active_hotel_role');
  assert.ok(preflightIndex >= 0 && helperIndex > preflightIndex, 'preflight must precede helper creation');
  assert.match(sql, /to_regprocedure\('public\.has_active_hotel_role\(uuid,text\)'\)/i);
  assert.match(sql, /to_regprocedure\('public\.has_active_hotel_path_role\(text,text\)'\)/i);
  assert.doesNotMatch(sql, /create or replace function public\.has_active_hotel_(?:path_)?role/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /45b_operator_manage_sections/);
  assert.match(sql, /'hotel_select_by_profile'/);
  assert.match(sql, /drop policy if exists "hotel_update_by_profile" on public\.hotels/i);
  assert.match(sql, /drop policy if exists "profile_update_own" on public\.profiles/i);
  assert.match(sql, /drop policy if exists "sections_all_by_profile" on public\.hotel_sections/i);
  assert.match(sql, /drop policy if exists "authenticated can delete own hotel_section_translations" on public\.hotel_section_translations/i);
  assert.doesNotMatch(sql, /45b_editor_update_own_hotel/);
  assert.match(sql, /unexpected remote policies/i);
});

test('public hotels use an explicit view and browser roles cannot update the base table', () => {
  const sql = migration('202608110001_45b_authz_helpers_and_rls_baseline.sql');
  const view = sql.match(/create view public\.public_hotels[\s\S]+?from public\.hotels;/i)?.[0] || '';

  assert.match(view, /wifi_password/);
  assert.match(view, /brand_code/);
  assert.doesNotMatch(view, /created_at|updated_at/);
  assert.match(sql, /grant select on table public\.public_hotels to anon, authenticated/i);
  assert.doesNotMatch(sql, /45b_public_read_hotels/);
  assert.doesNotMatch(sql, /45b_editor_update_own_hotel/);
  assert.doesNotMatch(
    sql,
    /grant\s+update(?:\s*\([^;]+\))?\s+on table public\.hotels\s+to authenticated/i
  );
  assert.doesNotMatch(
    sql,
    /grant\s+update(?:\s*\([^;]+\))?\s+on table public\.profiles\s+to authenticated/i
  );

  const hotelActions = readFileSync(join(root, 'app', 'admin', 'hotel', 'actions.ts'), 'utf8');
  assert.match(hotelActions, /const adminSupabase = createAdminClient\(\)/);
  assert.match(hotelActions, /adminSupabase[\s\S]{0,100}\.from\('hotels'\)[\s\S]{0,100}\.update\(/);
});

test('genuinely public content remains readable to anon and authenticated', () => {
  const sql = migration('202608110001_45b_authz_helpers_and_rls_baseline.sql');
  const publicPolicies = [
    '45b_public_read_enabled_sections',
    '45b_public_read_enabled_departments',
    '45b_public_read_enabled_policies',
    '45b_public_read_section_translations',
    '45b_public_read_department_translations',
    '45b_public_read_policy_translations',
    '45b_public_read_active_announcements',
    '45b_public_read_announcement_translations',
    '45b_public_read_active_banners',
    '45b_public_read_banner_translations',
  ];

  for (const policy of publicPolicies) {
    const declaration = sql.match(
      new RegExp(`create policy "${policy}"[\\s\\S]{0,120}to anon, authenticated`, 'i')
    );
    assert.ok(declaration, `${policy} must apply to anon and authenticated`);
  }
});

test('updated_at grants match the timestamps explicitly sent by current actions', () => {
  const sql = migration('202608110001_45b_authz_helpers_and_rls_baseline.sql');
  assert.doesNotMatch(sql, /public\.hotel_sections[^;]*updated_at/i);
  assert.doesNotMatch(sql, /public\.hotel_departments[^;]*updated_at/i);
  assert.doesNotMatch(sql, /public\.hotel_policies[^;]*updated_at/i);
  assert.match(sql, /grant update \([^;]*updated_at[^;]*public\.hotel_announcements/i);
  assert.match(sql, /grant update \([^;]*updated_at[^;]*public\.hotel_promotional_banners/i);
  assert.match(sql, /grant (?:insert|update) \([^;]*updated_at[^;]*hotel_.*_translations/i);
});

test('authenticated content DML is column-scoped and cannot rewrite hotel ownership', () => {
  const sql = migration('202608110001_45b_authz_helpers_and_rls_baseline.sql');
  assert.match(sql, /grant insert \(\s*hotel_id, title, icon[\s\S]+?public\.hotel_sections/i);
  assert.match(sql, /grant update \(\s*title, icon[\s\S]+?public\.hotel_sections/i);
  assert.doesNotMatch(sql, /grant update \([^;]*hotel_id[^;]*\)\s+on table public\.hotel_sections/i);
  assert.doesNotMatch(sql, /grant delete on table public\.hotel_.*_translations/i);
});

test('analytics direct insert is revoked while service-role insertion remains', () => {
  const sql = migration('202608110002_45b_close_direct_analytics_insert.sql');
  assert.match(sql, /'Allow constrained public analytics inserts'/);
  assert.match(sql, /drop policy if exists "Allow constrained public analytics inserts"/i);
  assert.match(sql, /revoke all on table public\.hotel_analytics_events from anon, authenticated/i);
  assert.match(sql, /grant insert on table public\.hotel_analytics_events to service_role/i);
  assert.doesNotMatch(sql, /with check \(true\)/i);

  const route = readFileSync(join(root, 'app', 'api', 'analytics', 'route.ts'), 'utf8');
  assert.match(route, /createAdminClient\(\)/);
});

test('last-admin RPC validates actor and serializes updates per hotel', () => {
  const sql = migration('202608110004_45b_last_admin_rpc.sql');
  assert.match(sql, /to_regprocedure\('public\.admin_update_hotel_user\(uuid,text,text,text,boolean\)'\)/i);
  assert.ok(
    sql.indexOf('do $$') < sql.indexOf('create function public.admin_update_hotel_user'),
    'preflight must precede RPC creation'
  );
  assert.doesNotMatch(sql, /create or replace function public\.admin_update_hotel_user/i);
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /target_profile\.id = actor_profile\.id/);
  assert.match(sql, /cannot_remove_own_administrator_access/);
  assert.match(sql, /active_admin_count < 1/);
  assert.match(sql, /last_active_administrator_required/);
  assert.match(sql, /record_admin_audit_event/);
  assert.match(sql, /'previous_role', target_profile\.role/);
  assert.match(sql, /'new_role', p_role/);
  assert.match(sql, /'previous_status', target_profile\.is_active/);
  assert.match(sql, /'new_status', p_is_active/);
  assert.doesNotMatch(sql, /changed_fields|jsonb_build_array/i);
});

test('audit log is append-only for browser roles and writer is server-only', () => {
  const sql = migration('202608110003_45b_admin_audit_log.sql');
  assert.match(sql, /revoke all on table public\.admin_audit_log from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.admin_audit_log to authenticated/i);
  assert.doesNotMatch(sql, /grant (?:select|insert)[^;]*admin_audit_log[^;]*service_role/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.record_admin_audit_event[\s\S]*to service_role/i);
  assert.match(sql, /octet_length\(metadata::text\) <= 2048/);
  assert.match(sql, /jsonb_path_exists[\s\S]*@\.type\(\) == "object"[\s\S]*@\.type\(\) == "array"/i);
  assert.match(sql, /like_regex "\^\(password\|senha\|roomtoken\|room_token\|token\|jwt\|service_role\|payload\|cookie\|authorization\)\$" flag "i"/i);
  assert.match(sql, /to_regclass\('public\.admin_audit_log'\)/i);
  assert.match(sql, /to_regprocedure\([\s\S]*record_admin_audit_event/i);
  assert.doesNotMatch(sql, /create or replace function public\.record_admin_audit_event/i);
});

test('Storage is server-only while room-link policies enforce hotel-first paths', () => {
  const storage = migration('202608110005_45b_storage_policies.sql');
  const legacyStoragePolicies = [
    'Allow authenticated uploads to hotel-assets',
    'Allow authenticated updates in hotel-assets',
    'Hotel users can upload promotional banners',
    'Hotel users can update promotional banners',
    'Hotel users can delete promotional banners',
    'Hotel users can upload promotional banners in hotel folder',
    'Hotel users can update promotional banners in hotel folder',
    'Hotel users can delete promotional banners in hotel folder',
  ];

  for (const policy of legacyStoragePolicies) {
    assert.ok(
      storage.includes(`drop policy if exists "${policy}" on storage.objects;`),
      `${policy} must be removed explicitly`
    );
  }

  assert.doesNotMatch(storage, /create policy[\s\S]*on storage\.objects/i);
  assert.doesNotMatch(
    storage,
    /\bgrant\b[\s\S]{0,160}on (?:table )?storage\.objects[\s\S]{0,80}to (?:public|anon|authenticated)/i
  );
  assert.doesNotMatch(
    storage,
    /revoke select, insert, update, delete on table storage\.objects/i
  );
  assert.match(storage, /policies that may reach hotel-assets/);
  assert.match(storage, /bucket_id\[\[:space:\]\]\*=\[\[:space:\]\]\*/);
  assert.match(storage, /<hotel_id>\/logo\.\*/);
  assert.match(storage, /<hotel_id>\/hero\.\*/);
  assert.doesNotMatch(storage, /\)::uuid/);

  const rooms = migration('202608110006_45b_room_links_rls.sql');
  assert.match(rooms, /create policy "45b_editor_read_room_links"[\s\S]*for select[\s\S]*has_active_hotel_role\(hotel_id, 'editor'\)/i);
  assert.match(rooms, /create policy "45b_editor_insert_room_links"[\s\S]*for insert[\s\S]*has_active_hotel_role\(hotel_id, 'editor'\)/i);
  assert.match(rooms, /create policy "45b_editor_update_room_links"[\s\S]*for update[\s\S]*has_active_hotel_role\(hotel_id, 'editor'\)/i);
  assert.doesNotMatch(rooms, /create policy[\s\S]{0,100}for (?:all|delete)/i);
  assert.match(rooms, /grant select, insert, update on table public\.hotel_room_links to authenticated/i);
  assert.match(rooms, /grant select on table public\.hotel_room_links to service_role/i);
  assert.doesNotMatch(rooms, /grant[^;]*delete[^;]*hotel_room_links/i);
  assert.match(rooms, /where room_token !~ '\^\[A-Za-z0-9_-\]\{24\}\$'/);
  assert.match(rooms, /constraint hotel_room_links_room_token_base64url_24_check[\s\S]*room_token ~ '\^\[A-Za-z0-9_-\]\{24\}\$'/);
  assert.doesNotMatch(rooms, /to anon/);
  assert.doesNotMatch(rooms, /\)::uuid/);

  const page = readFileSync(join(root, 'app', 'admin', 'apartamentos', 'page.tsx'), 'utf8');
  assert.match(page, /requireAdminAccess\('editor'\)/);

  const navigation = readFileSync(join(root, 'lib', 'admin-navigation.ts'), 'utf8');
  assert.match(
    navigation,
    /href: '\/admin\/apartamentos'[\s\S]*?requiredRole: 'editor'/
  );

  const actions = readFileSync(join(root, 'app', 'admin', 'apartamentos', 'actions.ts'), 'utf8');
  const qrActionIndex = actions.indexOf("action: 'room.qr_regenerated'");
  const qrAuditStart = actions.lastIndexOf('await recordAdminAuditEvent({', qrActionIndex);
  const qrAuditEnd = actions.indexOf('});', qrActionIndex) + 3;
  const qrAudit = actions.slice(qrAuditStart, qrAuditEnd);
  assert.match(qrAudit, /metadata: \{\}/);
  assert.doesNotMatch(qrAudit, /room_token|roomToken|changed_fields|\[/);
  assert.doesNotMatch(actions, /\.delete\(\)/);
});

test('platform identity is private and does not grant global hotel access', () => {
  const sql = migration('202608130001_46a_platform_identity_authorization.sql');
  const preflightIndex = sql.indexOf('do $$');
  const tableIndex = sql.indexOf('create table public.platform_users');
  const functionIndex = sql.indexOf('create function public.get_current_platform_access()');

  assert.ok(preflightIndex >= 0 && tableIndex > preflightIndex, 'preflight must precede table creation');
  assert.ok(functionIndex > tableIndex, 'the narrow RPC must be created after the private table');
  assert.match(sql, /to_regclass\('public\.platform_users'\)/i);
  assert.match(sql, /to_regprocedure\('public\.get_current_platform_access\(\)'\)/i);
  assert.doesNotMatch(sql, /create or replace/i);
  assert.match(sql, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /role text not null/i);
  assert.match(sql, /is_active boolean not null default true/i);
  assert.match(sql, /check \(role in \('platform_admin'\)\)/i);
  assert.doesNotMatch(sql, /hotel_id/i);
  assert.match(sql, /alter table public\.platform_users enable row level security/i);
  assert.match(
    sql,
    /revoke all on table public\.platform_users from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(sql, /create policy[\s\S]*platform_users/i);
  assert.match(sql, /where pu\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    sql,
    /grant execute on function public\.get_current_platform_access\(\)[\s\S]*to authenticated/i
  );
  assert.doesNotMatch(
    sql,
    /grant (?:select|insert|update|delete|all)[^;]*platform_users[^;]*to (?:anon|authenticated)/i
  );
  assert.doesNotMatch(sql, /public\.hotels|from\s+hotels|on\s+hotels/i);
});
