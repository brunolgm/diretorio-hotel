import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import {
  createAssistantSession,
  getAssistantSessionStorageKey,
  parseAssistantStoredSession,
  saveAssistantSession,
  type AssistantStorage,
} from '../../lib/assistant-chat-session.ts';
import {
  buildHousekeepingClarificationRetryResponse,
  resolveHousekeepingQuantityClarification,
  type ClarificationResolution,
} from '../../lib/assistant-tools/index.ts';
import { routeAssistantMessage } from '../../lib/assistant-router/index.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const CONTEXT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MESSAGE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-08-28T12:00:00.000Z');
const PENDING = {
  kind: 'housekeeping',
  requestType: 'towels',
  language: 'pt',
} as const;

class MemoryStorage implements AssistantStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function pageData() {
  return {
    hotel: {
      name: 'Hotel Teste',
      slug: 'hotel-a',
      checkin_time: null,
      checkout_time: null,
      breakfast_hours: '06:30 - 10:30',
      wifi_name: null,
      website_url: null,
      instagram_url: null,
      booking_url: null,
      whatsapp_number: '+5521999999999',
    },
    sections: [],
    departments: [],
    policies: [],
    announcements: [],
    banners: [],
    layout: [],
    flightHomeCard: null,
    hasFallbackContent: false,
  };
}

function trackedDependencies() {
  const calls = { classifier: 0, client: 0, addContext: 0, converse: 0, prompt: '' };
  return {
    calls,
    dependencies: {
      async getPageDataBySlug() { return pageData() as never; },
      async classifyMessage() {
        calls.classifier += 1;
        return null;
      },
      createClient() {
        calls.client += 1;
        return {
          async addContext() { calls.addContext += 1; },
          async converse(input: { contextId: string; prompt: string }) {
            calls.converse += 1;
            calls.prompt = input.prompt;
            return 'Resposta normal da Maya';
          },
        };
      },
    },
  };
}

function assertResolved(
  resolution: ClarificationResolution,
  quantity: number,
  language: 'pt' | 'en' | 'es'
) {
  assert.equal(resolution.kind, 'resolved');
  if (resolution.kind !== 'resolved') return;
  assert.equal(resolution.request.requestType, 'towels');
  assert.equal(resolution.request.quantity, quantity);
  assert.equal(resolution.detectedLanguage, language);
}

test('resolves safe quantity replies in PT, EN and ES without classification', () => {
  for (const [message, quantity, language] of [
    ['2', 2, 'pt'],
    ['duas', 2, 'pt'],
    ['two', 2, 'en'],
    ['dos', 2, 'es'],
    ['quero duas', 2, 'pt'],
    ['2 toalhas', 2, 'pt'],
    ['s\u00f3 tr\u00eas', 3, 'pt'],
    ['pode ser 4', 4, 'pt'],
  ] as const) {
    assertResolved(
      resolveHousekeepingQuantityClarification(message, PENDING),
      quantity,
      language
    );
  }
});

test('keeps related invalid replies local with a closed retry reason', () => {
  for (const [message, reason] of [
    ['7', 'out_of_range'],
    ['sete', 'out_of_range'],
    ['20', 'out_of_range'],
    ['muitas', 'uncertain'],
    ['n\u00e3o sei', 'uncertain'],
    ['quantas posso pedir?', 'missing_quantity'],
  ] as const) {
    const resolution = resolveHousekeepingQuantityClarification(message, PENDING);
    assert.equal(resolution.kind, 'retry', message);
    if (resolution.kind !== 'retry') continue;
    assert.equal(resolution.reason, reason);
    const response = buildHousekeepingClarificationRetryResponse(
      resolution.reason,
      resolution.detectedLanguage
    );
    assert.equal(response.action, null);
    assert.equal(response.pendingRequest?.requestType, 'towels');
    assert.match(response.answer, /1 (?:e|and|y) 6/);
  }
});

test('invalid quantity retries without classifier or Maya', async () => {
  for (const message of ['7', 'sete']) {
    const tracked = trackedDependencies();
    const result = await runAssistantChat({
      hotelSlug: 'hotel-a',
      language: 'pt',
      contextId: CONTEXT_A,
      message,
      pendingRequest: PENDING,
    }, tracked.dependencies);
    assert.equal(result?.assistantRoute, 'clarification');
    assert.equal(result?.action, null);
    assert.equal(result?.pendingRequest?.requestType, 'towels');
    assert.equal(tracked.calls.classifier, 0);
    assert.equal(tracked.calls.client, 0);
  }
});

test('strong intents still replace and clear a pending clarification', async () => {
  for (const [message, expected] of [
    ['quero falar com atendente', 'open_url'],
    ['meu quarto precisa ser limpo', 'confirm_request'],
  ] as const) {
    const tracked = trackedDependencies();
    const result = await runAssistantChat({
      hotelSlug: 'hotel-a',
      language: 'pt',
      contextId: CONTEXT_A,
      message,
      pendingRequest: PENDING,
    }, tracked.dependencies);
    assert.equal(result?.assistantRoute, 'capability');
    assert.equal(result?.action?.type, expected);
    assert.equal(result?.pendingRequest, null);
    assert.equal(tracked.calls.classifier, 0);
    assert.equal(tracked.calls.client, 0);
  }
});

test('an independent Copacabana question escapes clarification into one direct Maya call', async () => {
  const message = 'O que voc\u00ea recomenda fazer em Copacabana?';
  const decision = routeAssistantMessage({
    message,
    uiLanguage: 'pt',
    pendingRequest: PENDING,
  });
  assert.equal(decision.mode, 'ai');
  assert.equal(decision.assistantRoute, 'ai');

  const tracked = trackedDependencies();
  const result = await runAssistantChat({
    hotelSlug: 'hotel-a',
    language: 'pt',
    contextId: CONTEXT_A,
    message,
    pendingRequest: PENDING,
  }, tracked.dependencies);
  assert.equal(result?.answer, 'Resposta normal da Maya');
  assert.equal(result?.assistantRoute, 'ai');
  assert.equal(result?.pendingRequest, null);
  assert.equal(tracked.calls.classifier, 0);
  assert.equal(tracked.calls.client, 1);
  assert.equal(tracked.calls.addContext, 1);
  assert.equal(tracked.calls.converse, 1);
  assert.equal(tracked.calls.prompt, message);
  assert.deepEqual(result?.usageTrace, {
    resolutionPath: 'direct_ai', classifierCalls: 0, fullAiCalls: 1, totalUpstreamCalls: 1,
  });
});

test('a breakfast question escapes without repeating the towel prompt', async () => {
  const message = 'Qual \u00e9 o hor\u00e1rio do caf\u00e9 da manh\u00e3?';
  const tracked = trackedDependencies();
  const result = await runAssistantChat({
    hotelSlug: 'hotel-a',
    language: 'pt',
    contextId: CONTEXT_A,
    message,
    pendingRequest: PENDING,
  }, tracked.dependencies);
  assert.equal(result?.assistantRoute, 'ai');
  assert.equal(result?.pendingRequest, null);
  assert.doesNotMatch(result?.answer ?? '', /Quantas toalhas|1 e 6 toalhas/);
  assert.equal(tracked.calls.classifier, 0);
  assert.equal(tracked.calls.converse, 1);
});

test('explicit cancellation in PT, EN and ES remains deterministic and clears pending state', async () => {
  for (const [message, language] of [
    ['cancelar', 'pt'],
    ['never mind', 'en'],
    ['déjalo', 'es'],
  ] as const) {
    const pending = { ...PENDING, language };
    const resolution = resolveHousekeepingQuantityClarification(message, pending);
    assert.deepEqual(resolution, { kind: 'cancelled', detectedLanguage: language });
    const tracked = trackedDependencies();
    const result = await runAssistantChat({
      hotelSlug: 'hotel-a', language, contextId: CONTEXT_A,
      message, pendingRequest: pending,
    }, tracked.dependencies);
    assert.equal(result?.assistantRoute, 'deterministic');
    assert.equal(result?.pendingRequest, null);
    assert.equal(result?.action, null);
    assert.match(result?.answer ?? '', /(?:Nada foi enviado|Nothing was sent|No se envió nada)/);
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'deterministic', classifierCalls: 0, fullAiCalls: 0, totalUpstreamCalls: 0,
    });
    assert.equal(tracked.calls.classifier, 0);
    assert.equal(tracked.calls.client, 0);
  }
});

test('new conversation replaces context and clears every previous message and action', () => {
  const storage = new MemoryStorage();
  const previous = createAssistantSession('pt', NOW, () => CONTEXT_A);
  previous.messages = [{
    id: MESSAGE_ID,
    role: 'assistant',
    text: 'Quantas toalhas voc\u00ea precisa?',
    createdAt: NOW.toISOString(),
    language: 'pt',
    action: {
      type: 'confirm_request',
      request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
      label: 'Confirmar solicita\u00e7\u00e3o',
      cancelLabel: 'Cancelar',
    },
  }];
  saveAssistantSession(storage, 'hotel-a', previous);

  const next = createAssistantSession('pt', new Date(NOW.getTime() + 1), () => CONTEXT_B);
  saveAssistantSession(storage, 'hotel-a', next);
  const persisted = parseAssistantStoredSession(
    storage.getItem(getAssistantSessionStorageKey('hotel-a')),
    'pt',
    new Date(NOW.getTime() + 1)
  );
  assert.equal(persisted?.contextId, CONTEXT_B);
  assert.deepEqual(persisted?.messages, []);

  const component = read('components', 'public', 'libguest-ai-chat.tsx');
  const start = component.indexOf('function startNewConversation()');
  const end = component.indexOf('async function sendMessage', start);
  const handler = component.slice(start, end);
  assert.match(handler, /createAssistantSession\(language, new Date\(\), newId\)/);
  assert.match(handler, /sessionRef\.current = session/);
  assert.match(handler, /messagesRef\.current = \[\]/);
  assert.match(handler, /setMessages\(\[\]\)/);
  assert.match(handler, /setPendingRequest\(null\)/);
  assert.match(handler, /setFailedMessage\(null\)/);
  assert.match(handler, /saveAssistantSession\(window\.sessionStorage, hotelSlug, session\)/);
});

test('escape is an internal single re-entry with no duplicate request or rate-limit consumption', () => {
  const router = read('lib', 'assistant-router', 'router.ts');
  const chat = read('lib', 'assistant-chat.ts');
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  assert.match(router, /resolution\.kind === 'escape'[\s\S]*routeAssistantMessageInternal\([\s\S]*true/);
  assert.match(router, /skipPendingClarification/);
  assert.equal((chat.match(/routeAssistantMessage\(\{/g) ?? []).length, 1);
  assert.equal((route.match(/consumeAssistantRateLimit\(/g) ?? []).length, 1);
  assert.doesNotMatch(router, /fetch\(|runAssistantChat|consumeAssistantRateLimit/);
  assert.doesNotMatch(router, /roomToken|hotelId|guestName|reservation/);
});
