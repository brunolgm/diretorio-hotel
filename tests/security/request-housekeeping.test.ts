import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat, validateAssistantChatPayload } from '../../lib/assistant-chat.ts';
import {
  buildPreparedHousekeepingChatResponse,
  continueHousekeepingQuantityClarification,
  detectHousekeepingCancellationWithoutPending,
  detectHousekeepingPreparationCancellation,
  detectHousekeepingPreparationCancellationTarget,
  detectHousekeepingContactIntent,
  detectHousekeepingRequestIntent,
  parseAssistantAction,
  parseHousekeepingPendingRequest,
  parseHousekeepingTowelQuantity,
  prepareHousekeepingRequest,
} from '../../lib/assistant-tools/index.ts';
import {
  consumeLocalAssistantInteraction,
  createAssistantSession,
  findPreparedRequestCancellationTarget,
  getAssistantSessionStorageKey,
  parseAssistantStoredSession,
  removePreparedRequestAction,
  resetLocalAssistantInteraction,
  resolveAssistantErrorMessage,
  saveAssistantSession,
  type AssistantChatMessage,
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

test('detects contextual preparation cancellation in PT, EN and ES without generic negatives', () => {
  for (const [message, language] of [
    ['Não quero mais.', 'pt'],
    ['Never mind.', 'en'],
    ['Ya no lo quiero.', 'es'],
  ] as const) {
    assert.equal(detectHousekeepingPreparationCancellation(message, language), language);
  }
  for (const message of [
    'Não quero falar sobre isso agora.',
    'Não encontrei toalhas no site.',
    'As toalhas estavam bem dobradas.',
  ]) {
    assert.equal(detectHousekeepingCancellationWithoutPending(message), null);
  }
});

test('detects only a targeted housekeeping cancellation without local state', () => {
  for (const [message, language] of [
    ['Quero cancelar o pedido de toalhas.', 'pt'],
    ['I want to cancel the towel request.', 'en'],
    ['Quiero cancelar el pedido de toallas.', 'es'],
  ] as const) {
    assert.equal(detectHousekeepingCancellationWithoutPending(message), language);
  }
  assert.equal(detectHousekeepingCancellationWithoutPending('Cancelar.'), null);
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

test('typed cancellation selects the matching request type and preserves unrelated cards', () => {
  const towelsAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
    label: 'Confirmar solicitação',
    cancelLabel: 'Cancelar',
  } as const;
  const cleaningAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
    label: 'Confirmar solicitação',
    cancelLabel: 'Cancelar',
  } as const;
  const messages = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'assistant', text: 'Toalhas?', createdAt: NOW.toISOString(), language: 'pt', action: towelsAction },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'assistant', text: 'Limpeza?', createdAt: NOW.toISOString(), language: 'pt', action: cleaningAction },
  ] as const;

  const towelsTarget = findPreparedRequestCancellationTarget(
    messages,
    'Cancelar pedido de toalhas.',
    'pt'
  );
  assert.ok(towelsTarget);
  assert.equal(towelsTarget.messageId, messages[0].id);
  const towelsCleared = removePreparedRequestAction(messages, towelsTarget);
  assert.ok(towelsCleared);
  assert.equal(towelsCleared[0].action, undefined);
  assert.equal(towelsCleared[1].action, cleaningAction);

  const cleaningTarget = findPreparedRequestCancellationTarget(
    messages,
    'Quero cancelar o pedido de limpeza.',
    'pt'
  );
  assert.ok(cleaningTarget);
  assert.equal(cleaningTarget.messageId, messages[1].id);

  const genericTarget = findPreparedRequestCancellationTarget(messages, 'Não quero mais.', 'pt');
  assert.ok(genericTarget);
  assert.equal(genericTarget.messageId, messages[1].id);
  assert.equal(findPreparedRequestCancellationTarget(messages, 'Duas toalhas.', 'pt'), null);
  assert.deepEqual(detectHousekeepingPreparationCancellationTarget(
    'Cancelar pedido de toalhas.',
    'pt'
  ), { detectedLanguage: 'pt', requestType: 'towels' });
});

test('exact PT cleaning cancellation stays local and preserves a newer towels card', () => {
  const cleaningAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
    label: 'Confirmar solicitação', cancelLabel: 'Cancelar',
  } as const;
  const towelsAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
    label: 'Confirmar solicitação', cancelLabel: 'Cancelar',
  } as const;
  const initialMessages: AssistantChatMessage[] = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'assistant', text: 'Limpeza?', createdAt: NOW.toISOString(), language: 'pt', action: cleaningAction },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'assistant', text: 'Toalhas?', createdAt: NOW.toISOString(), language: 'pt', action: towelsAction },
  ];
  let messages = initialMessages;
  let fetchCalls = 0;
  let classifierCalls = 0;
  let mayaCalls = 0;

  function handleClientMessage(message: string) {
    const target = findPreparedRequestCancellationTarget(messages, message, 'pt');
    if (!target) {
      fetchCalls += 1;
      classifierCalls += 1;
      mayaCalls += 1;
      return 'fetch';
    }
    const next = removePreparedRequestAction(messages, target);
    assert.ok(next);
    messages = next;
    return 'local';
  }

  assert.deepEqual(
    detectHousekeepingPreparationCancellationTarget(
      'Cancelar o pedido de limpeza.',
      'pt'
    ),
    { detectedLanguage: 'pt', requestType: 'room_cleaning' }
  );
  assert.equal(handleClientMessage('Cancelar o pedido de limpeza.'), 'local');
  assert.equal(messages[0].action, undefined);
  assert.equal(messages[1].action, towelsAction);
  assert.equal(fetchCalls, 0);
  assert.equal(classifierCalls, 0);
  assert.equal(mayaCalls, 0);

  for (const [message, requestType] of [
    ['Quero cancelar o pedido de limpeza.', 'room_cleaning'],
    ['Cancelar pedido de limpeza.', 'room_cleaning'],
    ['Cancelar o pedido de toalhas.', 'towels'],
  ] as const) {
    assert.equal(
      detectHousekeepingPreparationCancellationTarget(message, 'pt')?.requestType,
      requestType
    );
    assert.equal(
      findPreparedRequestCancellationTarget(initialMessages, message, 'pt')
        ?.action.request.requestType,
      requestType
    );
  }
});

test('one draft generation consumes at most one local card across consecutive events', async () => {
  const towelsAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
    label: 'Confirmar solicitação', cancelLabel: 'Cancelar',
  } as const;
  const cleaningAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
    label: 'Confirmar solicitação', cancelLabel: 'Cancelar',
  } as const;
  let messages: AssistantChatMessage[] = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'assistant', text: 'Toalhas?', createdAt: NOW.toISOString(), language: 'pt', action: towelsAction },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'assistant', text: 'Limpeza?', createdAt: NOW.toISOString(), language: 'pt', action: cleaningAction },
  ];
  const guard = { consumedDraftGeneration: null as number | null };
  const localUserMessages: string[] = [];
  const localAssistantMessages: string[] = [];

  function consumeDraft(draft: string, generation: number) {
    const target = findPreparedRequestCancellationTarget(messages, draft, 'pt');
    if (!target || !consumeLocalAssistantInteraction(guard, generation)) return false;
    const next = removePreparedRequestAction(messages, target);
    assert.ok(next);
    messages = next;
    localUserMessages.push(draft);
    localAssistantMessages.push('descartada localmente');
    return true;
  }

  assert.equal(consumeDraft('Não quero mais.', 1), true);
  assert.equal(messages[1].action, undefined);
  assert.equal(messages[0].action, towelsAction);
  await Promise.resolve();
  assert.equal(consumeDraft('Não quero mais.', 1), false);
  assert.equal(messages[0].action, towelsAction);
  assert.deepEqual(localUserMessages, ['Não quero mais.']);
  assert.deepEqual(localAssistantMessages, ['descartada localmente']);

  assert.equal(consumeDraft('Cancelar pedido de toalhas.', 2), true);
  assert.equal(messages[0].action, undefined);
  assert.equal(findPreparedRequestCancellationTarget(messages, 'Onde fica o café?', 'pt'), null);

  resetLocalAssistantInteraction(guard);
  assert.equal(guard.consumedDraftGeneration, null);
  assert.equal(consumeLocalAssistantInteraction(guard, 0), true);
});

test('directed card selection works in PT, EN and ES and rejects incompatible targets', () => {
  const towelsAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'towels', quantity: 2 },
    label: 'Confirm', cancelLabel: 'Cancel',
  } as const;
  const cleaningAction = {
    type: 'confirm_request',
    request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
    label: 'Confirm', cancelLabel: 'Cancel',
  } as const;
  const towelsFirst = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'assistant', text: 'Towels?', createdAt: NOW.toISOString(), action: towelsAction },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'assistant', text: 'Cleaning?', createdAt: NOW.toISOString(), action: cleaningAction },
  ] as const;
  const cleaningFirst = [...towelsFirst].reverse();

  for (const [language, towelsMessage, cleaningMessage] of [
    ['pt', 'Cancelar pedido de toalhas.', 'Quero cancelar o pedido de limpeza.'],
    ['en', 'Cancel the towel request.', 'Cancel the room cleaning request.'],
    ['es', 'Cancelar el pedido de toallas.', 'Quiero cancelar la solicitud de limpieza.'],
  ] as const) {
    assert.equal(
      findPreparedRequestCancellationTarget(towelsFirst, towelsMessage, language)?.action,
      towelsAction
    );
    assert.equal(
      findPreparedRequestCancellationTarget(cleaningFirst, cleaningMessage, language)?.action,
      cleaningAction
    );
    assert.equal(
      findPreparedRequestCancellationTarget([towelsFirst[1]], towelsMessage, language),
      null
    );
    assert.equal(findPreparedRequestCancellationTarget([], towelsMessage, language), null);
  }
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
  assert.match(componentSource, /Solicitação preparada localmente\. Nada foi enviado ao hotel\./);
  assert.match(componentSource, /A solicitação em preparação foi descartada\. Nada foi enviado ao hotel\./);
  assert.doesNotMatch(componentSource, /Solicitação enviada|pedido foi enviado|equipe está a caminho/i);
  assert.doesNotMatch(requestSource, /function executeHousekeepingRequest|const executeHousekeepingRequest/);
  assert.match(requestSource, /confirm_request -> POST \/api\/assistant\/actions\/housekeeping -> n8n/);
});

test('typed cancellation is consumed before fetch and clears only its resolved card action', () => {
  const sendStart = componentSource.indexOf('async function sendMessage');
  const sendEnd = componentSource.indexOf('function completePreparedRequest', sendStart);
  const sendHandler = componentSource.slice(sendStart, sendEnd);
  assert.ok(sendHandler.indexOf('findPreparedRequestCancellationTarget') < sendHandler.indexOf('fetch('));
  assert.match(sendHandler, /if \(preparedCancellation\)[\s\S]*completePreparedRequest\([\s\S]*'cancelled'[\s\S]*return;/);
  assert.match(sendHandler, /setPendingRequest\(null\)/);
  const completion = componentSource.slice(sendEnd, componentSource.indexOf('function handleKeyDown', sendEnd));
  assert.match(completion, /removePreparedRequestAction/);
  assert.match(completion, /status === 'prepared' \? copy\.prepared : copy\.cancelled/);
});

test('error fallback suppresses reception only for the refused interaction', () => {
  const normal = 'normal fallback with reception';
  const declined = 'request-scoped fallback';
  assert.equal(resolveAssistantErrorMessage(
    'Qual é o horário do café?',
    normal,
    declined
  ), normal);
  assert.equal(resolveAssistantErrorMessage(
    'Não quero falar com a recepção, só preciso saber o horário do café.',
    normal,
    declined
  ), declined);
  assert.equal(resolveAssistantErrorMessage(
    'Agora quero falar com a recepção.',
    normal,
    declined
  ), normal);
  assert.match(componentSource, /error: 'Não consegui responder agora\.[^']*fale com a recepção\.'/);
  assert.match(componentSource, /error: 'I couldn’t answer right now\.[^']*contact the front desk\.'/);
  assert.match(componentSource, /error: 'No pude responder ahora\.[^']*habla con recepción\.'/);
  assert.match(componentSource, /resolveAssistantErrorMessage\([\s\S]*copy\.error,[\s\S]*copy\.contactDeclinedError/);
});
