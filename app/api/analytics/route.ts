import { NextResponse, type NextRequest } from 'next/server';
import { isAnalyticsEventType, isPlainAnalyticsMetadata } from '@/lib/analytics';
import { normalizePublicLanguage } from '@/lib/public-language';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

interface RawAnalyticsPayload {
  hotelId?: unknown;
  hotelSlug?: unknown;
  eventType?: unknown;
  sessionId?: unknown;
  language?: unknown;
  targetUrl?: unknown;
  departmentId?: unknown;
  metadata?: unknown;
}

function sanitizePayload(payload: RawAnalyticsPayload) {
  if (
    typeof payload.hotelId !== 'string' ||
    !payload.hotelId.trim() ||
    typeof payload.hotelSlug !== 'string' ||
    !payload.hotelSlug.trim() ||
    typeof payload.eventType !== 'string' ||
    !isAnalyticsEventType(payload.eventType)
  ) {
    return null;
  }

  const metadata = isPlainAnalyticsMetadata(payload.metadata) ? payload.metadata : {};

  const insertPayload: Database['public']['Tables']['hotel_analytics_events']['Insert'] = {
    hotel_id: payload.hotelId.trim(),
    hotel_slug: payload.hotelSlug.trim(),
    event_type: payload.eventType,
    session_id:
      typeof payload.sessionId === 'string' && payload.sessionId.trim()
        ? payload.sessionId.trim()
        : null,
    language: normalizePublicLanguage(
      typeof payload.language === 'string' ? payload.language : undefined
    ),
    target_url:
      typeof payload.targetUrl === 'string' && payload.targetUrl.trim()
        ? payload.targetUrl.trim()
        : null,
    department_id:
      typeof payload.departmentId === 'string' && payload.departmentId.trim()
        ? payload.departmentId.trim()
        : null,
    metadata,
  };

  return insertPayload;
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = (await request.json()) as RawAnalyticsPayload;
    const payload = sanitizePayload(rawPayload);

    if (!payload) {
      return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: hotel, error: hotelError } = await supabase
      .from('hotels')
      .select('id')
      .eq('id', payload.hotel_id)
      .eq('slug', payload.hotel_slug)
      .maybeSingle();

    if (hotelError || !hotel) {
      return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
    }

    if (payload.department_id) {
      const { data: department, error: departmentError } = await supabase
        .from('hotel_departments')
        .select('id')
        .eq('id', payload.department_id)
        .eq('hotel_id', hotel.id)
        .maybeSingle();

      if (departmentError || !department) {
        return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
      }
    }

    const { error } = await supabase.from('hotel_analytics_events').insert(payload);

    if (error) {
      console.error('Failed to store analytics event:', error);
      return NextResponse.json({ error: 'N\u00e3o foi poss\u00edvel registrar o evento.' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to parse analytics request:', error);
    return NextResponse.json({ error: 'Requisi\u00e7\u00e3o inv\u00e1lida.' }, { status: 400 });
  }
}
