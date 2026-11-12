import type { FbGraph, FbKind, FbRecord } from './types.ts';

export type FbWorkspaceSection = 'overview' | 'outlet' | 'menu' | 'item' | 'orders' | 'printing' | 'kds';
export interface FbWorkspaceLink { section: FbWorkspaceSection; href: string; label: string }
export interface FbWorkspaceAccess { editorial: boolean; orders: boolean; printing: boolean; kds?: boolean }

/** Presentation links only. Callers supply the existing authoritative access results. */
export function fbWorkspaceLinks(access: FbWorkspaceAccess): FbWorkspaceLink[] {
  const links: FbWorkspaceLink[] = [];
  if (access.editorial) links.push(
    { section: 'overview', href: '/admin/cardapio', label: 'Visão geral' },
    { section: 'outlet', href: '/admin/cardapio?kind=outlet', label: 'Estabelecimentos' },
    { section: 'menu', href: '/admin/cardapio?kind=menu', label: 'Cardápios' },
    { section: 'item', href: '/admin/cardapio?kind=item', label: 'Itens' },
  );
  if (access.orders) links.push({ section: 'orders', href: '/admin/pedidos', label: 'Pedidos' });
  if (access.printing) links.push({ section: 'printing', href: '/admin/impressao', label: 'Impressão' });
  if (access.kds) links.push({ section: 'kds', href: '/admin/kds', label: 'KDS' });
  return links;
}

export function fbWorkspaceSection(pathname: string, kind?: string | null, id?: string | null): FbWorkspaceSection | null {
  if (pathname === '/admin/kds' || pathname.startsWith('/admin/kds/')) return 'kds';
  if (pathname === '/admin/pedidos' || pathname.startsWith('/admin/pedidos/')) return 'orders';
  if (pathname === '/admin/impressao' || pathname.startsWith('/admin/impressao/')) return 'printing';
  if (pathname !== '/admin/cardapio' && !pathname.startsWith('/admin/cardapio/')) return null;
  if (kind === 'category') return 'menu';
  if (kind === 'item' || kind === 'menu' || kind === 'outlet') return kind;
  // Legacy links with an id and no kind historically selected an outlet.
  return id ? 'outlet' : 'overview';
}

export interface FbWorkspaceFilters {
  q?: string; status?: string; outlet?: string; menu?: string;
  category?: string; availability?: string; parent?: string; page?: string;
}
const rowsFor = (graph: FbGraph, kind: FbKind): FbRecord[] => graph[({ outlet: 'outlets', menu: 'menus', category: 'categories', item: 'items' } as const)[kind]];
const searchable = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
export const FB_ADMIN_PAGE_SIZE = 24;
export function fbPublicationSummary(published: number, drafts: number, feminine = false) {
  return `${published} ${feminine ? published === 1 ? 'publicada' : 'publicadas' : published === 1 ? 'publicado' : 'publicados'} · ${drafts} ${drafts === 1 ? 'rascunho' : 'rascunhos'}`;
}

/** Bounded visible results; no mutation, persisted aggregates or operational state inference. */
export function fbWorkspacePage(graph: FbGraph, kind: FbKind, filters: FbWorkspaceFilters = {}) {
  const linkedMenus = filters.outlet ? new Set(graph.outlet_menus.filter(link => link.outlet_id === filters.outlet).map(link => link.menu_id)) : null;
  const categories = new Map(graph.categories.map(category => [category.id, category]));
  const query = searchable((filters.q || '').trim().slice(0, 120));
  const rows = rowsFor(graph, kind).filter(row => {
    if (filters.status === 'published' && !row.is_published || filters.status === 'draft' && row.is_published) return false;
    const content = row as unknown as Record<string, unknown>;
    if (query && !searchable([row.name, content.short_description, content.description, content.full_description].filter(value => typeof value === 'string').join(' ')).includes(query)) return false;
    const category = kind === 'item' ? categories.get(String(content.category_id)) : kind === 'category' ? categories.get(row.id) : null;
    const menuId = kind === 'menu' ? row.id : category?.menu_id;
    if (kind !== 'outlet' && linkedMenus && (!menuId || !linkedMenus.has(menuId))) return false;
    if (filters.menu && kind !== 'outlet' && menuId !== filters.menu) return false;
    if (filters.category && kind === 'item' && content.category_id !== filters.category) return false;
    if (filters.parent && (kind === 'category' && content.menu_id !== filters.parent || kind === 'item' && content.category_id !== filters.parent)) return false;
    if (kind === 'item' && (filters.availability === 'available' && content.is_available !== true || filters.availability === 'unavailable' && content.is_available !== false)) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(rows.length / FB_ADMIN_PAGE_SIZE));
  const requested = /^\d{1,6}$/.test(filters.page || '') ? Number(filters.page) : 1;
  const page = Math.min(pages, Math.max(1, requested));
  return { rows: rows.slice((page - 1) * FB_ADMIN_PAGE_SIZE, page * FB_ADMIN_PAGE_SIZE), total: rows.length, page, pages };
}

export function fbWorkspaceStats(graph: FbGraph) {
  return (['outlet', 'menu', 'category', 'item'] as const).map(kind => {
    const rows = rowsFor(graph, kind);
    const published = rows.filter(row => row.is_published).length;
    return { kind, total: rows.length, published, drafts: rows.length - published };
  });
}

export function fbOutletCounts(graph: FbGraph, outletId: string) {
  const menuIds = new Set(graph.outlet_menus.filter(link => link.outlet_id === outletId).map(link => link.menu_id));
  const categoryIds = new Set(graph.categories.filter(category => menuIds.has(category.menu_id)).map(category => category.id));
  return { menus: graph.menus.filter(menu => menuIds.has(menu.id)).length, items: graph.items.filter(item => categoryIds.has(item.category_id)).length };
}
