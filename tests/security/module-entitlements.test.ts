import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MODULE_CATALOG, MODULE_KEYS } from '../../lib/modules/catalog.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('keeps one shared canonical 20-key module catalog', () => {
  assert.equal(MODULE_KEYS.length, 20);
  assert.equal(new Set(MODULE_KEYS).size, 20);
  assert.deepEqual(MODULE_CATALOG.map(({ key }) => key).sort(), [...MODULE_KEYS].sort());
  assert.doesNotMatch(read('lib', 'modules', 'catalog.ts'), /supabase|hotel_id|platform_status/i);
  assert.equal(MODULE_CATALOG.find(({ key }) => key === 'experience.preview')?.availability, 'available');
  assert.equal(MODULE_CATALOG.find(({ key }) => key === 'experience.navigation')?.availability, 'available');
  assert.deepEqual(MODULE_CATALOG.find(({ key }) => key === 'travel.flights'), {
    key: 'travel.flights',
    name: 'Central de Voos',
    group: 'operations',
    availability: 'available',
    description: 'Ajude o hóspede a acompanhar seu voo e organizar a saída do hotel.',
  });
  assert.deepEqual(MODULE_CATALOG.filter(({ availability }) => availability === 'coming_soon').map(({ key }) => key), [
    'experience.seo', 'fb.menu', 'content.tourism',
    'analytics.advanced', 'integrations.thex', 'integrations.opera', 'audit.access_logs',
  ]);
});

test('adds travel.flights without changing the existing nineteen module contracts', () => {
  assert.deepEqual(MODULE_KEYS.filter((key) => key !== 'travel.flights'), [
    'core.directory', 'content.services', 'content.departments', 'content.policies',
    'content.announcements', 'content.banners', 'rooms.qr', 'content.languages',
    'experience.appearance', 'experience.navigation', 'experience.preview', 'experience.seo',
    'fb.menu', 'content.tourism', 'analytics.basic', 'analytics.advanced',
    'integrations.thex', 'integrations.opera', 'audit.access_logs',
  ]);
});

test('filters sidebar with server-resolved entitlements while structural routes remain', () => {
  const layout = read('app', 'admin', 'layout.tsx');
  const navigation = read('lib', 'admin-navigation.ts');
  assert.match(layout, /getCurrentHotelEntitlements/);
  assert.match(layout, /getAdminNavigationForRole\(profile\.normalizedRole, enabledModules\)/);
  assert.match(navigation, /enabledModules\.has\(navigationItem\.moduleKey\)/);
  for (const route of ["href: '/admin'", "href: '/admin/usuarios'", "href: '/admin/configuracoes'"]) {
    const line = navigation.split('\n').find((value) => value.includes(route));
    assert.ok(line && !line.includes('moduleKey'));
  }
});

test('guards every modular route on the server', () => {
  const routes: Record<string, string> = {
    experiencia: 'core.directory', turismo: 'content.tourism', cardapio: 'fb.menu',
    idiomas: 'content.languages', logs: 'audit.access_logs', servicos: 'content.services',
    analytics: 'analytics.basic',
    departamentos: 'content.departments', politicas: 'content.policies',
    comunicados: 'content.announcements', banners: 'content.banners', apartamentos: 'rooms.qr',
  };
  for (const [route, key] of Object.entries(routes)) {
    assert.ok(read('app', 'admin', route, 'layout.tsx').includes(`requireHotelModule('${key}')`));
  }
  assert.match(read('lib', 'admin-entitlements.ts'), /get_current_hotel_modules/);
  assert.match(read('lib', 'admin-entitlements.ts'), /redirect\('\/admin\/modulo-indisponivel'\)/);
  const experience = read('app', 'admin', 'experiencia', 'page.tsx');
  assert.match(experience, /enabledModules\.has\('experience\.preview'\)/);
  assert.match(experience, /requireHotelModule\('experience\.preview'\)/);
  assert.match(experience, /enabledModules\.has\('experience\.navigation'\)/);
  assert.match(experience, /requireHotelModule\('experience\.navigation'\)/);
});

test('platform module governance uses only narrow RPCs and canonical input', () => {
  const queries = read('lib', 'platform-queries.ts');
  const actions = read('app', 'platform', 'hoteis', '[id]', 'actions.ts');
  const page = read('app', 'platform', 'hoteis', '[id]', 'page.tsx');
  assert.match(queries, /get_platform_hotel_modules/);
  assert.match(actions, /update_platform_hotel_module/);
  assert.match(actions, /isModuleKey/);
  assert.match(page, /MODULE_CATALOG/);
  assert.match(page, /module\.availability === 'coming_soon'/);
  assert.match(page, /comingSoon \? 'Em breve'/);
  assert.doesNotMatch([queries, actions, page].join('\n'), /from\(['"]hotel_module_entitlements/);
});

test('public resolution, QR and analytics enforce entitlements', () => {
  const migration = read('supabase', 'migrations', '202608150001_46_8_module_entitlements.sql');
  const room = read('lib', 'room-links.ts');
  const analytics = read('app', 'api', 'analytics', 'route.ts');
  assert.match(migration, /public_hotels[\s\S]*core\.directory/);
  for (const key of ['content.services','content.departments','content.policies','content.announcements','content.banners','content.languages']) assert.match(migration, new RegExp(key.replace('.', '\\.')));
  assert.match(room, /isHotelModuleEnabled\([\s\S]*?'rooms\.qr'/);
  assert.match(analytics, /isHotelModuleEnabled\(hotel\.id, 'analytics\.basic'\)/);
});

test('migration closes direct access, audits atomically and preserves data', () => {
  const migration = read('supabase', 'migrations', '202608150001_46_8_module_entitlements.sql');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.hotel_module_entitlements from public, anon, authenticated, service_role/i);
  assert.match(migration, /hotel\.module_enabled/);
  assert.match(migration, /hotel\.module_disabled/);
  assert.match(migration, /perform public\.record_platform_audit_event/);
  assert.doesNotMatch(migration.match(/create function public\.update_platform_hotel_module[\s\S]*?end;\n\$\$;/i)?.[0] || '', /insert into public\.platform_audit_log/i);
  assert.match(migration, /platform_module_not_available/);
  assert.match(migration, /platform_module_dependency_required/);
  assert.match(migration, /information_schema\.columns/);
  assert.match(migration, /p\.qual/);
  assert.match(migration, /p\.with_check/);
  assert.doesNotMatch(migration, /delete from public\.(hotel_sections|hotel_departments|hotel_policies|hotel_announcements|hotel_promotional_banners)/i);
});
