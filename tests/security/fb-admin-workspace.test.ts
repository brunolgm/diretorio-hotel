import assert from 'node:assert/strict';
import test from 'node:test';
import { fbFixture } from '../fixtures/fb.ts';
import { FB_ADMIN_PAGE_SIZE, fbWorkspaceLinks, fbWorkspaceSection, fbWorkspacePage, fbWorkspaceStats, fbOutletCounts, fbPublicationSummary } from '../../lib/fb/admin-workspace.ts';
import { ADMIN_NAVIGATION, getAdminNavigationForRole } from '../../lib/admin-navigation.ts';

test('workspace visibility composes authoritative editorial, order and print access independently', () => {
  for (const editorial of [false, true]) for (const orders of [false, true]) for (const printing of [false, true]) {
    const links = fbWorkspaceLinks({ editorial, orders, printing });
    assert.equal(links.some(link => link.section === 'orders'), orders);
    assert.equal(links.some(link => link.section === 'printing'), printing);
    assert.equal(links.some(link => link.section === 'item'), editorial);
    assert.equal(links.length, Number(editorial) * 4 + Number(orders) + Number(printing));
  }
  assert.deepEqual(fbWorkspaceLinks({ editorial: false, orders: true, printing: false }).map(link => link.href), ['/admin/pedidos']);
});

test('legacy kind, parent editor and operational URLs retain distinct active sections', () => {
  assert.equal(fbWorkspaceSection('/admin/cardapio'), 'overview');
  assert.equal(fbWorkspaceSection('/admin/cardapio', 'outlet'), 'outlet');
  assert.equal(fbWorkspaceSection('/admin/cardapio', 'category'), 'menu');
  assert.equal(fbWorkspaceSection('/admin/cardapio', null, 'legacy-id'), 'outlet');
  assert.equal(fbWorkspaceSection('/admin/cardapio', 'item'), 'item');
  assert.equal(fbWorkspaceSection('/admin/pedidos'), 'orders');
  assert.equal(fbWorkspaceSection('/admin/impressao'), 'printing');
  assert.equal(fbWorkspaceSection('/admin/servicos'), null);
});

test('catalogue filters compose associations, search, status, availability and legacy parent', () => {
  const graph = fbFixture(4).fb!;
  graph.items.push({ ...graph.items[0], id: 'second', name: 'Café da manhã', short_description: 'Opção vegetariana', is_published: false, is_available: false });
  assert.equal(fbWorkspacePage(graph, 'item', { q: 'cafe' }).total, 1);
  assert.equal(fbWorkspacePage(graph, 'item', { q: 'VEGETARIANA', status: 'draft', availability: 'unavailable', outlet: graph.outlets[0].id, menu: graph.menus[0].id, category: graph.categories[0].id }).rows[0].id, 'second');
  assert.equal(fbWorkspacePage(graph, 'item', { status: 'published', availability: 'available' }).total, 1);
  assert.equal(fbWorkspacePage(graph, 'item', { outlet: 'foreign-outlet' }).total, 0);
  assert.equal(fbWorkspacePage(graph, 'item', { menu: 'foreign-menu' }).total, 0);
  assert.equal(fbWorkspacePage(graph, 'category', { parent: graph.menus[0].id }).total, 1);
  assert.equal(fbWorkspacePage(graph, 'item', { parent: 'foreign-category' }).total, 0);
});

test('large editorial catalogues expose one bounded page and preserve source ordering/data', () => {
  const graph = fbFixture(0).fb!;
  graph.items = Array.from({ length: 5000 }, (_, index) => ({ ...graph.items[0], id: String(index), name: 'Item ' + index }));
  const original = JSON.stringify(graph);
  assert.equal(fbWorkspacePage(graph, 'item').rows.length, FB_ADMIN_PAGE_SIZE);
  assert.equal(fbWorkspacePage(graph, 'item', { page: '2' }).rows[0].id, '24');
  assert.equal(fbWorkspacePage(graph, 'item', { page: '999999' }).page, Math.ceil(5000 / FB_ADMIN_PAGE_SIZE));
  assert.equal(fbWorkspacePage(graph, 'item', { page: '-2' }).page, 1);
  assert.equal(fbWorkspacePage(graph, 'item', { page: '1e9' }).page, 1);
  assert.equal(JSON.stringify(graph), original);
});

test('metrics and outlet counts derive from the graph without double-counting shared menus', () => {
  const graph = fbFixture(1).fb!;
  assert.deepEqual(fbWorkspaceStats(graph).map(stat => stat.total), [2, 1, 1, 1]);
  graph.outlet_menus.push({ ...graph.outlet_menus[0] });
  assert.deepEqual(fbOutletCounts(graph, graph.outlets[0].id), { menus: 1, items: 1 });
  assert.deepEqual(fbOutletCounts(graph, 'absent'), { menus: 0, items: 0 });
});

test('publication summaries pluralize zero, singular and multiple counts correctly', () => {
  assert.equal(fbPublicationSummary(0, 0), '0 publicados · 0 rascunhos');
  assert.equal(fbPublicationSummary(1, 1), '1 publicado · 1 rascunho');
  assert.equal(fbPublicationSummary(1, 0, true), '1 publicada · 0 rascunhos');
  assert.equal(fbPublicationSummary(2, 3, true), '2 publicadas · 3 rascunhos');
});

test('shared sidebar composes role/module/capability visibility without mutating request-independent definitions', () => {
  const original = JSON.stringify(ADMIN_NAVIGATION);
  const children = (role: 'visualizador'|'operador'|'administrador', enabled: boolean, orders: boolean, printing: boolean) => getAdminNavigationForRole(role, new Set(enabled ? ['fb.menu'] : []), { orders, printing }).flatMap(group => group.items).flatMap(item => item.children || []);
  assert.equal(children('visualizador', true, true, true).length, 4);
  assert.equal(children('operador', false, false, false).length, 0);
  assert.deepEqual(children('operador', false, true, false).map(item => item.href), ['/admin/pedidos']);
  assert.deepEqual(children('administrador', true, true, true).map(item => item.section), ['overview','outlet','menu','item','orders','printing']);
  assert.ok(!children('administrador', true, false, false).some(item => item.section === 'orders' || item.section === 'printing'));
  assert.equal(JSON.stringify(ADMIN_NAVIGATION), original);
});

test('archived drain preserves only the existing authorized orders shell', () => {
  const groups = getAdminNavigationForRole('operador', new Set(), { orders: true, printing: false, archivedDrain: true });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 1);
  assert.deepEqual(groups[0].items[0].children?.map(item => item.href), ['/admin/pedidos']);
});
