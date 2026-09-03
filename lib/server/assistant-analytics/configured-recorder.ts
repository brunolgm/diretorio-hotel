import 'server-only';

import { recordAssistantAnalyticsEvent } from './recorder.ts';
import { createAssistantAnalyticsSinkFromEnvironment } from './sink-factory.ts';
import type { AssistantAnalyticsEventInput } from './types.ts';

const configuredSink = createAssistantAnalyticsSinkFromEnvironment();

export function recordConfiguredAssistantAnalyticsEvent(input: AssistantAnalyticsEventInput) {
  return recordAssistantAnalyticsEvent(input, configuredSink);
}
