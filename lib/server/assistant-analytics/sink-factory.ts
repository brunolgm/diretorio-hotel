import 'server-only';

import type { AssistantAnalyticsSink } from './sink.ts';
import { selectAssistantAnalyticsSink } from './sink-selection.ts';
import { SupabaseAssistantAnalyticsSink } from './supabase-sink.ts';

export function createAssistantAnalyticsSinkFromEnvironment(
  enabled = process.env.ASSISTANT_ANALYTICS_PERSISTENCE_ENABLED
): AssistantAnalyticsSink {
  return selectAssistantAnalyticsSink(enabled, () => new SupabaseAssistantAnalyticsSink());
}
