import { NextResponse } from 'next/server';
import { clearRoomContextCookie } from '@/lib/room-context';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const referer = request.headers.get('referer');
  const fallbackUrl = new URL('/', requestUrl);
  let destination = fallbackUrl;

  if (referer) {
    try {
      const refererUrl = new URL(referer);

      if (refererUrl.origin === requestUrl.origin) {
        destination = refererUrl;
      }
    } catch {
      destination = fallbackUrl;
    }
  }

  const response = NextResponse.redirect(destination);
  clearRoomContextCookie(response);
  return response;
}
