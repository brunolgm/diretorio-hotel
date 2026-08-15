export const ADMIN_MODULE_KEYS = [
  'core.directory',
  'core.hotel_configuration',
  'core.user_management',
  'content.services',
  'content.departments',
  'content.policies',
  'content.announcements',
  'content.banners',
  'rooms.qr',
  'content.languages',
  'experience.appearance',
  'experience.navigation',
  'experience.preview',
  'experience.seo',
  'fb.menu',
  'content.tourism',
  'analytics.basic',
  'analytics.advanced',
  'integrations.thex',
  'integrations.opera',
  'audit.access_logs',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];
export type AdminModuleAvailability = 'available' | 'coming_soon';
export type AdminModuleGroup = 'core' | 'content' | 'experience' | 'operations' | 'analytics' | 'integrations' | 'audit';

export interface AdminModuleDefinition {
  key: AdminModuleKey;
  name: string;
  group: AdminModuleGroup;
  availability: AdminModuleAvailability;
  description: string;
}

export const ADMIN_MODULE_CATALOG: readonly AdminModuleDefinition[] = [
  { key: 'core.directory', name: 'Diretório do hotel', group: 'core', availability: 'available', description: 'Núcleo da experiência pública do hotel.' },
  { key: 'core.hotel_configuration', name: 'Configurações do hotel', group: 'core', availability: 'available', description: 'Informações e configuração operacional existentes.' },
  { key: 'core.user_management', name: 'Usuários do hotel', group: 'core', availability: 'available', description: 'Gestão atual de usuários hotel-scoped.' },
  { key: 'content.services', name: 'Serviços', group: 'content', availability: 'available', description: 'Serviços publicados para hóspedes.' },
  { key: 'content.departments', name: 'Departamentos', group: 'content', availability: 'available', description: 'Canais operacionais do hotel.' },
  { key: 'content.policies', name: 'Políticas', group: 'content', availability: 'available', description: 'Políticas e orientações do hotel.' },
  { key: 'content.announcements', name: 'Anúncios', group: 'content', availability: 'available', description: 'Anúncios e comunicados vigentes.' },
  { key: 'content.banners', name: 'Banners', group: 'content', availability: 'available', description: 'Destaques visuais da experiência pública.' },
  { key: 'rooms.qr', name: 'Apartamentos e QR', group: 'operations', availability: 'available', description: 'Links por apartamento e QR.' },
  { key: 'content.languages', name: 'Idiomas', group: 'content', availability: 'available', description: 'Estado do fluxo PT, EN e ES existente.' },
  { key: 'experience.appearance', name: 'Aparência', group: 'experience', availability: 'coming_soon', description: 'Futura gestão centralizada da aparência.' },
  { key: 'experience.navigation', name: 'Navegação', group: 'experience', availability: 'coming_soon', description: 'Futura composição da navegação pública.' },
  { key: 'experience.preview', name: 'Pré-visualização', group: 'experience', availability: 'coming_soon', description: 'Futura pré-visualização integrada.' },
  { key: 'experience.seo', name: 'SEO e compartilhamento', group: 'experience', availability: 'coming_soon', description: 'Futuros metadados e compartilhamento.' },
  { key: 'fb.menu', name: 'Cardápio (F&B)', group: 'content', availability: 'coming_soon', description: 'Futuro módulo de alimentos e bebidas.' },
  { key: 'content.tourism', name: 'Turismo', group: 'content', availability: 'coming_soon', description: 'Futuro conteúdo de turismo local.' },
  { key: 'analytics.basic', name: 'Analytics básico', group: 'analytics', availability: 'available', description: 'Indicadores atuais do dashboard.' },
  { key: 'analytics.advanced', name: 'Analytics avançado', group: 'analytics', availability: 'coming_soon', description: 'Futuras análises avançadas.' },
  { key: 'integrations.thex', name: 'Integração TheX', group: 'integrations', availability: 'coming_soon', description: 'Reserva de espaço para integração futura.' },
  { key: 'integrations.opera', name: 'Integração Opera', group: 'integrations', availability: 'coming_soon', description: 'Reserva de espaço para integração futura.' },
  { key: 'audit.access_logs', name: 'Logs de acesso', group: 'audit', availability: 'coming_soon', description: 'Futura consulta operacional de acessos.' },
] as const;

export function getAdminModule(moduleKey: AdminModuleKey) {
  return ADMIN_MODULE_CATALOG.find((module) => module.key === moduleKey)!;
}
