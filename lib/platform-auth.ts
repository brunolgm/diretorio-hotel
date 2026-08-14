import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  hasActivePlatformAccess,
  normalizePlatformRole,
  type PlatformRole,
} from '@/lib/platform-roles';

export type PlatformUser = {
  user_id: string;
  role: PlatformRole;
  is_active: true;
};

export async function requirePlatformAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/platform');
  }

  const { data, error } = await supabase.rpc('get_current_platform_access');
  const access = data?.[0];
  const role = normalizePlatformRole(access?.role);

  if (error || !access || !role || !hasActivePlatformAccess(access)) {
    redirect('/acesso-plataforma-negado');
  }

  return {
    user,
    platformUser: {
      user_id: user.id,
      role,
      is_active: true,
    } satisfies PlatformUser,
  };
}
