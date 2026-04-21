export const APP_ROLE_OPTIONS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'operador', label: 'Operador' },
  { value: 'visualizador', label: 'Visualizador' },
] as const;

export type AppRole = (typeof APP_ROLE_OPTIONS)[number]['value'];

const ROLE_ALIASES: Record<string, AppRole> = {
  owner: 'administrador',
  admin: 'administrador',
  administrador: 'administrador',
  editor: 'editor',
  operador: 'operador',
  visualizador: 'visualizador',
};

const ROLE_LEVELS: Record<AppRole, number> = {
  visualizador: 1,
  operador: 2,
  editor: 3,
  administrador: 4,
};

export function normalizeAppRole(role: string | null | undefined): AppRole | null {
  const normalized = role?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return ROLE_ALIASES[normalized] || null;
}

export function hasMinimumRole(role: AppRole, requiredRole: AppRole) {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[requiredRole];
}

export function getRoleLabel(role: AppRole) {
  return APP_ROLE_OPTIONS.find((option) => option.value === role)?.label || role;
}
