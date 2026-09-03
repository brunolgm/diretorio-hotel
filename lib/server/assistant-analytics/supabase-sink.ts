import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AssistantAnalyticsSink } from './sink.ts';
import type { AssistantAnalyticsEvent } from './types.ts';
import {
  persistAssistantAnalyticsEvent,
  type AssistantAnalyticsRpc,
} from './persistence-contract.ts';

export class SupabaseAssistantAnalyticsSink implements AssistantAnalyticsSink {
  constructor(private readonly rpc: AssistantAnalyticsRpc = async (args) => {
    const client = createAdminClient();
    return client.rpc('record_assistant_analytics_event', args);
  }) {}

  async record(event: AssistantAnalyticsEvent) {
    await persistAssistantAnalyticsEvent(event, this.rpc);
  }
}
