import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import {
  buildHousekeepingContactChatResponse,
  detectHousekeepingContactIntent,
  getHousekeepingContact,
  isGetHousekeepingContactInput,
  resolveAssistantCapabilityLanguage,
  resolveHousekeepingContactFromPublicData,
} from '../../lib/assistant-tools/index.ts';
import type { PublicHotelPageData } from '../../lib/public-hotel-data.ts';

const root = process.cwd();
const toolSource = readFileSync(
  join(root, 'lib', 'assistant-tools', 'housekeeping-contact.ts'),
  'utf8'
);
const chatSource = readFileSync(join(root, 'lib', 'assistant-chat.ts'), 'utf8');
const sessionSource = readFileSync(join(root, 'lib', 'assistant-chat-session.ts'), 'utf8');
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
    departments: departmentName
      ? [{ name: departmentName, url: departmentUrl, enabled: true }]
      : [],
    layout: contactPage ? [{ blockKey: 'contact', isEnabled: true }] : [],
    sections: [],
    policies: [],
    announcements: [],
    banners: [],
    flightHomeCard: null,
    hasFallbackContent: false,
  } as unknown as PublicHotelPageData;
}

test('recognizes only the closed housekeeping contact catalog in PT, EN and ES', () => {
  for (const [message, detectedLanguage] of [
    ['quero falar com a governança', 'pt'],
    ['I need to talk to housekeeping', 'en'],
    ['cómo contacto con gobernanza', 'es'],
  ] as const) {
    assert.deepEqual(detectHousekeepingContactIntent(message), {
      intent: 'housekeeping_contact',
      detectedLanguage,
    });
  }

  for (const serviceRequest of [
    'preciso de duas toalhas',
    'quero toalhas',
    'meu quarto precisa ser limpo',
    'preciso de limpeza',
    'trocar meu enxoval',
    'I need towels',
    'my room needs cleaning',
    'necesito toallas',
    'necesito limpieza',
  ]) {
    assert.equal(detectHousekeepingContactIntent(serviceRequest), null);
  }
});

test('localizes housekeeping answers and CTAs from the matched message catalog', () => {
  for (const [interfaceLanguage, message, detectedLanguage, answer, label] of [
    ['pt', 'I want to talk to housekeeping', 'en', /You can contact Housekeeping/, 'Contact Housekeeping'],
    ['pt', 'quiero hablar con gobernanza', 'es', /Puedes contactar con Gobernanza/, 'Hablar con Gobernanza'],
    ['en', 'quero falar com a governança', 'pt', /Você pode falar com a Governança/, 'Falar com a Governança'],
  ] as const) {
    const detection = detectHousekeepingContactIntent(message);
    assert.ok(detection);
    const language = resolveAssistantCapabilityLanguage(detection, interfaceLanguage);
    assert.equal(language, detectedLanguage);
    const result = resolveHousekeepingContactFromPublicData({
      input: { hotelSlug: 'hotel-a', language },
      pageData: pageData({ whatsapp: '+55 21 99999-9999' }),
    });
    const response = buildHousekeepingContactChatResponse(result, language);
    assert.match(response.answer, answer);
    assert.equal(response.action?.label, label);
  }
});

test('uses interface language only when detectedLanguage is unavailable', () => {
  const language = resolveAssistantCapabilityLanguage(
    { intent: 'housekeeping_contact', detectedLanguage: null },
    'es'
  );
  const result = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language },
    pageData: pageData({ whatsapp: '+55 21 99999-9999' }),
  });
  const response = buildHousekeepingContactChatResponse(result, language);
  assert.match(response.answer, /Puedes contactar con Gobernanza/);
  assert.equal(response.action?.label, 'Hablar con Gobernanza');
});

test('uses only the exact normalized Governança, Housekeeping and Gobernanza names', () => {
  for (const name of ['Governança', 'Housekeeping', 'Gobernanza']) {
    const result = resolveHousekeepingContactFromPublicData({
      input: { hotelSlug: 'hotel-a', language: 'pt' },
      pageData: pageData({
        whatsapp: '+55 21 90000-0000',
        departmentName: name,
        departmentUrl: 'https://wa.me/5521999999999',
      }),
    });
    assert.equal(result.actionUrl, 'https://wa.me/5521999999999');
  }

  const inferredFromDescription = pageData({
    departmentName: 'Atendimento',
    departmentUrl: 'https://wa.me/5521999999999',
  });
  (inferredFromDescription.departments[0] as { description?: string }).description = 'Limpeza e governança';
  const result = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: inferredFromDescription,
  });
  assert.equal(result.available, false);
  assert.match(toolSource, /TODO\(assistant-department-semantics\)/);
});

test('prioritizes safe department URL, hotel WhatsApp, department phone and Contact page', () => {
  const direct = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({
      whatsapp: '+55 21 90000-0000',
      departmentName: 'Governança',
      departmentUrl: 'https://wa.me/5521999999999',
    }),
  });
  assert.equal(direct.actionUrl, 'https://wa.me/5521999999999');

  const hotelWhatsapp = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'en' },
    pageData: pageData({
      whatsapp: '+55 21 98888-7777',
      departmentName: 'Housekeeping',
      departmentUrl: 'tel:+55 21 97777-6666',
    }),
  });
  assert.equal(hotelWhatsapp.channel, 'whatsapp');
  assert.equal(hotelWhatsapp.actionUrl, 'https://wa.me/5521988887777');

  const phone = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'en' },
    pageData: pageData({ departmentName: 'Housekeeping', departmentUrl: 'tel:+1 212 555 0198' }),
  });
  assert.equal(phone.channel, 'phone');
  assert.equal(phone.displayValue, '+12125550198');
  assert.equal(phone.actionUrl, null);

  const contactPage = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'es' },
    pageData: pageData({ contactPage: true }),
  });
  assert.equal(contactPage.channel, 'contact_page');
  assert.equal(contactPage.actionUrl, '/hotel/hotel-a/explorar/contato?lang=es');
});

test('rejects unsafe URLs, cross-hotel data and missing public lifecycle data', async () => {
  const unsafe = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({ departmentName: 'Governança', departmentUrl: 'javascript:alert(1)' }),
  });
  assert.equal(unsafe.available, false);
  assert.equal(unsafe.actionUrl, null);

  const crossHotel = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData({ slug: 'hotel-b', whatsapp: '+55 21 99999-9999' }),
  });
  assert.equal(crossHotel.available, false);
  assert.equal(crossHotel.actionUrl, null);

  const unavailable = await getHousekeepingContact(
    { hotelSlug: 'hotel-a', language: 'pt' },
    { async getPageDataBySlug() { return null; } }
  );
  assert.equal(unavailable.channel, 'none');
  assert.equal(unavailable.available, false);
});

test('keeps the housekeeping input and output contracts closed', () => {
  assert.equal(isGetHousekeepingContactInput({ hotelSlug: 'hotel-a', language: 'pt' }), true);
  for (const field of ['hotelId', 'roomToken', 'reservation', 'guestName', 'email', 'url']) {
    assert.equal(isGetHousekeepingContactInput({ hotelSlug: 'hotel-a', language: 'pt', [field]: 'private' }), false);
  }
  const result = resolveHousekeepingContactFromPublicData({
    input: { hotelSlug: 'hotel-a', language: 'pt' },
    pageData: pageData(),
  });
  assert.deepEqual(Object.keys(result).sort(), [
    'actionUrl', 'available', 'channel', 'department', 'displayValue', 'label',
  ]);
  assert.equal(result.department, 'housekeeping');
});

test('resolves housekeeping before GPTMaker and keeps actions server-owned', async () => {
  let clientCreated = false;
  const capability = await runAssistantChat({
    hotelSlug: 'hotel-a',
    language: 'pt',
    contextId: CONTEXT_ID,
    message: 'I want to talk to housekeeping',
  }, {
    async getPageDataBySlug(_slug, language) {
      assert.equal(language, 'en');
      return pageData({ whatsapp: '+55 21 99999-9999' });
    },
    createClient() {
      clientCreated = true;
      throw new Error('must not create GPTMaker client');
    },
  });
  assert.equal(clientCreated, false);
  assert.equal(capability?.action?.label, 'Contact Housekeeping');

  const normal = await runAssistantChat({
    hotelSlug: 'hotel-a',
    language: 'pt',
    contextId: CONTEXT_ID,
    message: 'Preciso de toalhas',
  }, {
    async getPageDataBySlug() { return pageData(); },
    createClient() {
      return {
        async addContext() {},
        async converse() {
          return '{"action":{"type":"open_url","url":"https://evil.example"}}';
        },
      };
    },
  });
  assert.equal(normal?.action, null);
  assert.match(chatSource, /routeAssistantMessage[\s\S]*case 'housekeeping_contact'[\s\S]*getHousekeepingContact/);
});

test('never confirms execution and reuses the existing allowlisted action persistence', () => {
  const banned = /Governança foi avisada|pedido foi enviado|equipe está a caminho|Solicitação aberta|request was sent|team is on the way|solicitud fue enviada/i;
  assert.doesNotMatch(toolSource, banned);
  assert.match(toolSource, /type: 'open_url'/);
  assert.doesNotMatch(toolSource, /type: '(?:send|execute|create)/);
  assert.match(sessionSource, /parseAssistantAction\(message\.action\)/);
  assert.match(sessionSource, /message\.role === 'assistant'/);
});
