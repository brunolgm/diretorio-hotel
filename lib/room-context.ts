import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const ROOM_CONTEXT_COOKIE_NAME = 'lg_room_ctx';
export const ROOM_CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface RoomContextSnapshot {
  roomToken: string;
  roomNumber: string | null;
  hotelId: string | null;
}

export function serializeRoomContext(snapshot: RoomContextSnapshot) {
  return encodeURIComponent(JSON.stringify(snapshot));
}

export function parseRoomContext(value: string | null | undefined): RoomContextSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<RoomContextSnapshot>;

    if (!parsed.roomToken || typeof parsed.roomToken !== 'string') {
      return null;
    }

    return {
      roomToken: parsed.roomToken,
      roomNumber: typeof parsed.roomNumber === 'string' ? parsed.roomNumber : null,
      hotelId: typeof parsed.hotelId === 'string' ? parsed.hotelId : null,
    };
  } catch {
    return null;
  }
}

export async function readRoomContext() {
  const cookieStore = await cookies();
  return parseRoomContext(cookieStore.get(ROOM_CONTEXT_COOKIE_NAME)?.value);
}

export function applyRoomContextCookie(
  response: NextResponse,
  snapshot: RoomContextSnapshot
) {
  response.cookies.set(ROOM_CONTEXT_COOKIE_NAME, serializeRoomContext(snapshot), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ROOM_CONTEXT_MAX_AGE_SECONDS,
  });
}

export function clearRoomContextCookie(response: NextResponse) {
  response.cookies.set(ROOM_CONTEXT_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
