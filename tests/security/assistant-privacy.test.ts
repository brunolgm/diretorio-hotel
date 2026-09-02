import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import {
  ASSISTANT_PRIVACY_COPY,
  containsExplicitAssistantPii,
  detectExplicitAssistantPii,
} from '../../lib/assistant-privacy.ts';
import {
  buildAssistantChatRequest,
  shouldPersistAssistantUserMessage,
} from '../../lib/assistant-chat-session.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';

function pageData(language: 'pt' | 'en' | 'es' = 'pt') {
  return {
    hotel: {
      name: 'Hotel Teste', slug: 'hotel-teste', checkin_time: null, checkout_time: null,
      breakfast_hours: null, wifi_name: null, website_url: null, instagram_url: null,
      booking_url: null, whatsapp_number: '+5521999999999',
    },
    sections: [{ title: language === 'en' ? 'Contact' : language === 'es' ? 'Contacto' : 'Contato', content: '', category: '', operational_key: null }],
    departments: [], policies: [], announcements: [], banners: [], layout: [],
    flightHomeCard: null, hasFallbackContent: false,
  };
}

test('detects only explicit high-confidence PII patterns', () => {
  const sensitive = [
    ['guest@example.test', 'email'],
    ['me ligue no +55 21 99999-9999', 'phone'],
    ['b187f57c-c435-4605-99b8-4a5a9c3983f6', 'uuid'],
    ['roomToken=secret', 'room_token'],
    ['hotelId=private', 'hotel_id'],
    ['minha reserva ABC123', 'labeled_reservation'],
    ['quarto 803', 'room_number'],
    ['apartamento 1204', 'room_number'],
    ['CPF 123.456.789-00', 'cpf'],
  ] as const;
  for (const [message, kind] of sensitive) {
    assert.equal(detectExplicitAssistantPii(message), kind, message);
    assert.equal(shouldPersistAssistantUserMessage(message), false, message);
  }
  for (const message of [
    'meu quarto precisa ser limpo',
    'preciso de ajuda no quarto',
    'qual é o horário do café?',
  ]) {
    assert.equal(containsExplicitAssistantPii(message), false, message);
    assert.equal(shouldPersistAssistantUserMessage(message), true, message);
  }
});

test('fails closed before classifier and Maya with localized deterministic copy and server action', async () => {
  for (const language of ['pt', 'en', 'es'] as const) {
    let classifierCalls = 0;
    let mayaCalls = 0;
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID,
      message: language === 'en' ? 'room 803' : language === 'es' ? 'apartamento 803' : 'quarto 803',
    }, {
      async getPageDataBySlug() { return pageData(language) as never; },
      async classifyMessage() { classifierCalls += 1; return null; },
      createClient() { mayaCalls += 1; throw new Error('Maya must not be created'); },
    });
    assert.equal(result?.answer, ASSISTANT_PRIVACY_COPY[language]);
    assert.equal(result?.assistantRoute, 'deterministic');
    assert.equal(result?.action?.type, 'open_url');
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'deterministic', classifierCalls: 0, fullAiCalls: 0, totalUpstreamCalls: 0,
    });
    assert.equal(classifierCalls, 0);
    assert.equal(mayaCalls, 0);
  }
});

test('every required PII kind consumes zero upstream calls while benign room service remains a capability', async () => {
  for (const message of [
    'email guest@example.test', '+55 21 99999-9999', CONTEXT_ID, 'roomToken=secret',
    'hotelId=private', 'quarto 803', 'apartamento 1204', 'reserva ABC123', '123.456.789-00',
  ]) {
    let upstreamCalls = 0;
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID, message,
    }, {
      async getPageDataBySlug() { return pageData() as never; },
      async classifyMessage() { upstreamCalls += 1; return null; },
      createClient() { upstreamCalls += 1; throw new Error('upstream forbidden'); },
    });
    assert.equal(upstreamCalls, 0, message);
    assert.equal(result?.usageTrace.totalUpstreamCalls, 0, message);
  }

  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'meu quarto precisa ser limpo',
  }, {
    async getPageDataBySlug() { return pageData() as never; },
    createClient() { throw new Error('Maya must not be created'); },
  });
  assert.equal(result?.assistantRoute, 'capability');
  assert.equal(result?.action?.type, 'confirm_request');
});

test('the browser sends raw text to the authoritative server but never persists explicit PII', () => {
  const raw = 'minha reserva ABC123';
  const request = buildAssistantChatRequest({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID, message: raw,
  });
  assert.equal(request.message, raw);

  const component = read('components', 'public', 'libguest-ai-chat.tsx');
  const route = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const chat = read('lib', 'assistant-chat.ts');
  assert.match(component, /persistUserMessage = shouldPersistAssistantUserMessage\(message\)/);
  assert.match(component, /appendUserMessage && persistUserMessage/);
  assert.ok(component.indexOf('appendUserMessage && persistUserMessage') < component.indexOf("fetch('/api/assistant/chat'"));
  assert.match(route, /validateAssistantChatPayload[\s\S]*runAssistantChat\(validation\.value/);
  assert.match(chat, /containsExplicitAssistantPii\(payload\.message\)[\s\S]*assistantRoute: 'deterministic'/);
  assert.doesNotMatch(`${route}\n${chat}\n${component}`, /console\.|logger\.|JSON\.stringify\(payload\.message\)/);
});
