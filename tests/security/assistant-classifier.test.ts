import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_CLASSIFICATION_THRESHOLDS,
  CLASSIFIER_MESSAGE_MAX,
  CLASSIFIED_ASSISTANT_INTENTS,
  applyAssistantClassification,
  buildAssistantClassifierPrompt,
  getAssistantClassificationConfidenceBand,
  normalizeAssistantMessage,
  parseAssistantClassification,
  routeAssistantMessage,
  shouldClassifyMessage,
  type AssistantClassification,
} from '../../lib/assistant-router/index.ts';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import { resolveDedicatedClassifierAgentId } from '../../lib/gptmaker-agent-selection.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const GUEST_CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';

function publicPageData() {
  return {
    hotel: {
      name: 'Hotel Teste',
      slug: 'hotel-teste',
      checkin_time: null,
      checkout_time: null,
      breakfast_hours: null,
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

function createTrackedDependencies(options: {
  classification?: AssistantClassification | null;
  classificationError?: Error;
} = {}) {
  const calls = {
    classifier: 0,
    fullAi: 0,
    classifierMessage: '',
    guestContextId: '',
    conversationPrompt: '',
  };
  return {
    calls,
    dependencies: {
      async getPageDataBySlug() {
        return publicPageData() as never;
      },
      async classifyMessage(message: string, guestContextId: string) {
        calls.classifier += 1;
        calls.classifierMessage = message;
        calls.guestContextId = guestContextId;
        if (options.classificationError) throw options.classificationError;
        return options.classification ?? null;
      },
      createClient() {
        calls.fullAi += 1;
        return {
          async addContext() {},
          async converse(input: { contextId: string; prompt: string }) {
            calls.conversationPrompt = input.prompt;
            return 'Resposta normal da Maya';
          },
        };
      },
    },
  };
}

async function run(message: string, tracked = createTrackedDependencies()) {
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'pt',
    contextId: GUEST_CONTEXT_ID,
    message,
  }, tracked.dependencies);
  return { result, calls: tracked.calls };
}

test('defines the closed catalog and centralized confidence thresholds', () => {
  assert.equal(CLASSIFIER_MESSAGE_MAX, 600);
  assert.deepEqual(ASSISTANT_CLASSIFICATION_THRESHOLDS, {
    HIGH_CONFIDENCE: 0.90,
    MEDIUM_CONFIDENCE: 0.70,
  });
  assert.deepEqual(CLASSIFIED_ASSISTANT_INTENTS, [
    'human_handoff',
    'reception_contact',
    'housekeeping_contact',
    'housekeeping_request_towels',
    'housekeeping_request_room_cleaning',
    'hotel_information',
    'flight_information',
    'tourism',
    'sales',
    'general_chat',
    'unknown',
  ]);
  assert.equal(getAssistantClassificationConfidenceBand(0.95), 'high');
  assert.equal(getAssistantClassificationConfidenceBand(0.90), 'high');
  assert.equal(getAssistantClassificationConfidenceBand(0.80), 'medium');
  assert.equal(getAssistantClassificationConfidenceBand(0.70), 'medium');
  assert.equal(getAssistantClassificationConfidenceBand(0.55), 'low');
});

test('messages over 600 characters skip classification without silent truncation', async () => {
  const message = `preciso de ajuda ${'x'.repeat(CLASSIFIER_MESSAGE_MAX)}`;
  assert.ok(message.length > CLASSIFIER_MESSAGE_MAX);
  assert.equal(shouldClassifyMessage(normalizeAssistantMessage(message)), false);
  const tracked = createTrackedDependencies();
  const { result, calls } = await run(message, tracked);
  assert.equal(calls.classifier, 0);
  assert.equal(calls.fullAi, 1);
  assert.equal(calls.conversationPrompt, message);
  assert.deepEqual(result?.usageTrace, {
    resolutionPath: 'direct_ai', classifierCalls: 0, fullAiCalls: 1, totalUpstreamCalls: 1,
  });
});

test('classifies only conservative operational signals and skips general conversation', () => {
  for (const message of [
    'isso est\u00e1 complicado, prefiro resolver com algu\u00e9m',
    'tem como algu\u00e9m me ajudar?',
    'queria que algu\u00e9m viesse arrumar o quarto',
    'estou sem toalha aqui',
    'preciso de ajuda com o quarto',
    'tem algu\u00e9m que possa me atender?',
  ]) {
    assert.equal(shouldClassifyMessage(normalizeAssistantMessage(message)), true, message);
  }

  for (const message of [
    'conte uma curiosidade sobre Copacabana',
    'o que voc\u00ea recomenda fazer hoje?',
    'qual a hist\u00f3ria desse hotel?',
    'me fale sobre o Rio',
    'bom dia',
    'obrigado',
  ]) {
    assert.equal(shouldClassifyMessage(normalizeAssistantMessage(message)), false, message);
  }
});

test('never sends likely PII or internal identifiers to classification', () => {
  for (const message of [
    'preciso de ajuda, meu email e guest@example.test',
    'preciso de ajuda no quarto +55 21 99999-9999',
    'preciso de ajuda roomToken=secret',
    'preciso de ajuda hotelId=private',
    'preciso de ajuda, meu nome e Maria',
    'preciso de ajuda com minha reserva ABC123',
    'preciso de ajuda b187f57c-c435-4605-99b8-4a5a9c3983f6',
  ]) {
    assert.equal(shouldClassifyMessage(normalizeAssistantMessage(message)), false, message);
  }
});

test('parses only exact classifier JSON with bounded confidence and language', () => {
  const valid = {
    intent: 'human_handoff',
    confidence: 0.95,
    detectedLanguage: 'pt',
  } as const;
  assert.deepEqual(parseAssistantClassification(valid), valid);
  assert.deepEqual(parseAssistantClassification(JSON.stringify(valid)), valid);

  for (const invalid of [
    '{invalid',
    '```json\n{"intent":"human_handoff","confidence":0.95,"detectedLanguage":"pt"}\n```',
    { ...valid, intent: 'execute_anything' },
    { ...valid, confidence: 1.01 },
    { ...valid, confidence: -0.01 },
    { ...valid, confidence: Number.NaN },
    { ...valid, detectedLanguage: 'fr' },
    { ...valid, action: { type: 'open_url', url: 'https://evil.example' } },
    { ...valid, quantity: 6 },
  ]) {
    assert.equal(parseAssistantClassification(invalid), null);
  }
});

test('uses a short closed prompt that asks for JSON and carries no hotel context', () => {
  const prompt = buildAssistantClassifierPrompt('tem como algu\u00e9m me ajudar?');
  assert.match(prompt, /Nao responda ao hospede\. Nao execute acoes\. Retorne somente JSON valido\./);
  assert.match(prompt, /human_handoff, reception_contact, housekeeping_contact/);
  assert.match(prompt, /"confidence":0/);
  assert.match(prompt, /tem como algu/);
  assert.doesNotMatch(prompt, /pageData|INFORMACOES CONFIRMADAS|hotelId|roomToken|whatsapp|departamentos/i);
  assert.ok(prompt.length < 900);
});

test('strong capabilities consume zero classifier and zero full-AI calls', async () => {
  for (const message of [
    'quero falar com atendente',
    'quero falar com a recep\u00e7\u00e3o',
    'quero falar com a governan\u00e7a',
    'preciso de duas toalhas',
  ]) {
    const { result, calls } = await run(message);
    assert.equal(calls.classifier, 0, message);
    assert.equal(calls.fullAi, 0, message);
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'deterministic',
      classifierCalls: 0,
      fullAiCalls: 0,
      totalUpstreamCalls: 0,
    });
  }
});

test('high-confidence handoff uses one classifier and no second Maya call', async () => {
  const tracked = createTrackedDependencies({
    classification: { intent: 'human_handoff', confidence: 0.96, detectedLanguage: 'pt' },
  });
  const message = 'isso est\u00e1 complicado, prefiro resolver com algu\u00e9m';
  const { result, calls } = await run(message, tracked);

  assert.equal(calls.classifier, 1);
  assert.equal(calls.fullAi, 0);
  assert.equal(calls.classifierMessage, message);
  assert.equal(calls.guestContextId, GUEST_CONTEXT_ID);
  assert.equal(result?.action?.type, 'open_url');
  assert.deepEqual(result?.usageTrace, {
    resolutionPath: 'classifier_to_capability',
    classifierCalls: 1,
    fullAiCalls: 0,
    totalUpstreamCalls: 1,
  });
});

test('high-confidence room cleaning prepares a local request without a second call', async () => {
  const tracked = createTrackedDependencies({
    classification: {
      intent: 'housekeeping_request_room_cleaning',
      confidence: 0.95,
      detectedLanguage: 'pt',
    },
  });
  const { result, calls } = await run(
    'queria que algu\u00e9m viesse arrumar o quarto',
    tracked
  );

  assert.equal(calls.classifier, 1);
  assert.equal(calls.fullAi, 0);
  assert.equal(result?.action?.type, 'confirm_request');
  if (result?.action?.type === 'confirm_request') {
    assert.equal(result.action.request.requestType, 'room_cleaning');
  }
});

test('classifier can suggest towels but only the deterministic parser supplies quantity', async () => {
  const classification = {
    intent: 'housekeeping_request_towels',
    confidence: 0.95,
    detectedLanguage: 'pt',
  } as const;
  const withoutQuantity = await run(
    'estou sem toalha aqui',
    createTrackedDependencies({ classification })
  );
  assert.equal(withoutQuantity.result?.action, null);
  assert.equal(withoutQuantity.result?.pendingRequest?.requestType, 'towels');

  const withQuantity = await run(
    'estou sem 2 toalhas aqui',
    createTrackedDependencies({ classification })
  );
  assert.equal(withQuantity.result?.action?.type, 'confirm_request');
  if (withQuantity.result?.action?.type === 'confirm_request') {
    assert.equal(withQuantity.result.action.request.requestType, 'towels');
    assert.equal(withQuantity.result.action.request.quantity, 2);
  }
});

test('medium and low confidence never execute a capability and fall back to Maya', async () => {
  for (const confidence of [0.80, 0.55]) {
    const tracked = createTrackedDependencies({
      classification: {
        intent: 'housekeeping_request_room_cleaning',
        confidence,
        detectedLanguage: 'pt',
      },
    });
    const { result, calls } = await run('preciso de ajuda com o quarto', tracked);
    assert.equal(calls.classifier, 1);
    assert.equal(calls.fullAi, 1);
    assert.equal(result?.action, null);
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'classifier_to_ai', classifierCalls: 1, fullAiCalls: 1, totalUpstreamCalls: 2,
    });
  }
});

test('non-operational chat skips classification and calls Maya only once', async () => {
  const tracked = createTrackedDependencies();
  const message = 'o que fazer em Copacabana?';
  const { result, calls } = await run(message, tracked);
  assert.equal(calls.classifier, 0);
  assert.equal(calls.fullAi, 1);
  assert.equal(calls.conversationPrompt, message);
  assert.deepEqual(result?.usageTrace, {
    resolutionPath: 'direct_ai', classifierCalls: 0, fullAiCalls: 1, totalUpstreamCalls: 1,
  });
});

test('classifier failure or invalid response silently falls back to normal Maya', async () => {
  for (const tracked of [
    createTrackedDependencies({ classificationError: new Error('timeout') }),
    createTrackedDependencies({ classificationError: new Error('rate_limited') }),
    createTrackedDependencies({ classification: null }),
  ]) {
    const { result, calls } = await run('tem como algu\u00e9m me ajudar?', tracked);
    assert.equal(calls.classifier, 1);
    assert.equal(calls.fullAi, 1);
    assert.equal(result?.answer, 'Resposta normal da Maya');
    assert.equal(result?.action, null);
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'classifier_failed_to_ai', classifierCalls: 1, fullAiCalls: 1, totalUpstreamCalls: 2,
    });
  }
});

test('classification mapping never trusts action or quantity fields', () => {
  const message = normalizeAssistantMessage('estou sem toalha aqui');
  const decision = applyAssistantClassification({
    classification: {
      intent: 'housekeeping_request_towels',
      confidence: 0.95,
      detectedLanguage: 'pt',
    },
    message,
    uiLanguage: 'pt',
  });
  assert.equal(decision.mode, 'capability');
  if (decision.mode === 'capability' && decision.capability === 'housekeeping_request') {
    assert.equal(decision.request.requestType, 'towels');
    assert.equal(decision.request.quantity, null);
  }
});

test('server classifier uses one ephemeral context and receives no hotel context', () => {
  const source = read('lib', 'server', 'assistant-classifier.ts');
  const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
  assert.match(source, /^import 'server-only';/);
  assert.match(source, /randomUUID/);
  assert.match(source, /classifierContextId === guestContextId/);
  assert.match(source, /client\.converse\(\{[\s\S]*contextId: classifierContextId/);
  assert.doesNotMatch(source, /client\.addContext|pageData|hotelId|roomToken|guestName|reservation/);
  assert.equal((routeSource.match(/consumeAssistantRateLimit\(/g) ?? []).length, 1);
  assert.ok(routeSource.indexOf('consumeAssistantRateLimit') < routeSource.indexOf('runAssistantChat(validation.value'));
  assert.doesNotMatch(routeSource, /usageTrace: result|assistantRoute: result/);
});

test('uses a dedicated classifier agent and never falls back to the Maya agent id', () => {
  const clientSource = read('lib', 'server', 'gptmaker-client.ts');
  const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const componentSource = read('components', 'public', 'libguest-ai-chat.tsx');
  assert.match(clientSource, /GPTMAKER_CLASSIFIER_AGENT_ID/);
  const mayaAgentId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const classifierAgentId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  assert.equal(resolveDedicatedClassifierAgentId({ mayaAgentId, classifierAgentId }), classifierAgentId);
  assert.equal(resolveDedicatedClassifierAgentId({ mayaAgentId, classifierAgentId: undefined }), null);
  assert.equal(resolveDedicatedClassifierAgentId({ mayaAgentId, classifierAgentId: 'invalid' }), null);
  assert.equal(resolveDedicatedClassifierAgentId({ mayaAgentId, classifierAgentId: mayaAgentId.toLowerCase() }), null);
  assert.match(clientSource, /resolveDedicatedClassifierAgentId/);
  assert.match(clientSource, /if \(!apiKey \|\| !classifierAgentId\) return null/);
  assert.match(routeSource, /createGptMakerClassifierClientFromEnvironment\(\)/);
  assert.match(routeSource, /classifierClient[\s\S]*createClient: \(\) => classifierClient/);
  assert.doesNotMatch(routeSource, /classifyAssistantMessage[\s\S]{0,180}createGptMakerClientFromEnvironment/);
  assert.doesNotMatch(componentSource, /GPTMAKER_(?:CLASSIFIER_)?AGENT_ID|GPTMAKER_API_KEY/);
  assert.doesNotMatch(clientSource, /GPTMAKER_CLASSIFIER_AGENT_ID\s*\?\?\s*environment\.GPTMAKER_AGENT_ID/);
});

test('strong intents do not enter classification mode', () => {
  for (const message of [
    'quero falar com atendente',
    'quero falar com a recep\u00e7\u00e3o',
    'preciso de duas toalhas',
  ]) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(decision.mode, 'capability');
  }
});
