import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat, validateAssistantChatPayload } from '../../lib/assistant-chat.ts';
import {
  buildPreparedHousekeepingChatResponse,
  continueHousekeepingQuantityClarification,
  detectHousekeepingContactIntent,
  detectHousekeepingRequestIntent,
  parseAssistantAction,
  parseHousekeepingPendingRequest,
  parseHousekeepingTowelQuantity,
  prepareHousekeepingRequest,
} from '../../lib/assistant-tools/index.ts';
import {
  createAssistantSession,
  getAssistantSessionStorageKey,
  parseAssistantStoredSession,
  saveAssistantSession,
  type AssistantStorage,
} from '../../lib/assistant-chat-session.ts';

const root = process.cwd();
const requestSource = readFileSync(join(root, 'lib', 'assistant-tools', 'request-housekeeping.ts'), 'utf8');
const componentSource = readFileSync(join(root, 'components', 'public', 'libguest-ai-chat.tsx'), 'utf8');
const routeSource = readFileSync(join(root, 'app', 'api', 'assistant', 'chat', 'route.ts'), 'utf8');
const CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';
const NOW = new Date('2026-08-27T12:00:00.000Z');

class MemoryStorage implements AssistantStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function pageData(slug = 'hotel-a') {
  return {
    hotel: { slug },
    departments: [],
    layout: [],
    sections: [],
    policies: [],
    announcements: [],
    banners: [],
    flightHomeCard: null,
    hasFallbackContent: false,
  } as never;
}

test('prepares towels with digits and basic PT, EN and ES number words from one to six', () => {
  assert.deepEqual(prepareHousekeepingRequest('Preciso de duas toalhas')?.request, {
    kind: 'housekeeping', requestType: 'towels', quantity: 2,
  });
  assert.equal(prepareHousekeepingRequest('Preciso de 2 toalhas')?.request.quantity, 2);

  for (const [language, words] of [
    ['en', ['one', 'two', 'three', 'four', 'five', 'six']],
    ['es', ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']],
  ] as const) {
    words.forEach((word, index) => {
      assert.equal(parseHousekeepingTowelQuantity(word, language), index + 1);
    });
  }
  assert.equal(parseHousekeepingTowelQuantity('uma', 'pt'), 1);
  assert.equal(parseHousekeepingTowelQuantity('dois', 'pt'), 2);
  assert.equal(parseHousekeepingTowelQuantity('três', 'pt'), 3);
});

test('asks for clarification and creates no action for absent or out-of-range quantity', () => {
  for (const message of ['Preciso de toalhas', 'Preciso de 7 toalhas']) {
    const prepared = prepareHousekeepingRequest(message);
    assert.ok(prepared);
    assert.equal(prepared.request.requestType, 'towels');
    assert.equal(prepared.request.quantity, null);
    const response = buildPreparedHousekeepingChatResponse(prepared.request, 'pt');
    assert.equal(response.answer, 'Quantas toalhas você precisa?');
    assert.equal(response.action, null);
    assert.deepEqual(response.pendingRequest, {
      kind: 'housekeeping', requestType: 'towels', language: 'pt',
    });
  }
});

test('uses a closed clarification state and accepts only a valid standalone quantity', () => {
  const pending = { kind: 'housekeeping', requestType: 'towels', language: 'es' } as const;
  assert.deepEqual(parseHousekeepingPendingRequest(pending), pending);
  assert.equal(continueHousekeepingQuantityClarification('dos', pending).quantity, 2);
  assert.equal(continueHousekeepingQuantityClarification('7', pending).quantity, null);
  assert.equal(continueHousekeepingQuantityClarification('dos roomToken=secret', pending).quantity, null);
  assert.equal(parseHousekeepingPendingRequest({ ...pending, hotelId: 'private' }), null);
  assert.equal(parseHousekeepingPendingRequest({ ...pending, requestType: 'room_cleaning' }), null);
});

test('prepares room cleaning in PT, EN and ES with quantity fixed to null', () => {
  for (const [message, language] of [
    ['Meu quarto precisa ser limpo', 'pt'],
    ['my room needs cleaning', 'en'],
    ['mi habitación necesita limpieza', 'es'],
  ] as const) {
    const prepared = prepareHousekeepingRequest(message);
    assert.deepEqual(prepared?.detection, {
      intent: 'request_housekeeping', detectedLanguage: language, requestType: 'room_cleaning',
    });
    assert.deepEqual(prepared?.request, {
      kind: 'housekeeping', requestType: 'room_cleaning', quantity: null,
    });
    assert.equal(buildPreparedHousekeepingChatResponse(prepared!.request, language).action?.type, 'confirm_request');
  }
});

test('keeps housekeeping contact and service-request intents disjoint', () => {
  assert.ok(detectHousekeepingContactIntent('quero falar com a governança'));
  assert.equal(detectHousekeepingRequestIntent('quero falar com a governança'), null);
  assert.ok(detectHousekeepingRequestIntent('preciso de duas toalhas'));
  assert.equal(detectHousekeepingContactIntent('preciso de duas toalhas'), null);
});

test('localizes confirmation copy and action from the detected message language', async () => {
  for (const [uiLanguage, message, expectedLanguage, answer, label] of [
    ['en', 'Preciso de duas toalhas', 'pt', /2 toalhas para a Governança/, 'Confirmar solicitação'],
    ['pt', 'I need two towels', 'en', /2 towels for Housekeeping/, 'Confirm request'],
    ['pt', 'necesito dos toallas', 'es', /2 toallas para Gobernanza/, 'Confirmar solicitud'],
  ] as const) {
    const result = await runAssistantChat({
      hotelSlug: 'hotel-a', language: uiLanguage, contextId: CONTEXT_ID, message,
    }, {
      async getPageDataBySlug(_slug, language) {
        assert.equal(language, expectedLanguage);
        return pageData();
      },
      createClient() { throw new Error('GPTMaker must not be created'); },
    });
    assert.match(result?.answer ?? '', answer);
    assert.equal(result?.responseLanguage, expectedLanguage);
    assert.equal(result?.action?.type, 'confirm_request');
    assert.equal(result?.action?.label, label);
  }
});

test('never instantiates GPTMaker for request or clarification', async () => {
  let clientCreated = false;
  const dependencies = {
    async getPageDataBySlug() { return pageData(); },
    createClient() {
      clientCreated = true;
      throw new Error('GPTMaker must not be created');
    },
  };
  const initial = await runAssistantChat({
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'Preciso de toalhas',
  }, dependencies);
  assert.equal(initial?.action, null);
  assert.ok(initial?.pendingRequest);

  const clarified = await runAssistantChat({
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'duas',
    pendingRequest: initial!.pendingRequest!,
  }, dependencies);
  assert.equal(clarified?.action?.type, 'confirm_request');
  assert.equal(clarified?.pendingRequest, null);
  assert.equal(clientCreated, false);
});

test('keeps confirm_request strict, server-owned and free from identifiers or PII', () => {
  const valid = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
    label: 'Confirmar solicitação',
    cancelLabel: 'Cancelar',
  };
  assert.deepEqual(parseAssistantAction(valid), valid);
  for (const invalid of [
    { ...valid, hotelId: 'private' },
    { ...valid, request: { ...valid.request, roomToken: 'private' } },
    { ...valid, request: { ...valid.request, quantity: 0 } },
    { ...valid, request: { ...valid.request, quantity: 7 } },
    { ...valid, request: { ...valid.request, requestType: 'minibar' } },
  ]) {
    assert.equal(parseAssistantAction(invalid), null);
  }
  assert.match(routeSource, /action: result\.action/);
  assert.doesNotMatch(requestSource, /hotelId|roomToken|guestName|reservation|e-?mail|phone/i);
});

test('persists only a valid allowlisted confirm_request action in sessionStorage', () => {
  const storage = new MemoryStorage();
  const session = createAssistantSession('pt', NOW, () => CONTEXT_ID);
  session.messages = [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'assistant',
    text: 'Deseja confirmar?',
    createdAt: NOW.toISOString(),
    language: 'pt',
    action: {
      type: 'confirm_request',
      request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
      label: 'Confirmar solicitação',
      cancelLabel: 'Cancelar',
    },
  }];
  saveAssistantSession(storage, 'hotel-a', session);
  const parsed = parseAssistantStoredSession(
    storage.getItem(getAssistantSessionStorageKey('hotel-a')), 'pt', NOW
  );
  assert.equal(parsed?.messages[0].action?.type, 'confirm_request');

  session.messages[0].action = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 7 },
    label: 'Confirmar',
    cancelLabel: 'Cancelar',
  } as never;
  saveAssistantSession(storage, 'hotel-a', session);
  assert.equal(
    parseAssistantStoredSession(
      storage.getItem(getAssistantSessionStorageKey('hotel-a')), 'pt', NOW
    )?.messages[0].action,
    undefined
  );
});

test('validates the optional clarification payload as a closed browser contract', () => {
  const base = {
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'duas',
  } as const;
  assert.equal(validateAssistantChatPayload({
    ...base,
    pendingRequest: { kind: 'housekeeping', requestType: 'towels', language: 'pt' },
  }).ok, true);
  assert.equal(validateAssistantChatPayload({
    ...base,
    pendingRequest: { kind: 'housekeeping', requestType: 'towels', language: 'pt', roomToken: 'private' },
  }).ok, false);
});

test('confirm and cancel are local-only POC transitions and never claim a real send', () => {
  const handlerStart = componentSource.indexOf('function completePreparedRequest(');
  const handlerEnd = componentSource.indexOf('function handleKeyDown', handlerStart);
  const localHandler = componentSource.slice(handlerStart, handlerEnd);
  assert.match(localHandler, /status: 'prepared' \| 'cancelled'/);
  assert.match(localHandler, /replaceMessages/);
  assert.doesNotMatch(localHandler, /fetch\(|axios|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.match(componentSource, /Solicitação preparada\. O envio à equipe será conectado na próxima etapa\./);
  assert.match(componentSource, /Solicitação cancelada\./);
  assert.doesNotMatch(componentSource, /Solicitação enviada|pedido foi enviado|equipe está a caminho/i);
  assert.doesNotMatch(requestSource, /function executeHousekeepingRequest|const executeHousekeepingRequest/);
  assert.match(requestSource, /confirm_request -> POST \/api\/assistant\/actions\/housekeeping -> n8n/);
});
