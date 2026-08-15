import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ADMIN_MODULE_CATALOG, ADMIN_MODULE_KEYS } from '../../lib/admin-modules.ts';
import { ADMIN_NAVIGATION, getAdminNavigationForRole } from '../../lib/admin-navigation.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('defines the canonical module catalog with unique typed keys', () => {
  assert.equal(new Set(ADMIN_MODULE_KEYS).size, ADMIN_MODULE_KEYS.length);
  assert.deepEqual(ADMIN_MODULE_CATALOG.map(({ key }) => key), [...ADMIN_MODULE_KEYS]);
  for (const requiredKey of [
    'core.directory', 'content.services', 'content.departments', 'content.policies',
    'content.announcements', 'content.banners', 'rooms.qr', 'content.languages',
    'experience.appearance', 'experience.navigation', 'experience.preview', 'experience.seo',
    'fb.menu', 'content.tourism', 'analytics.basic', 'analytics.advanced',
    'integrations.thex', 'integrations.opera', 'audit.access_logs',
  ]) assert.ok(ADMIN_MODULE_KEYS.includes(requiredKey as (typeof ADMIN_MODULE_KEYS)[number]));
});

test('organizes the sidebar into the approved information architecture', () => {
  assert.deepEqual(ADMIN_NAVIGATION.map(({ key }) => key), ['principal', 'guest_experience', 'management']);
  assert.deepEqual(ADMIN_NAVIGATION[0].items.map(({ label }) => label), ['Dashboard', 'Unidades', 'Usuários', 'Configurações']);
  assert.deepEqual(ADMIN_NAVIGATION[1].items.map(({ label }) => label), [
    'Experiência Pública', 'Banners', 'Serviços', 'Departamentos',
    'Cardápio (F&B)', 'Turismo', 'Comunicados', 'Informações', 'Políticas',
  ]);
  assert.deepEqual(ADMIN_NAVIGATION[2].items.map(({ label }) => label), ['Idiomas', 'Logs de Acesso']);
  for (const item of ADMIN_NAVIGATION.flatMap(({ items }) => items)) {
    assert.ok(item.moduleKey);
    assert.ok(item.requiredRole);
    assert.ok(item.availability);
  }
});

test('preserves existing role visibility without introducing module entitlements', () => {
  const viewerRoutes = getAdminNavigationForRole('visualizador').flatMap(({ items }) => items.map(({ href }) => href));
  const editorRoutes = getAdminNavigationForRole('editor').flatMap(({ items }) => items.map(({ href }) => href));
  const adminRoutes = getAdminNavigationForRole('administrador').flatMap(({ items }) => items.map(({ href }) => href));
  assert.ok(!viewerRoutes.includes('/admin/hotel') && !viewerRoutes.includes('/admin/usuarios'));
  assert.ok(editorRoutes.includes('/admin/hotel') && editorRoutes.includes('/admin/apartamentos'));
  assert.ok(!editorRoutes.includes('/admin/usuarios') && !editorRoutes.includes('/admin/logs'));
  assert.ok(adminRoutes.includes('/admin/usuarios') && adminRoutes.includes('/admin/logs'));
  assert.doesNotMatch(read('lib', 'admin-navigation.ts'), /entitlement|platform_status|lifecycle|supabase/i);
});

test('keeps every existing admin route and adds only approved foundations', () => {
  const routes = [
    'app/admin/page.tsx', 'app/admin/hotel/page.tsx', 'app/admin/apartamentos/page.tsx',
    'app/admin/servicos/page.tsx', 'app/admin/departamentos/page.tsx', 'app/admin/politicas/page.tsx',
    'app/admin/comunicados/page.tsx', 'app/admin/banners/page.tsx', 'app/admin/usuarios/page.tsx',
    'app/admin/experiencia/page.tsx', 'app/admin/configuracoes/page.tsx', 'app/admin/cardapio/page.tsx',
    'app/admin/turismo/page.tsx', 'app/admin/idiomas/page.tsx', 'app/admin/logs/page.tsx',
  ];
  for (const route of routes) assert.ok(existsSync(join(root, route)), route);
});

test('marks future areas as coming soon without fake operations', () => {
  for (const moduleKey of ['fb.menu', 'content.tourism', 'experience.seo', 'experience.preview', 'audit.access_logs']) {
    assert.equal(ADMIN_MODULE_CATALOG.find(({ key }) => key === moduleKey)?.availability, 'coming_soon');
  }
  const structural = [
    read('components', 'admin', 'admin-coming-soon-page.tsx'),
    read('app', 'admin', 'cardapio', 'page.tsx'),
    read('app', 'admin', 'turismo', 'page.tsx'),
    read('app', 'admin', 'logs', 'page.tsx'),
  ].join('\n');
  assert.match(structural, /Em breve/);
  assert.doesNotMatch(structural, /\.from\(|\.rpc\(|insert\(|update\(|delete\(|service_role/i);
});

test('matches the compact golden-master navigation without sidebar roadmap badges', () => {
  const navigation = read('lib', 'admin-navigation.ts');
  const links = read('components', 'admin', 'nav-links.tsx');
  const sidebar = read('components', 'admin', 'admin-sidebar.tsx');
  assert.match(navigation, /href: '\/admin\/apartamentos', label: 'Unidades'/);
  assert.match(navigation, /href: '\/admin\/comunicados', label: 'Comunicados'/);
  assert.doesNotMatch(links, /item\.badge|Em breve/);
  assert.match(sidebar, /admin-scrollbar-hidden/);
  assert.match(sidebar, /min-h-0 flex-1 overflow-y-auto/);
});

test('uses the authenticated hotel for a sandboxed public preview', () => {
  const page = read('app', 'admin', 'experiencia', 'page.tsx');
  const preview = read('components', 'admin', 'experience', 'public-experience-preview.tsx');
  assert.match(page, /requireAdminAccess\('visualizador'\)/);
  assert.match(page, /eq\('hotel_id', profile\.hotel_id\)/);
  assert.match(page, /const publicUrl = `\/hotel\/\$\{encodeURIComponent\(hotel\.slug\)\}`/);
  assert.doesNotMatch(page, /searchParams[^\n]*hotel|service_role|createAdminClient/i);
  assert.match(preview, /<iframe/);
  assert.match(preview, /sandbox="allow-forms allow-popups allow-same-origin allow-scripts"/);
  assert.doesNotMatch(preview, /service_role|supabase|allow-top-navigation/i);
});

test('keeps experience tabs horizontally accessible on mobile', () => {
  const tabs = read('components', 'admin', 'experience', 'experience-tabs.tsx');
  assert.match(tabs, /overflow-x-auto/);
  assert.match(tabs, /min-w-max/);
  assert.match(tabs, /admin-scrollbar-hidden/);
  assert.match(tabs, /scroll-smooth/);
});

test('inherits hotel brand themes and keeps platform isolated', () => {
  const layout = read('app', 'admin', 'layout.tsx');
  const mobile = read('components', 'admin', 'mobile-menu.tsx');
  const platform = [read('app', 'platform', 'layout.tsx'), read('app', 'platform', 'page.tsx')].join('\n');
  assert.match(layout, /AdminThemeProvider/);
  assert.match(layout, /resolveAdminTheme/);
  assert.match(mobile, /themeStyle/);
  assert.doesNotMatch(platform, /admin-navigation|admin-modules|AdminThemeProvider|resolveAdminTheme/);
});

test('does not add a Sprint 46.7 migration or SQL contract', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  assert.ok(!migrations.some((name) => /46[._-]?7/i.test(name)));
  const foundation = [read('lib', 'admin-modules.ts'), read('lib', 'admin-navigation.ts')].join('\n');
  assert.doesNotMatch(foundation, /create\s+(table|policy|function)|alter\s+table|grant\s+/i);
});
