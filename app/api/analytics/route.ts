import { NextResponse, type NextRequest } from 'next/server';
import { ANALYTICS_LIMITS, validateAnalyticsPayload } from '@/lib/analytics';
import { isJsonContentType, readUtf8BodyWithLimit } from '@/lib/security/http';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function POST(request: NextRequest) {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 415 });
  }

  try {
    const body = await readUtf8BodyWithLimit(request, ANALYTICS_LIMITS.bodyBytes);
    if (!body.ok) {
      return NextResponse.json(
        { error: body.reason === 'too_large' ? 'Payload muito grande.' : 'Requisição inválida.' },
        { status: body.reason === 'too_large' ? 413 : 400 }
      );
    }

    const validation = validateAnalyticsPayload(JSON.parse(body.text) as unknown);

    if (!validation.ok) {
      return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
    }

    const payload = validation.value;

    const supabase = await createClient();
    const { data: hotel, error: hotelError } = await supabase
      .from('hotels')
      .select('id')
      .eq('slug', payload.hotelSlug)
      .maybeSingle();

    if (hotelError || !hotel) {
      return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
    }

    const insertPayload: Database['public']['Tables']['hotel_analytics_events']['Insert'] = {
      hotel_id: hotel.id,
      hotel_slug: payload.hotelSlug,
      event_type: payload.eventType,
      session_id: payload.sessionId,
      language: payload.language,
      target_url: payload.targetUrl,
      department_id: payload.departmentId,
      metadata: payload.metadata,
    };

    if (payload.departmentId) {
      const { data: department, error: departmentError } = await supabase
        .from('hotel_departments')
        .select('id')
        .eq('id', payload.departmentId)
        .eq('hotel_id', hotel.id)
        .maybeSingle();

      if (departmentError || !department) {
        return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
      }
    }

    const { error } = await supabase.from('hotel_analytics_events').insert(insertPayload);

    if (error) {
      console.error('[analytics] event insert failed', { code: error.code });
      return NextResponse.json({ error: 'N\u00e3o foi poss\u00edvel registrar o evento.' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Requisi\u00e7\u00e3o inv\u00e1lida.' }, { status: 400 });
  }
}
