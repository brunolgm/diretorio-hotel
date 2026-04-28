import { NextResponse } from 'next/server';
import {
  buildHotelPublicEntryUrl,
  findActiveRoomLinkByToken,
  findHotelById,
} from '@/lib/room-links';
import { applyRoomContextCookie, clearRoomContextCookie } from '@/lib/room-context';

interface RouteProps {
  params: Promise<{
    roomToken: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { roomToken } = await params;
  const normalizedToken = roomToken.trim();
  const requestUrl = new URL(_request.url);

  if (!normalizedToken) {
    const response = NextResponse.redirect(new URL('/qr-invalido', requestUrl));
    clearRoomContextCookie(response);
    return response;
  }

  const roomLink = await findActiveRoomLinkByToken(normalizedToken);

  if (!roomLink) {
    const response = NextResponse.redirect(new URL('/qr-invalido', requestUrl));
    clearRoomContextCookie(response);
    return response;
  }

  const hotel = await findHotelById(roomLink.hotel_id);

  if (!hotel) {
    const response = NextResponse.redirect(new URL('/qr-invalido', requestUrl));
    clearRoomContextCookie(response);
    return response;
  }

  const destination = buildHotelPublicEntryUrl(hotel, requestUrl);
  const response = NextResponse.redirect(destination);
  applyRoomContextCookie(response, {
    roomToken: roomLink.room_token,
    roomNumber: roomLink.room_number,
    hotelId: roomLink.hotel_id,
  });

  return response;
}
