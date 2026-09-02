import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import {
  buildReceptionContactChatResponse,
  detectClosedCatalogIntent,
  detectReceptionContactIntent,
  getReceptionContact,
  isGetReceptionContactInput,
  parseAssistantAction,
  resolveReceptionContactFromPublicData,
  resolveAssistantCapabilityLanguage,
} from '../../lib/assistant-tools/index.ts';
import type { PublicHotelPageData } from '../../lib/public-hotel-data.ts';
import type { SupportedPublicLanguage } from '../../lib/public-language.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const componentSource = read('components', 'public', 'libguest-ai-chat.tsx');
const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
const toolSource = read('lib', 'assistant-tools', 'reception-contact.ts');
const CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';

function pageData({
  slug = 'hotel-a',
  whatsapp = null,
  departmentName,
  departmentUrl,
  contactPage = false,
}: {
  slug?: string;
  whatsapp?: string | null;
  departmentName?: string;
  departmentUrl?: string | null;
  contactPage?: boolean;
} = {}): PublicHotelPageData {
  return {
    hotel: { slug, whatsapp_number: whatsapp },
    departments: departmentName ? [{ name: departmentName, url: departmentUrl, enabled: true }] : [],
    layout: contactPage ? [{ blockKey: 'contact', isEnabled: true }] : [],
    sections: [],
    policies: [],
    announcements: [],
    banners: [],
    flightHomeCard: null,
    hasFallbackContent: false,
  } as unknown as PublicHotelPageData;
}

test('recognizes the closed PT, EN and ES intent catalog independently from UI language', () => {
  for (const [message, interfaceLanguage, detectedLanguage, expectedLabel] of [
    ['Quero falar com a recepção.', 'en', 'pt', 'Falar com a recepção'],
    ['I want to talk to reception.', 'pt', 'en', 'Contact the front desk'],
    ['Quiero hablar con recepción.', 'pt', 'es', 'Hablar con recepción'],
    ['How do I contact reception?', 'es', 'en', 'Contact the front desk'],
  ] as const) {
    const detection = detectReceptionContactIntent(message);
    assert.deepEqual(detection, { intent: 'reception_contact', detectedLanguage });
    const capabilityLanguage = resolveAssistantCapabilityLanguage(detection!, interfaceLanguage);
    assert.equal(capabilityLanguage, detectedLanguage);
    const contact = resolveReceptionContactFromPublicData({
      input: { hotelSlug: 'hotel-a', language: capabilityLanguage },
      pageData: pageData({ whatsapp: '+55 21 99999-9999' }),
    });
    assert.equal(buildReceptionContactChatResponse(contact, capabilityLanguage).action?.label, expectedLabel);
  }
  for (const message of [
    'A recepção é bonita',
    'Can someone help?',
    'Necesito información',
    'Onde fica a recepção?',
  ]) {
    assert.equal(detectReceptionContactIntent(message), null);
  }
});

test('falls back to interface language when a closed catalog match is not language-unique', () => {
  const sharedPhrase = new Set(['contact hotel']);
  const detection = detectClosedCatalogIntent({
    message: 'Contact hotel',
    intent: 'test_contact',
    catalog: { pt: sharedPhrase, en: sharedPhrase, es: new Set() },
  });
  assert.deepEqual(detection, { intent: 'test_contact', detectedLanguage: null });
  assert.equal(resolveAssistantCapabilityLanguage(detection!, 'es'), 'es');
});

test('accepts only hotelSlug and language as capability input', () => {
  assert.equal(isGetReceptionContactInput({ hotelSlug: 'hotel-a', language: 'pt' }), true);
  for (const field of ['hotelId', 'roomToken', 'guestName', 'phone', 'url']) {
    assert.equal(isGetReceptionContactInput({ hotelSlug: 'hotel-a', language: 'pt', [field]: 'private' }), false);
  }
  assert.equal(isGetReceptionContactInput({ hotelSlug: '../hotel-a', language: 'pt' }), false);
  assert.equal(isGetReceptionContactInput({ hotelSlug: 'hotel-a', language: 'fr' }), false);
});

test('uses the reception department first and canonicalizes official WhatsApp', () => {
  const result = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({
      whatsapp: '+55 21 90000-0000',
      departmentName: 'Recepção',
      departmentUrl: 'https://api.whatsapp.com/send?phone=5521999999999&text=hello',
    }),
  });
  assert.deepEqual(result, {
    available: true,
    department: 'reception',
    channel: 'whatsapp',
    label: 'Falar com a recepção',
    actionUrl: 'https://wa.me/5521999999999',
    displayValue: '+5521999999999',
  });
});

test('supports a validated reception phone without creating an unsupported URL action', () => {
  const result = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'en' },
    pageData: pageData({ departmentName: 'Front Desk', departmentUrl: 'tel:+1 (212) 555-0198' }),
  });
  assert.equal(result.channel, 'phone');
  assert.equal(result.displayValue, '+12125550198');
  assert.equal(result.actionUrl, null);
  assert.equal(buildReceptionContactChatResponse(result, 'en').action, null);
});

test('falls back from invalid public URLs to hotel WhatsApp, Contact page, then unavailable', () => {
  const invalidDepartment = pageData({
    whatsapp: '+55 (21) 98888-7777',
    departmentName: 'Reception',
    departmentUrl: 'javascript:alert(1)',
  });
  const whatsapp = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'en' }, pageData: invalidDepartment,
  });
  assert.equal(whatsapp.channel, 'whatsapp');
  assert.equal(whatsapp.actionUrl, 'https://wa.me/5521988887777');

  const contact = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'es' }, pageData: pageData({ contactPage: true }),
  });
  assert.equal(contact.channel, 'contact_page');
  assert.equal(contact.actionUrl, '/hotel/hotel-a/explorar/contato?lang=es');

  const unavailable = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' }, pageData: pageData(),
  });
  assert.deepEqual(unavailable, {
    available: false,
    department: 'reception',
    channel: 'none',
    label: 'Recepção indisponível',
    actionUrl: null,
    displayValue: null,
  });
});

test('fails closed for cross-hotel and non-public lifecycle resolution', async () => {
  const crossHotel = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({ slug: 'hotel-b', whatsapp: '+55 21 99999-9999' }),
  });
  assert.equal(crossHotel.available, false);
  assert.equal(crossHotel.actionUrl, null);

  const lifecycleUnavailable = await getReceptionContact(
    { hotelSlug: 'hotel-a', language: 'pt' },
    { async getPageDataBySlug() { return null; } }
  );
  assert.equal(lifecycleUnavailable.available, false);
  assert.equal(lifecycleUnavailable.channel, 'none');
});

test('keeps the capability result closed and free from identifiers or guest data', () => {
  const result = resolveReceptionContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({ whatsapp: '+55 21 99999-9999' }),
  });
  assert.deepEqual(Object.keys(result).sort(), [
    'actionUrl', 'available', 'channel', 'department', 'displayValue', 'label',
  ]);
  assert.doesNotMatch(JSON.stringify(result), /hotelId|roomToken|guest|reservation|uuid/i);
});

test('bypasses GPTMaker for clear intent and never accepts a model-provided action', async () => {
  let clientCreated = false;
  let resolvedLanguage: SupportedPublicLanguage | null = null;
  const capabilityResult = await runAssistantChat({
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'I want to talk to reception.',
  }, {
    async getPageDataBySlug(_slug, language) {
      resolvedLanguage = language;
      return pageData({ whatsapp: '+55 21 99999-9999' });
    },
    createClient() {
      clientCreated = true;
      throw new Error('must not create GPTMaker client');
    },
  });
  assert.equal(clientCreated, false);
  assert.equal(resolvedLanguage, 'en');
  assert.equal(capabilityResult?.action?.type, 'open_url');
  if (capabilityResult?.action?.type === 'open_url') {
    assert.equal(capabilityResult.action.url, 'https://wa.me/5521999999999');
  }
  assert.equal(capabilityResult?.action?.label, 'Contact the front desk');
  assert.match(capabilityResult?.answer ?? '', /You can contact/);

  const internalRouteResult = await runAssistantChat({
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'Quiero hablar con recepción.',
  }, {
    async getPageDataBySlug(_slug, language) {
      assert.equal(language, 'es');
      return pageData({ contactPage: true });
    },
    createClient() { throw new Error('must not create GPTMaker client'); },
  });
  assert.equal(internalRouteResult?.action?.label, 'Abrir área de Contacto');
  assert.equal(internalRouteResult?.action?.type, 'open_url');
  if (internalRouteResult?.action?.type === 'open_url') {
    assert.equal(internalRouteResult.action.url, '/hotel/hotel-a/explorar/contato?lang=es');
  }

  const normalResult = await runAssistantChat({
    hotelSlug: 'hotel-a', language: 'pt', contextId: CONTEXT_ID, message: 'Qual o horário do café?',
  }, {
    async getPageDataBySlug() { return pageData(); },
    createClient() {
      return {
        async addContext() {},
        async converse() { return '{"answer":"fake","action":{"url":"https://evil.example"}}'; },
      };
    },
  });
  assert.equal(normalResult?.action, null);
  assert.doesNotMatch(normalResult?.answer ?? '', /https?:\/\/|evil\.example/);
  assert.match(normalResult?.answer ?? '', /link removido/);
  assert.match(routeSource, /action: result\.action/);
});

test('produces localized guidance and CTA without falsely confirming execution', () => {
  const banned = /solicitação foi enviada|recepção já foi avisada|chamado foi aberto|request was sent|front desk has been notified|solicitud fue enviada/i;
  const expected = {
    pt: { label: 'Falar com a recepção', answer: /Você pode falar|Claro/ },
    en: { label: 'Contact the front desk', answer: /You can contact/ },
    es: { label: 'Hablar con recepción', answer: /Puedes contactar/ },
  } as const;
  for (const language of ['pt', 'en', 'es'] as const) {
    const result = resolveReceptionContactFromPublicData({
      input: { hotelSlug: 'hotel-a', language }, pageData: pageData({ whatsapp: '+55 21 99999-9999' }),
    });
    const response = buildReceptionContactChatResponse(result, language);
    assert.match(response.answer, expected[language].answer);
    assert.equal(response.action?.label, expected[language].label);
    assert.doesNotMatch(response.answer, banned);
  }
  assert.doesNotMatch(toolSource, banned);
});

test('validates actions again for storage/rendering and renders an accessible text-only CTA', () => {
  assert.deepEqual(parseAssistantAction({ type: 'open_url', label: 'Contato', url: '/hotel/hotel-a/explorar/contato?lang=en' }), {
    type: 'open_url', label: 'Contato', url: '/hotel/hotel-a/explorar/contato?lang=en',
  });
  for (const url of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test', '/other/path']) {
    assert.equal(parseAssistantAction({ type: 'open_url', label: 'Contato', url }), null);
  }
  assert.equal(parseAssistantAction({ type: 'execute_request', label: 'Enviar', url: 'https://example.test' }), null);
  assert.match(componentSource, /parseAssistantAction\(result\.action\)/);
  assert.match(componentSource, /href=\{message\.action\.url\}/);
  assert.match(componentSource, /target=\{message\.action\.url\.startsWith\('https:\/\/'\) \? '_blank'/);
  assert.match(componentSource, /rel=\{message\.action\.url\.startsWith\('https:\/\/'\) \? 'noreferrer'/);
  assert.match(componentSource, /focus-visible:ring-2/);
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML|innerHTML/);
});
