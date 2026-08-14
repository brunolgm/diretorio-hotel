export const PLATFORM_ROLE_OPTIONS = [
  { value: 'platform_admin', label: 'Administrador da plataforma' },
] as const;

export type PlatformRole = (typeof PLATFORM_ROLE_OPTIONS)[number]['value'];

export function normalizePlatformRole(role: string | null | undefined): PlatformRole | null {
  const normalized = role?.trim().toLowerCase();

  return normalized === 'platform_admin' ? normalized : null;
}

export function hasActivePlatformAccess({
  role,
  is_active,
}: {
  role: string | null | undefined;
  is_active: boolean | null | undefined;
}) {
  return is_active === true && normalizePlatformRole(role) !== null;
}
