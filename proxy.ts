import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeAppRole } from '@/lib/app-roles';
import { resolveAuthenticatedDestination } from '@/lib/auth-destination';
import { getRequiredEnvVar } from '@/lib/env';
import { hasActivePlatformAccess } from '@/lib/platform-roles';
import type { Database } from '@/types/database';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isPlatformRoute = request.nextUrl.pathname.startsWith('/platform');

  if ((isAdminRoute || isPlatformRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (isPlatformRoute) {
      url.searchParams.set('next', '/platform');
    }
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const [profileResult, platformResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('role, hotel_id, is_active')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.rpc('get_current_platform_access'),
    ]);
    const profile = profileResult.data;
    const platformAccess = platformResult.data?.[0];
    const hasHotelAccess = Boolean(
      !profileResult.error &&
        profile?.hotel_id &&
        profile.is_active &&
        normalizeAppRole(profile.role)
    );
    const hasPlatformAccess = Boolean(
      !platformResult.error && platformAccess && hasActivePlatformAccess(platformAccess)
    );
    const destination = resolveAuthenticatedDestination({
      requestedPath: request.nextUrl.searchParams.get('next'),
      hasHotelAccess,
      hasPlatformAccess,
    });
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*', '/login'],
};
