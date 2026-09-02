import 'server-only';

import { randomUUID } from 'node:crypto';
import type { AssistantConversationClient } from '../assistant-chat.ts';
import {
  buildAssistantClassifierPrompt,
  CLASSIFIER_MESSAGE_MAX,
  normalizeAssistantMessage,
  parseAssistantClassification,
  shouldClassifyMessage,
  type AssistantClassification,
} from '../assistant-router/index.ts';

const CONTEXT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AssistantClassifierDependencies {
  createClient(): AssistantConversationClient;
  createContextId?(): string;
}

export async function classifyAssistantMessage(
  message: string,
  guestContextId: string,
  dependencies: AssistantClassifierDependencies
): Promise<AssistantClassification | null> {
  if (message.length > CLASSIFIER_MESSAGE_MAX) return null;
  if (!shouldClassifyMessage(normalizeAssistantMessage(message))) return null;
  const classifierContextId = (dependencies.createContextId ?? randomUUID)();
  if (
    classifierContextId === guestContextId ||
    !CONTEXT_ID_PATTERN.test(classifierContextId)
  ) {
    return null;
  }

  const client = dependencies.createClient();
  const response = await client.converse({
    contextId: classifierContextId,
    prompt: buildAssistantClassifierPrompt(message),
  });
  return parseAssistantClassification(response);
}

/**
 * The remote classifier agent must be isolated: no hotel knowledge base, personality,
 * tools, webhooks, MCP, integrations, or operational training. Its only instruction is
 * to return the closed JSON contract built by buildAssistantClassifierPrompt.
 */
