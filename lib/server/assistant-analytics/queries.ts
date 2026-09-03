import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  normalizeAssistantAnalyticsPeriod,
  normalizeAssistantAnalyticsSummary,
  type AssistantAnalyticsPeriodInput,
} from './query-contract.ts';

async function requireNormalizedSummary(
  request: PromiseLike<{ data: unknown; error: unknown }>
) {
  const { data, error } = await request;
  if (error) throw new Error('Unable to load assistant analytics summary');
  const summary = normalizeAssistantAnalyticsSummary(data);
  if (!summary) throw new Error('Invalid assistant analytics summary contract');
  return summary;
}

export async function getHotelAssistantAnalyticsSummary(
  hotelId: string,
  period: AssistantAnalyticsPeriodInput
) {
  const { from, to } = normalizeAssistantAnalyticsPeriod(period);
  const client = await createClient();
  return requireNormalizedSummary(client.rpc('get_hotel_assistant_analytics_summary', {
    p_hotel_id: hotelId,
    p_from: from,
    p_to: to,
  }));
}

export async function getPlatformAssistantAnalyticsSummary(
  period: AssistantAnalyticsPeriodInput,
  hotelId?: string | null
) {
  const { from, to } = normalizeAssistantAnalyticsPeriod(period);
  const client = await createClient();
  return requireNormalizedSummary(client.rpc('get_platform_assistant_analytics_summary', {
    p_from: from,
    p_to: to,
    p_hotel_id: hotelId ?? null,
  }));
}
