import { NextResponse, type NextRequest } from 'next/server';
import { ANALYTICS_LIMITS, validateAnalyticsPayload } from '@/lib/analytics';
import { isJsonContentType, readUtf8BodyWithLimit } from '@/lib/security/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import type { Database } from '@/types/database';
import { isHotelModuleEnabled } from '@/lib/server-entitlements';

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

    const supabase = createPublicClient();
    const { data: hotel, error: hotelError } = await supabase
      .from('public_hotels')
      .select('id')
      .eq('slug', payload.hotelSlug)
      .maybeSingle();

    if (hotelError || !hotel) {
      return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
    }

    if (!(await isHotelModuleEnabled(hotel.id, 'analytics.basic'))) {
      return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
    }

    const insertPayload: Database['public']['Tables']['hotel_analytics_events']['Insert'] = {
      hotel_id: hotel.id,
      hotel_slug: payload.hotelSlug,
      event_type: payload.eventType,
      session_id: null,
      language: payload.language,
      target_url: null,
      department_id: payload.departmentId,
      service_id: payload.serviceId,
      metadata: payload.action ? { action: payload.action } : {},
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

    if (payload.serviceId) {
      const { data: service, error: serviceError } = await supabase
        .from('hotel_sections')
        .select('id')
        .eq('id', payload.serviceId)
        .eq('hotel_id', hotel.id)
        .maybeSingle();

      if (serviceError || !service) {
        return NextResponse.json({ error: 'Evento inv\u00e1lido.' }, { status: 400 });
      }
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('hotel_analytics_events').insert(insertPayload);

    if (error) {
      console.error('[analytics] event insert failed', { code: error.code });
      return NextResponse.json({ error: 'N\u00e3o foi poss\u00edvel registrar o evento.' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Requisi\u00e7\u00e3o inv\u00e1lida.' }, { status: 400 });
  }
}
