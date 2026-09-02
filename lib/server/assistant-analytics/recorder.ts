import type { AssistantAnalyticsSink } from './sink.ts';
import { defaultAssistantAnalyticsSink } from './sink.ts';
import type { AssistantAnalyticsEventInput } from './types.ts';
import { buildAssistantAnalyticsEvent } from './validation.ts';

export async function recordAssistantAnalyticsEvent(
  input: AssistantAnalyticsEventInput,
  sink: AssistantAnalyticsSink = defaultAssistantAnalyticsSink
) {
  try {
    const event = buildAssistantAnalyticsEvent(input);
    await sink.record(event);
  } catch {
    // Best-effort by contract. Never expose analytics failures or guest data.
  }
}
