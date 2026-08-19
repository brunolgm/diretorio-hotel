import type { ModuleKey } from '@/lib/modules/catalog';

export const EXPERIENCE_BLOCK_KEYS = [
  'hero',
  'banners',
  'announcements',
  'quick_info',
  'services',
  'departments',
  'policies',
  'contact',
] as const;

export type ExperienceBlockKey = (typeof EXPERIENCE_BLOCK_KEYS)[number];

export type ExperienceBlockDefinition = {
  key: ExperienceBlockKey;
  label: string;
  description: string;
  requiredModule: ModuleKey;
  defaultPosition: number;
  defaultEnabled: boolean;
  required: boolean;
  adminHref: string;
};

export const EXPERIENCE_BLOCK_CATALOG: readonly ExperienceBlockDefinition[] = [
  { key: 'hero', label: 'Hero e identidade', description: 'Apresentação principal e identidade do hotel.', requiredModule: 'core.directory', defaultPosition: 1, defaultEnabled: true, required: true, adminHref: '/admin/hotel' },
  { key: 'banners', label: 'Banners', description: 'Destaques promocionais ativos.', requiredModule: 'content.banners', defaultPosition: 2, defaultEnabled: true, required: false, adminHref: '/admin/banners' },
  { key: 'announcements', label: 'Anúncios e comunicados', description: 'Comunicados vigentes para hóspedes.', requiredModule: 'content.announcements', defaultPosition: 3, defaultEnabled: true, required: false, adminHref: '/admin/comunicados' },
  { key: 'quick_info', label: 'Informações e acessos rápidos', description: 'Atalhos, horários e informações essenciais.', requiredModule: 'core.directory', defaultPosition: 4, defaultEnabled: true, required: false, adminHref: '/admin/hotel' },
  { key: 'services', label: 'Serviços', description: 'Serviços publicados pelo hotel.', requiredModule: 'content.services', defaultPosition: 5, defaultEnabled: true, required: false, adminHref: '/admin/servicos' },
  { key: 'departments', label: 'Departamentos', description: 'Canais de atendimento do hotel.', requiredModule: 'content.departments', defaultPosition: 6, defaultEnabled: true, required: false, adminHref: '/admin/departamentos' },
  { key: 'policies', label: 'Políticas', description: 'Orientações e políticas importantes.', requiredModule: 'content.policies', defaultPosition: 7, defaultEnabled: true, required: false, adminHref: '/admin/politicas' },
  { key: 'contact', label: 'Contato e links úteis', description: 'Canais externos e ajuda ao hóspede.', requiredModule: 'core.directory', defaultPosition: 8, defaultEnabled: true, required: false, adminHref: '/admin/hotel' },
] as const;

export type ExperienceLayoutBlock = {
  blockKey: ExperienceBlockKey;
  isEnabled: boolean;
  position: number;
};

const BLOCK_KEY_SET = new Set<string>(EXPERIENCE_BLOCK_KEYS);

export function isExperienceBlockKey(value: string): value is ExperienceBlockKey {
  return BLOCK_KEY_SET.has(value);
}

export function getDefaultExperienceLayout(): ExperienceLayoutBlock[] {
  return EXPERIENCE_BLOCK_CATALOG.map((block) => ({
    blockKey: block.key,
    isEnabled: block.defaultEnabled,
    position: block.defaultPosition,
  }));
}

export function normalizeExperienceLayout(
  rows: Array<{ block_key: string; is_enabled: boolean; block_position: number }> | null | undefined
): ExperienceLayoutBlock[] {
  if (!rows?.length) return getDefaultExperienceLayout();
  const byKey = new Map(rows.filter((row) => isExperienceBlockKey(row.block_key)).map((row) => [row.block_key, row]));
  return EXPERIENCE_BLOCK_CATALOG.map((definition) => {
    const row = byKey.get(definition.key);
    return {
      blockKey: definition.key,
      isEnabled: definition.required ? true : row?.is_enabled ?? definition.defaultEnabled,
      position: row?.block_position ?? definition.defaultPosition,
    };
  }).sort((a, b) => {
    if (a.blockKey === 'hero') return -1;
    if (b.blockKey === 'hero') return 1;
    return a.position - b.position;
  });
}

export function getRenderableExperienceLayout(
  layout: ExperienceLayoutBlock[],
  enabledModules: ReadonlySet<ModuleKey>
) {
  return layout.filter((item) => {
    if (!item.isEnabled) return false;
    const definition = EXPERIENCE_BLOCK_CATALOG.find((block) => block.key === item.blockKey)!;
    return enabledModules.has(definition.requiredModule);
  });
}

export function getComposedExperienceBlockKeys(
  layout: ExperienceLayoutBlock[],
  renderableKeys: ReadonlySet<ExperienceBlockKey> = new Set(EXPERIENCE_BLOCK_KEYS)
) {
  return [...layout]
    .sort((a, b) => {
      if (a.blockKey === 'hero') return -1;
      if (b.blockKey === 'hero') return 1;
      return a.position - b.position;
    })
    .filter((block) => block.isEnabled && renderableKeys.has(block.blockKey))
    .map((block) => block.blockKey);
}
