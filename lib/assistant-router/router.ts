import { resolveHousekeepingQuantityClarification } from '../assistant-tools/request-housekeeping.ts';
import { isOpenTourismQuestion } from '../assistant-tourism.ts';
import { normalizeAssistantMessage } from './normalize.ts';
import { detectStrongAssistantIntent } from './strong-intents.ts';
import { shouldClassifyMessage } from './classification.ts';
import type { AssistantRouteDecision, AssistantRouterInput } from './types.ts';

function routeAssistantMessageInternal(
  input: AssistantRouterInput,
  skipPendingClarification: boolean
): AssistantRouteDecision {
  const message = normalizeAssistantMessage(input.message);
  const strongIntent = detectStrongAssistantIntent(message.original);

  if (strongIntent) {
    return {
      mode: 'capability',
      assistantRoute: 'capability',
      message,
      ...strongIntent,
    };
  }

  if (input.pendingRequest && !skipPendingClarification) {
    const resolution = resolveHousekeepingQuantityClarification(
      message.original,
      input.pendingRequest
    );
    if (resolution.kind === 'cancelled') {
      return {
        mode: 'deterministic',
        assistantRoute: 'deterministic',
        outcome: 'clarification_cancelled',
        detectedLanguage: resolution.detectedLanguage,
        message,
      };
    }

    if (resolution.kind === 'escape') {
      return routeAssistantMessageInternal(
        { message: message.original, uiLanguage: input.uiLanguage },
        true
      );
    }

    return {
      mode: 'clarification',
      assistantRoute: 'clarification',
      resolution,
      detectedLanguage: resolution.detectedLanguage,
      message,
    };
  }

  if (shouldClassifyMessage(message)) {
    return {
      mode: 'classification',
      assistantRoute: 'classification',
      uiLanguage: input.uiLanguage,
      message,
    };
  }

  if (isOpenTourismQuestion(message)) {
    return {
      mode: 'tourism',
      assistantRoute: 'ai',
      reason: 'open_tourism',
      message,
    };
  }

  return {
    mode: 'ai',
    assistantRoute: 'ai',
    reason: message.original.includes('?')
      ? 'open_question'
      : message.normalized.split(' ').length > 1
        ? 'general_chat'
        : 'ambiguous',
    message,
  };
}

export function routeAssistantMessage(input: AssistantRouterInput): AssistantRouteDecision {
  return routeAssistantMessageInternal(input, false);
}

export function shouldCallAI(decision: AssistantRouteDecision) {
  return decision.mode === 'ai' || decision.mode === 'tourism';
}
