import { hasMinimumRole, type AppRole } from './app-roles.ts';
import { getModule, type ModuleAvailability, type ModuleKey } from './modules/catalog.ts';
import { fbWorkspaceLinks, type FbWorkspaceSection } from './fb/admin-workspace.ts';

export type AdminNavGroupKey = 'principal' | 'guest_experience' | 'operation' | 'management' | 'system';
export type AdminNavIcon =
  | 'dashboard' | 'hotel' | 'services' | 'rooms' | 'departments' | 'policies'
  | 'announcements' | 'banners' | 'users' | 'settings' | 'experience'
  | 'menu' | 'gastronomy' | 'tourism' | 'languages' | 'logs' | 'analytics' | 'flights';

export interface AdminNavigationItem {
  href: string;
  label: string;
  icon: AdminNavIcon;
  moduleKey?: ModuleKey;
  requiredRole: AppRole;
  availability: ModuleAvailability;
  badge?: string;
  section?: FbWorkspaceSection;
  children?: AdminNavigationItem[];
}

export interface AdminNavigationGroup {
  key: AdminNavGroupKey;
  label: string;
  items: AdminNavigationItem[];
}

function item(definition: Omit<AdminNavigationItem, 'availability' | 'badge'>): AdminNavigationItem {
  const moduleDefinition = definition.moduleKey ? getModule(definition.moduleKey) : null;
  return {
    ...definition,
    availability: moduleDefinition?.availability || 'available',
    badge: moduleDefinition?.availability === 'coming_soon' ? 'Em breve' : undefined,
  };
}

export const ADMIN_NAVIGATION: readonly AdminNavigationGroup[] = [
  {
    key: 'principal', label: 'Visão geral', items: [
      item({ href: '/admin', label: 'Dashboard', icon: 'dashboard', requiredRole: 'visualizador' }),
    ],
  },
  {
    key: 'guest_experience', label: 'Conteúdo e experiência', items: [
      item({ href: '/admin/experiencia', label: 'Experiência Pública', icon: 'experience', moduleKey: 'core.directory', requiredRole: 'visualizador' }),
      item({ href: '/admin/servicos', label: 'Serviços', icon: 'services', moduleKey: 'content.services', requiredRole: 'visualizador' }),
      item({ href: '/admin/departamentos', label: 'Departamentos', icon: 'departments', moduleKey: 'content.departments', requiredRole: 'visualizador' }),
      item({ href: '/admin/cardapio', label: 'Gastronomia (F&B)', icon: 'gastronomy', moduleKey: 'fb.menu', requiredRole: 'visualizador' }),
      item({ href: '/admin/turismo', label: 'Turismo', icon: 'tourism', moduleKey: 'content.tourism', requiredRole: 'visualizador' }),
      item({ href: '/admin/comunicados', label: 'Comunicados', icon: 'announcements', moduleKey: 'content.announcements', requiredRole: 'visualizador' }),
      item({ href: '/admin/banners', label: 'Banners', icon: 'banners', moduleKey: 'content.banners', requiredRole: 'visualizador' }),
      item({ href: '/admin/politicas', label: 'Políticas', icon: 'policies', moduleKey: 'content.policies', requiredRole: 'visualizador' }),
    ],
  },
  {
    key: 'operation', label: 'Operação', items: [
      item({ href: '/admin/apartamentos', label: 'Unidades e QR', icon: 'rooms', moduleKey: 'rooms.qr', requiredRole: 'editor' }),
      item({ href: '/admin/voos', label: 'Central de Voos', icon: 'flights', moduleKey: 'travel.flights', requiredRole: 'visualizador' }),
    ],
  },
  {
    key: 'management', label: 'Gestão', items: [
      item({ href: '/admin/analytics', label: 'Analytics', icon: 'analytics', moduleKey: 'analytics.basic', requiredRole: 'visualizador' }),
      item({ href: '/admin/idiomas', label: 'Idiomas', icon: 'languages', moduleKey: 'content.languages', requiredRole: 'visualizador' }),
      item({ href: '/admin/usuarios', label: 'Usuários', icon: 'users', requiredRole: 'administrador' }),
      item({ href: '/admin/hotel', label: 'Informações do hotel', icon: 'hotel', requiredRole: 'editor' }),
    ],
  },
  {
    key: 'system', label: 'Sistema', items: [
      item({ href: '/admin/configuracoes', label: 'Configurações', icon: 'settings', requiredRole: 'editor' }),
      item({ href: '/admin/logs', label: 'Logs de Acesso', icon: 'logs', moduleKey: 'audit.access_logs', requiredRole: 'administrador' }),
    ],
  },
] as const;

export function getAdminNavigationForRole(role: AppRole, enabledModules?: ReadonlySet<ModuleKey>, operationalAccess: { orders: boolean; printing: boolean; kds?: boolean; archivedDrain?: boolean } = { orders: false, printing: false }): AdminNavigationGroup[] {
  const groups: AdminNavigationGroup[] = (operationalAccess.archivedDrain ? [] : ADMIN_NAVIGATION).map((group) => ({
    ...group,
    items: group.items.filter((navigationItem) =>
      hasMinimumRole(role, navigationItem.requiredRole)
      && (!navigationItem.moduleKey || !enabledModules || enabledModules.has(navigationItem.moduleKey))
    ).map(navigationItem => ({ ...navigationItem })),
  })).filter((group) => group.items.length > 0);
  const parent = groups.flatMap(group => group.items).find(entry => entry.href === '/admin/cardapio');
  const operationalRole = hasMinimumRole(role, 'operador');
  const children = fbWorkspaceLinks({ editorial: !!parent, orders: operationalRole && operationalAccess.orders, printing: operationalRole && operationalAccess.printing, kds: hasMinimumRole(role,'editor') && !operationalAccess.archivedDrain && operationalAccess.kds }).map(link => ({ ...link, icon: 'menu' as const, requiredRole: (link.section==='kds'?'editor':link.section === 'orders' || link.section === 'printing' ? 'operador' : 'visualizador') as AppRole, availability: 'available' as const }));
  if (parent) parent.children = children;
  else if (children.length) {
    const group = groups.find(group => group.key === 'guest_experience');
    const entry: AdminNavigationItem = { href: children[0].href, label: 'Gastronomia (F&B)', icon: 'gastronomy', requiredRole: 'operador', availability: 'available', children };
    if (group) group.items.push(entry); else groups.push({ key: 'guest_experience', label: 'Conteúdo e experiência', items: [entry] });
  }
  return groups;
}
