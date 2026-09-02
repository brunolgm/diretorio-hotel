import type { AssistantAnalyticsEvent } from '../../lib/server/assistant-analytics/types.ts';
import type { AssistantAnalyticsSink } from '../../lib/server/assistant-analytics/sink.ts';

export class TestAssistantAnalyticsSink implements AssistantAnalyticsSink {
  readonly events: AssistantAnalyticsEvent[] = [];

  record(event: AssistantAnalyticsEvent) {
    this.events.push(event);
  }
}
