import type { AssistantAnalyticsEvent } from './types.ts';

export interface AssistantAnalyticsSink {
  record(event: AssistantAnalyticsEvent): Promise<void> | void;
}

export class NoOpAssistantAnalyticsSink implements AssistantAnalyticsSink {
  record(event: AssistantAnalyticsEvent): void {
    void event;
  }
}

export const defaultAssistantAnalyticsSink: AssistantAnalyticsSink =
  new NoOpAssistantAnalyticsSink();
