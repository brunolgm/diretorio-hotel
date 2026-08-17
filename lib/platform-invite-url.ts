export const PLATFORM_INVITE_REDIRECT_URL = 'https://libguest.digital/login';
export const LOCAL_PLATFORM_INVITE_REDIRECT_URL = 'http://localhost:3000/login';

const LOCAL_SUPABASE_ORIGINS = new Set([
  'http://127.0.0.1:54321',
  'http://localhost:54321',
]);

export function resolvePlatformInviteRedirectUrl(supabaseUrl: string) {
  const origin = new URL(supabaseUrl).origin;
  return LOCAL_SUPABASE_ORIGINS.has(origin)
    ? LOCAL_PLATFORM_INVITE_REDIRECT_URL
    : PLATFORM_INVITE_REDIRECT_URL;
}
