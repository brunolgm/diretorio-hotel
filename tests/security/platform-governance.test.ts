import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  getAllowedPlatformHotelStatusTransitions,
  isAllowedPlatformHotelStatusTransition,
  normalizePlatformHotelBrand,
  normalizePlatformHotelStatus,
} from '../../lib/platform-governance.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read(
  'supabase',
  'migrations',
  '202608140002_46c_platform_hotel_governance.sql'
);

function functionBody(name: string) {
  return migration.match(new RegExp(`create(?: or replace)? function public\\.${name}[\\s\\S]+?\\n\\$\\$;`, 'i'))?.[0] || '';
}

test('defines a canonical lifecycle and conservative transition graph', () => {
  assert.equal(normalizePlatformHotelStatus(' ACTIVE '), 'active');
  assert.equal(normalizePlatformHotelStatus('disabled'), null);
  assert.deepEqual(getAllowedPlatformHotelStatusTransitions('draft'), ['active', 'archived']);
  assert.deepEqual(getAllowedPlatformHotelStatusTransitions('active'), ['suspended', 'archived']);
  assert.deepEqual(getAllowedPlatformHotelStatusTransitions('suspended'), ['active', 'archived']);
  assert.deepEqual(getAllowedPlatformHotelStatusTransitions('archived'), []);
  assert.equal(isAllowedPlatformHotelStatusTransition('suspended', 'active'), true);
  assert.equal(isAllowedPlatformHotelStatusTransition('archived', 'active'), false);
});

test('accepts only canonical brands while preserving null as unassigned', () => {
  assert.equal(normalizePlatformHotelBrand('mercure'), 'mercure');
  assert.equal(normalizePlatformHotelBrand(' GRAND-MERCURE '), 'grand-mercure');
  assert.equal(normalizePlatformHotelBrand(''), null);
  assert.equal(normalizePlatformHotelBrand('arbitrary-brand'), undefined);
});

test('46C preflight protects every new governance object', () => {
  assert.ok(migration.indexOf('do $$') < migration.indexOf('alter table public.hotels'));
  assert.match(migration, /attname = 'platform_status'/i);
  assert.match(migration, /to_regclass\('public\.platform_audit_log'\)/i);
  assert.match(migration, /known 46B RPC contracts drifted and must not be replaced/i);
  assert.match(migration, /pg_get_function_result\(p\.oid\)/i);
  assert.match(migration, /canonical hotels brand constraint is missing or drifted/i);
  for (const signature of [
    'get_platform_hotel_detail\\(uuid\\)',
    'update_platform_hotel_brand\\(uuid,text\\)',
    'update_platform_hotel_status\\(uuid,text\\)',
    'record_platform_audit_event\\(uuid,text,text,uuid,jsonb,text\\)',
  ]) {
    assert.match(migration, new RegExp(`to_regprocedure\\('public\\.${signature}'\\)`, 'i'));
  }
  const knownHelperReplacements = migration.match(/create or replace function public\.has_active_hotel_(?:path_)?role/gi) || [];
  assert.equal(knownHelperReplacements.length, 2);
  assert.doesNotMatch(
    migration.replace(/create or replace function public\.has_active_hotel_(?:path_)?role/gi, ''),
    /create or replace function/i
  );
});

test('adds explicit active-by-default lifecycle without inferring existing state', () => {
  const lifecycleDdl = migration.slice(
    migration.indexOf('alter table public.hotels'),
    migration.indexOf('create table public.platform_audit_log')
  );

  assert.match(migration, /add column platform_status text not null default 'active'/i);
  assert.match(
    migration,
    /check \(platform_status in \('draft', 'active', 'suspended', 'archived'\)\)/i
  );
  assert.doesNotMatch(lifecycleDdl, /update public\.hotels/i);
});

test('detail contract is minimal and self-authorized', () => {
  const detail = functionBody('get_platform_hotel_detail');
  for (const field of [
    'id', 'name', 'slug', 'subdomain', 'city', 'brand_code', 'theme_preset',
    'logo_url', 'hero_image_url', 'platform_status', 'created_at', 'updated_at',
  ]) assert.match(detail, new RegExp(`\\b${field}\\b`));

  assert.match(detail, /security definer[\s\S]*set search_path = ''/i);
  assert.match(detail, /pu\.user_id = auth\.uid\(\)[\s\S]*pu\.is_active = true[\s\S]*pu\.role = 'platform_admin'/i);
  assert.doesNotMatch(detail, /wifi|breakfast|checkin|checkout|whatsapp|profiles|room_links|analytics|notes/i);
});

test('governance mutations lock one hotel, change one field and audit atomically', () => {
  const brand = functionBody('update_platform_hotel_brand');
  const status = functionBody('update_platform_hotel_status');

  for (const body of [brand, status]) {
    assert.match(body, /security definer[\s\S]*set search_path = ''/i);
    assert.match(body, /for update/i);
    assert.match(body, /record_platform_audit_event/i);
    assert.match(body, /where h\.id = p_hotel_id/i);
    assert.doesNotMatch(body, /requireAdminAccess|getAdminHotel|execute\s|format\s*\(/i);
  }
  assert.match(brand, /set brand_code = p_brand_code,\s*updated_at = now\(\)/i);
  assert.match(brand, /current_status = 'archived'[\s\S]*platform_hotel_archived/i);
  assert.doesNotMatch(brand, /set[\s\S]{0,100}(slug|subdomain|wifi|theme_preset)\s*=/i);
  assert.match(status, /set platform_status = p_status,\s*updated_at = now\(\)/i);
  assert.match(status, /previous_status = 'draft'[\s\S]*previous_status = 'active'[\s\S]*previous_status = 'suspended'/i);
});

test('public lifecycle enforcement covers view and every guest content policy', () => {
  const publicData = read('lib', 'public-hotel-data.ts');
  const analyticsRoute = read('app', 'api', 'analytics', 'route.ts');
  assert.match(
    migration,
    /create view public\.public_hotels[\s\S]*from public\.hotels\s*where platform_status = 'active'/i
  );
  assert.match(migration, /create function public\.is_hotel_publicly_active\(target_hotel_id uuid\)/i);
  assert.match(
    migration,
    /grant execute on function public\.is_hotel_publicly_active\(uuid\)\s*to anon, authenticated/i
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete|all)[^;]*public\.hotels/i
  );
  assert.match(publicData, /\.from\('public_hotels'\)/);
  assert.match(analyticsRoute, /\.from\('public_hotels'\)/);

  for (const policy of [
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
  ]) {
    const body = migration.match(
      new RegExp(`create policy "${policy}"[\\s\\S]+?;`, 'i')
    )?.[0] || '';
    assert.match(body, /is_hotel_publicly_active/i, `${policy} must enforce active lifecycle`);
  }
});

test('archived blocks hotel-scoped RLS while draft and suspended remain operational', () => {
  for (const helper of ['has_active_hotel_role', 'has_active_hotel_path_role']) {
    const body = functionBody(helper);
    assert.match(body, /join public\.hotels h on h\.id = p\.hotel_id/i);
    assert.match(body, /h\.platform_status <> 'archived'/i);
    assert.doesNotMatch(body, /platform_status = 'active'/i);
  }

  const auth = read('lib', 'auth.ts');
  const login = read('app', 'login', 'page.tsx');
  const proxy = read('proxy.ts');
  assert.match(auth, /select\('id, platform_status'\)/);
  assert.match(auth, /hotelContext\.platform_status === 'archived'/);
  for (const boundary of [login, proxy]) {
    assert.match(boundary, /select\('id, platform_status'\)/);
    assert.match(boundary, /platform_status !== 'archived'/);
  }
});

test('room-token resolution cannot bypass non-active lifecycle', () => {
  const roomLinks = read('lib', 'room-links.ts');
  const route = read('app', 'r', '[roomToken]', 'route.ts');

  assert.equal((roomLinks.match(/hotels!inner\(platform_status\)/g) || []).length, 3);
  assert.equal((roomLinks.match(/\.eq\('hotels\.platform_status', 'active'\)/g) || []).length, 3);
  assert.match(roomLinks, /\.from\('hotels'\)[\s\S]*\.eq\('platform_status', 'active'\)/i);
  assert.doesNotMatch(route, /qr-invalido/);
  assert.equal((route.match(/\/experiencia-indisponivel/g) || []).length, 3);
});

test('public pages use one non-enumerating unavailable experience', () => {
  const unavailable = read('components', 'public', 'hotel-experience-unavailable.tsx');
  assert.match(unavailable, /Experiência indisponível/);
  assert.doesNotMatch(unavailable, /draft|suspended|archived|hotel não encontrado/i);

  for (const parts of [
    ['app', 'page.tsx'],
    ['app', 'hotel', '[slug]', 'page.tsx'],
    ['app', 'explorar', '[area]', 'page.tsx'],
    ['app', 'servicos', '[id]', 'page.tsx'],
    ['app', 'hotel', '[slug]', 'servicos', '[id]', 'page.tsx'],
  ]) assert.match(read(...parts), /HotelExperienceUnavailable/);
});

test('platform audit is separate, append-only and unavailable to application roles', () => {
  assert.match(migration, /create table public\.platform_audit_log/i);
  assert.doesNotMatch(migration, /platform_audit_log[\s\S]{0,300}references/i);
  assert.match(migration, /alter table public\.platform_audit_log enable row level security/i);
  assert.match(migration, /revoke all on table public\.platform_audit_log from public, anon, authenticated, service_role/i);
  assert.match(migration, /revoke all on function public\.record_platform_audit_event[\s\S]*from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.record_platform_audit_event/i);
  assert.match(migration, /octet_length\(metadata::text\) <= 2048/i);
  assert.match(migration, /hotel\.brand_updated[\s\S]*hotel\.status_updated/i);
});

test('46C grants only narrow RPC execution and never broadens hotels RLS or DML', () => {
  assert.doesNotMatch(migration, /create policy[\s\S]*on public\.hotels/i);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[^;]*public\.hotels/i);
  for (const signature of [
    'get_platform_hotel_detail\\(uuid\\)',
    'update_platform_hotel_brand\\(uuid, text\\)',
    'update_platform_hotel_status\\(uuid, text\\)',
  ]) assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated`, 'i'));
});

test('platform UI and actions stay independent from hotel admin context', () => {
  const page = read('app', 'platform', 'hoteis', '[id]', 'page.tsx');
  const actions = read('app', 'platform', 'hoteis', '[id]', 'actions.ts');
  const queries = read('lib', 'platform-queries.ts');

  assert.match(page, /Identidade da plataforma/);
  assert.match(page, /Lifecycle/);
  assert.match(page, /AdminConfirmAction/);
  assert.match(actions, /requirePlatformAccess\(\)/);
  assert.match(actions, /rpc\('update_platform_hotel_brand'/);
  assert.match(actions, /rpc\('update_platform_hotel_status'/);
  assert.match(queries, /rpc\('get_platform_hotel_detail'/);
  assert.doesNotMatch(`${page}\n${actions}\n${queries}`, /requireAdminAccess|getAdminHotel|createAdminClient|service_role|\.from\(['"]hotels['"]\)/i);
});
