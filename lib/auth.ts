import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  APP_ROLE_OPTIONS,
  AppRole,
  getRoleLabel,
  hasMinimumRole,
  normalizeAppRole,
} from '@/lib/app-roles';
import type { Database } from '@/types/database';
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type AdminProfile = ProfileRow & {
  normalizedRole: AppRole;
};

export { APP_ROLE_OPTIONS, getRoleLabel, hasMinimumRole, normalizeAppRole };
export type { AppRole };

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

export async function requireAdminAccess(requiredRole: AppRole = 'visualizador') {
  const supabase = await createClient();
  const user = await requireUser();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const normalizedRole = normalizeAppRole(profile?.role);
  const isActive = profile?.is_active ?? true;

  if (
    error ||
    !profile ||
    !profile.hotel_id ||
    !normalizedRole ||
    !isActive ||
    !hasMinimumRole(normalizedRole, requiredRole)
  ) {
    redirect('/login');
  }

  return {
    user,
    profile: {
      ...profile,
      is_active: isActive,
      normalizedRole,
    } satisfies AdminProfile,
  };
}

export async function requireAdmin() {
  const { user } = await requireAdminAccess('administrador');
  return user;
}

export async function getUserProfile() {
  const { profile } = await requireAdminAccess('visualizador');
  return profile;
}
