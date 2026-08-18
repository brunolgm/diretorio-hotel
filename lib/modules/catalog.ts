export const MODULE_KEYS = [
  'core.directory', 'content.services', 'content.departments', 'content.policies',
  'content.announcements', 'content.banners', 'rooms.qr', 'content.languages',
  'experience.appearance', 'experience.navigation', 'experience.preview', 'experience.seo',
  'fb.menu', 'content.tourism', 'analytics.basic', 'analytics.advanced',
  'integrations.thex', 'integrations.opera', 'audit.access_logs',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type ModuleAvailability = 'available' | 'coming_soon';
export type ModuleGroup = 'experience' | 'content' | 'operations' | 'analytics' | 'integrations' | 'governance';

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  group: ModuleGroup;
  availability: ModuleAvailability;
  description: string;
}

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  experience: 'Experiência', content: 'Conteúdo', operations: 'Operação',
  analytics: 'Analytics', integrations: 'Integrações', governance: 'Governança',
};

export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  { key: 'core.directory', name: 'Diretório do hotel', group: 'experience', availability: 'available', description: 'Experiência pública principal do hotel.' },
  { key: 'content.services', name: 'Serviços', group: 'content', availability: 'available', description: 'Serviços publicados para hóspedes.' },
  { key: 'content.departments', name: 'Departamentos', group: 'content', availability: 'available', description: 'Canais operacionais do hotel.' },
  { key: 'content.policies', name: 'Políticas', group: 'content', availability: 'available', description: 'Políticas e orientações do hotel.' },
  { key: 'content.announcements', name: 'Anúncios', group: 'content', availability: 'available', description: 'Anúncios e comunicados vigentes.' },
  { key: 'content.banners', name: 'Banners', group: 'content', availability: 'available', description: 'Destaques visuais da experiência pública.' },
  { key: 'rooms.qr', name: 'Apartamentos e QR', group: 'operations', availability: 'available', description: 'Links por apartamento e contexto por QR.' },
  { key: 'content.languages', name: 'Idiomas', group: 'content', availability: 'available', description: 'Conteúdo traduzido em PT, EN e ES.' },
  { key: 'experience.appearance', name: 'Aparência', group: 'experience', availability: 'available', description: 'Identidade visual e tema da experiência.' },
  { key: 'experience.navigation', name: 'Composição', group: 'experience', availability: 'available', description: 'Ordem e visibilidade dos blocos da experiência pública.' },
  { key: 'experience.preview', name: 'Pré-visualização', group: 'experience', availability: 'available', description: 'Preview público real executado em sandbox.' },
  { key: 'experience.seo', name: 'SEO e compartilhamento', group: 'experience', availability: 'coming_soon', description: 'Metadados e compartilhamento futuros.' },
  { key: 'fb.menu', name: 'Cardápio (F&B)', group: 'content', availability: 'coming_soon', description: 'Módulo futuro de alimentos e bebidas.' },
  { key: 'content.tourism', name: 'Turismo', group: 'content', availability: 'coming_soon', description: 'Conteúdo futuro de turismo local.' },
  { key: 'analytics.basic', name: 'Analytics básico', group: 'analytics', availability: 'available', description: 'Indicadores operacionais atuais.' },
  { key: 'analytics.advanced', name: 'Analytics avançado', group: 'analytics', availability: 'coming_soon', description: 'Análises avançadas futuras.' },
  { key: 'integrations.thex', name: 'Integração TheX', group: 'integrations', availability: 'coming_soon', description: 'Integração futura com TheX.' },
  { key: 'integrations.opera', name: 'Integração Opera', group: 'integrations', availability: 'coming_soon', description: 'Integração futura com Opera.' },
  { key: 'audit.access_logs', name: 'Logs de acesso', group: 'governance', availability: 'coming_soon', description: 'Consulta operacional futura de acessos.' },
] as const;

export const BASELINE_MODULE_KEYS = [
  'core.directory',
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
  'analytics.basic',
] as const satisfies readonly ModuleKey[];

const MODULE_KEY_SET = new Set<string>(MODULE_KEYS);

export function isModuleKey(value: string): value is ModuleKey { return MODULE_KEY_SET.has(value); }
export function getModule(moduleKey: ModuleKey) { return MODULE_CATALOG.find((module) => module.key === moduleKey)!; }
