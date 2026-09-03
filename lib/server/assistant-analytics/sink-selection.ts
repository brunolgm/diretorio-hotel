import type { AssistantAnalyticsSink } from './sink.ts';
import { NoOpAssistantAnalyticsSink } from './sink.ts';
import { isAssistantAnalyticsPersistenceEnabled } from './persistence-contract.ts';

export function selectAssistantAnalyticsSink(
  enabled: string | undefined,
  createPersistentSink: () => AssistantAnalyticsSink
): AssistantAnalyticsSink {
  return isAssistantAnalyticsPersistenceEnabled(enabled)
    ? createPersistentSink()
    : new NoOpAssistantAnalyticsSink();
}
