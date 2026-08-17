import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  getHotelReadinessNextSteps,
  HOTEL_READINESS_CHECK_CATALOG,
  normalizeHotelReadiness,
  type HotelReadinessRpcRow,
} from '../../lib/hotel-readiness.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

function row(checkKey: string, severity: string, passed: boolean): HotelReadinessRpcRow {
  return { hotel_id: '48000000-0000-4000-8000-000000000001', platform_status: 'draft', ready_to_activate: false, blocking_count: 0, warning_count: 0, check_key: checkKey, severity, passed };
}

test('defines one fixed 19-check readiness catalog with six blockers', () => {
  assert.equal(HOTEL_READINESS_CHECK_CATALOG.length, 19);
  assert.equal(new Set(HOTEL_READINESS_CHECK_CATALOG.map(({ key }) => key)).size, 19);
  assert.deepEqual(HOTEL_READINESS_CHECK_CATALOG.filter(({ severity }) => severity === 'blocking').map(({ key }) => key), [
    'identity.name', 'identity.city', 'identity.slug', 'identity.subdomain', 'admin.active', 'module.core_directory',
  ]);
  assert.equal(HOTEL_READINESS_CHECK_CATALOG.filter(({ severity }) => severity === 'warning').length, 13);
});

test('derives activation only from blockers while warnings remain visible', () => {
  const readiness = normalizeHotelReadiness([
    row('identity.name', 'blocking', true),
    row('identity.city', 'blocking', true),
    row('identity.slug', 'blocking', true),
    row('identity.subdomain', 'blocking', true),
    row('admin.active', 'blocking', true),
    row('module.core_directory', 'blocking', true),
    row('visual.logo', 'warning', false),
  ]);
  assert.ok(readiness);
  assert.equal(readiness.readyToActivate, true);
  assert.equal(readiness.blockingCount, 0);
  assert.equal(readiness.warningCount, 1);
});

test('derives routed next steps only from failed applicable checks', () => {
  const readiness = normalizeHotelReadiness([
    row('identity.name', 'blocking', true),
    row('identity.city', 'blocking', true),
    row('identity.slug', 'blocking', true),
    row('identity.subdomain', 'blocking', true),
    row('admin.active', 'blocking', true),
    row('module.core_directory', 'blocking', true),
    row('operation.checkin', 'warning', false),
    row('visual.logo', 'warning', false),
    row('content.services', 'warning', false),
    row('rooms.qr', 'warning', true),
  ]);
  assert.ok(readiness);
  assert.deepEqual(getHotelReadinessNextSteps(readiness).map(({ href }) => href), [
    '/admin/hotel', '/admin/servicos',
  ]);
});

test('fails closed when the RPC omits or duplicates a blocking check', () => {
  assert.equal(normalizeHotelReadiness([row('identity.name', 'blocking', true)]), null);
  const blockers = HOTEL_READINESS_CHECK_CATALOG
    .filter(({ severity }) => severity === 'blocking')
    .map(({ key, severity }) => row(key, severity, true));
  assert.equal(normalizeHotelReadiness([...blockers, blockers[0]]), null);
});

test('centralizes SQL rules and exposes only narrow self-authorizing RPCs', () => {
  const migration = read('supabase', 'migrations', '202608170002_48_activation_readiness.sql');
  assert.match(migration, /create function public\.calculate_hotel_readiness\(p_hotel_id uuid\)/i);
  assert.match(migration, /create function public\.get_platform_hotel_readiness\(p_hotel_id uuid\)/i);
  assert.match(migration, /create function public\.get_current_hotel_readiness\(\)/i);
  assert.match(migration, /security definer set search_path=''/i);
  assert.match(migration, /active_platform_admin_required/);
  assert.match(migration, /p\.id=auth\.uid\(\) and p\.is_active/);
  assert.match(migration, /revoke all on function public\.calculate_hotel_readiness/);
  assert.doesNotMatch(migration, /grant execute on function public\.calculate_hotel_readiness/);
  assert.doesNotMatch(migration, /wifi_password/);
});

test('omits module-specific warnings when their entitlements are disabled', () => {
  const migration = read('supabase', 'migrations', '202608170002_48_activation_readiness.sql');
  for (const flag of ['services_enabled', 'departments_enabled', 'policies_enabled', 'banners_enabled', 'rooms_enabled', 'languages_enabled', 'preview_enabled']) {
    assert.match(migration, new RegExp(`if ${flag} then return query`, 'i'));
  }
});

test('gates only first activation and preserves lifecycle audit metadata', () => {
  const migration = read('supabase', 'migrations', '202608170002_48_activation_readiness.sql');
  const statusFunction = migration.match(/create function public\.update_platform_hotel_status[\s\S]*?end;\r?\n\$\$;/i)?.[0] || '';
  assert.match(statusFunction, /previous_status='draft' and p_status='active'/);
  assert.match(statusFunction, /platform_hotel_not_ready/);
  assert.match(statusFunction, /'hotel\.status_updated'/);
  assert.match(statusFunction, /'previous_status',previous_status,'new_status',p_status/);
  assert.doesNotMatch(statusFunction, /readiness_recalculated|readiness_snapshot/i);
});

test('does not persist readiness or change public policies', () => {
  const migration = read('supabase', 'migrations', '202608170002_48_activation_readiness.sql');
  assert.doesNotMatch(migration, /create table[^;]*(readiness|setup_status|onboarding_status|go_live_status)/i);
  assert.doesNotMatch(migration, /alter table public\.hotels[\s\S]*add[^;]*(readiness|setup_status|go_live_status)/i);
  assert.doesNotMatch(migration, /(create|alter|drop) policy/i);
  assert.doesNotMatch(migration, /drop view|create view/i);
});

test('admin and platform consume the same TypeScript readiness contract', () => {
  const queries = read('lib', 'readiness-queries.ts');
  const legacyQueries = read('lib', 'queries.ts');
  const admin = read('app', 'admin', 'page.tsx');
  const hotel = read('app', 'admin', 'hotel', 'page.tsx');
  const platform = read('app', 'platform', 'hoteis', '[id]', 'page.tsx');
  assert.match(queries, /normalizeHotelReadiness/);
  assert.match(admin, /getCurrentHotelReadiness/);
  assert.match(hotel, /getCurrentHotelReadiness/);
  assert.match(platform, /getPlatformHotelReadiness/);
  assert.match(admin, /HotelReadinessChecklist/);
  assert.match(platform, /HotelReadinessChecklist/);
  assert.doesNotMatch(legacyQueries, /getAdminOperationalReadiness|AdminOperationalReadinessItem/);
});

test('platform activation requires explicit confirmation and server-side blockers', () => {
  const page = read('app', 'platform', 'hoteis', '[id]', 'page.tsx');
  const actions = read('app', 'platform', 'hoteis', '[id]', 'actions.ts');
  assert.match(page, /Este hotel ficará disponível publicamente e os acessos públicos\/QR poderão ser utilizados\./);
  assert.match(page, /Confirmar publicação/);
  assert.match(page, /readiness\.readyToActivate/);
  assert.match(actions, /get_platform_hotel_readiness/);
  assert.match(actions, /platform_hotel_not_ready/);
  assert.doesNotMatch([page, actions].join('\n'), /service.role/i);
});
