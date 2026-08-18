import { hasMinimumRole, type AppRole } from './app-roles.ts';
import { getModule, type ModuleAvailability, type ModuleKey } from './modules/catalog.ts';

export type AdminNavGroupKey = 'principal' | 'guest_experience' | 'management';
export type AdminNavIcon =
  | 'dashboard' | 'hotel' | 'services' | 'rooms' | 'departments' | 'policies'
  | 'announcements' | 'banners' | 'users' | 'settings' | 'experience'
  | 'menu' | 'tourism' | 'languages' | 'logs' | 'analytics';

export interface AdminNavigationItem {
  href: string;
  label: string;
  icon: AdminNavIcon;
  moduleKey?: ModuleKey;
  requiredRole: AppRole;
  availability: ModuleAvailability;
  badge?: string;
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
    key: 'principal', label: 'Principal', items: [
      item({ href: '/admin', label: 'Dashboard', icon: 'dashboard', requiredRole: 'visualizador' }),
      item({ href: '/admin/apartamentos', label: 'Unidades', icon: 'rooms', moduleKey: 'rooms.qr', requiredRole: 'editor' }),
      item({ href: '/admin/usuarios', label: 'Usuários', icon: 'users', requiredRole: 'administrador' }),
      item({ href: '/admin/configuracoes', label: 'Configurações', icon: 'settings', requiredRole: 'editor' }),
    ],
  },
  {
    key: 'guest_experience', label: 'Experiência do hóspede', items: [
      item({ href: '/admin/experiencia', label: 'Experiência Pública', icon: 'experience', moduleKey: 'core.directory', requiredRole: 'visualizador' }),
      item({ href: '/admin/banners', label: 'Banners', icon: 'banners', moduleKey: 'content.banners', requiredRole: 'visualizador' }),
      item({ href: '/admin/servicos', label: 'Serviços', icon: 'services', moduleKey: 'content.services', requiredRole: 'visualizador' }),
      item({ href: '/admin/departamentos', label: 'Departamentos', icon: 'departments', moduleKey: 'content.departments', requiredRole: 'visualizador' }),
      item({ href: '/admin/cardapio', label: 'Cardápio (F&B)', icon: 'menu', moduleKey: 'fb.menu', requiredRole: 'visualizador' }),
      item({ href: '/admin/turismo', label: 'Turismo', icon: 'tourism', moduleKey: 'content.tourism', requiredRole: 'visualizador' }),
      item({ href: '/admin/comunicados', label: 'Comunicados', icon: 'announcements', moduleKey: 'content.announcements', requiredRole: 'visualizador' }),
      item({ href: '/admin/hotel', label: 'Informações', icon: 'hotel', requiredRole: 'editor' }),
      item({ href: '/admin/politicas', label: 'Políticas', icon: 'policies', moduleKey: 'content.policies', requiredRole: 'visualizador' }),
    ],
  },
  {
    key: 'management', label: '', items: [
      item({ href: '/admin/analytics', label: 'Analytics', icon: 'analytics', moduleKey: 'analytics.basic', requiredRole: 'visualizador' }),
      item({ href: '/admin/idiomas', label: 'Idiomas', icon: 'languages', moduleKey: 'content.languages', requiredRole: 'visualizador' }),
      item({ href: '/admin/logs', label: 'Logs de Acesso', icon: 'logs', moduleKey: 'audit.access_logs', requiredRole: 'administrador' }),
    ],
  },
] as const;

export function getAdminNavigationForRole(role: AppRole, enabledModules?: ReadonlySet<ModuleKey>): AdminNavigationGroup[] {
  return ADMIN_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((navigationItem) =>
      hasMinimumRole(role, navigationItem.requiredRole)
      && (!navigationItem.moduleKey || !enabledModules || enabledModules.has(navigationItem.moduleKey))
    ),
  })).filter((group) => group.items.length > 0);
}
