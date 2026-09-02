import 'server-only';

import {
  isSuccessfulGptMakerAcknowledgement,
  parseGptMakerAnswer,
  type AssistantConversationClient,
} from '../assistant-chat.ts';
import { resolveDedicatedClassifierAgentId } from '../gptmaker-agent-selection.ts';

const GPTMAKER_BASE_URL = 'https://api.gptmaker.ai';
const DEFAULT_TIMEOUT_MS = 10_000;
const AGENT_ID_PATTERN = /^[A-F0-9]{32}$/i;

export type GptMakerErrorKind =
  | 'configuration'
  | 'timeout'
  | 'authentication'
  | 'rate_limited'
  | 'invalid_response'
  | 'upstream';

export class GptMakerError extends Error {
  constructor(readonly kind: GptMakerErrorKind) {
    super('GPTMaker request failed');
    this.name = 'GptMakerError';
  }
}

interface GptMakerClientOptions {
  apiKey: string;
  agentId: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}

export class GptMakerClient implements AssistantConversationClient {
  private readonly apiKey: string;
  private readonly agentId: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GptMakerClientOptions) {
    const apiKey = options.apiKey.trim();
    const agentId = options.agentId.trim();
    if (!apiKey || !AGENT_ID_PATTERN.test(agentId)) {
      throw new GptMakerError('configuration');
    }

    this.apiKey = apiKey;
    this.agentId = agentId;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async addContext(input: { contextId: string; prompt: string; role: 'user' }) {
    const response = await this.post('add-message', input);
    if (!isSuccessfulGptMakerAcknowledgement(response)) {
      throw new GptMakerError('invalid_response');
    }
  }

  async converse(input: { contextId: string; prompt: string }) {
    const response = await this.post('conversation', input);
    const message = parseGptMakerAnswer(response);
    if (!message) throw new GptMakerError('invalid_response');
    return message;
  }

  private async post(path: 'add-message' | 'conversation', payload: object) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        `${GPTMAKER_BASE_URL}/v2/agent/${encodeURIComponent(this.agentId)}/${path}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const kind = response.status === 429
          ? 'rate_limited'
          : response.status === 401 || response.status === 403
            ? 'authentication'
            : 'upstream';
        throw new GptMakerError(kind);
      }

      try {
        return await response.json() as unknown;
      } catch {
        throw new GptMakerError('invalid_response');
      }
    } catch (error) {
      if (error instanceof GptMakerError) throw error;
      if (controller.signal.aborted) throw new GptMakerError('timeout');
      throw new GptMakerError('upstream');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createGptMakerClientFromEnvironment() {
  return new GptMakerClient({
    apiKey: process.env.GPTMAKER_API_KEY ?? '',
    agentId: process.env.GPTMAKER_AGENT_ID ?? '',
  });
}

export function createGptMakerClassifierClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
) {
  const classifierAgentId = resolveGptMakerClassifierAgentId(environment);
  const apiKey = (environment.GPTMAKER_API_KEY ?? '').trim();
  if (!apiKey || !classifierAgentId) return null;
  return new GptMakerClient({ apiKey, agentId: classifierAgentId });
}

export function resolveGptMakerClassifierAgentId(environment: NodeJS.ProcessEnv) {
  return resolveDedicatedClassifierAgentId({
    mayaAgentId: environment.GPTMAKER_AGENT_ID,
    classifierAgentId: environment.GPTMAKER_CLASSIFIER_AGENT_ID,
  });
}
