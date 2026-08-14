export type AuthDestination = '/admin' | '/platform' | '/acesso-indisponivel';

export function resolveAuthenticatedDestination({
  requestedPath,
  hasHotelAccess,
  hasPlatformAccess,
}: {
  requestedPath?: string | null;
  hasHotelAccess: boolean;
  hasPlatformAccess: boolean;
}): AuthDestination {
  if (requestedPath === '/platform' && hasPlatformAccess) {
    return '/platform';
  }

  // Preserve the existing hotel-admin destination for generic logins and dual identities.
  if (hasHotelAccess) {
    return '/admin';
  }

  if (hasPlatformAccess) {
    return '/platform';
  }

  return '/acesso-indisponivel';
}
