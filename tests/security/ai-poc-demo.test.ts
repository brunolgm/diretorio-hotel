import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  AI_POC_HOTEL_SLUG,
  assertDemoOwnership,
  assertLocalAiPocEnvironment,
  buildDemoQuickInfoCleanup,
  buildDemoRecords,
  buildSafeQuickInfoUpdate,
} from '../../scripts/seed-ai-poc-demo.ts';
import { buildPublicAiContext, PUBLIC_AI_CONTEXT_MAX_LENGTH } from '../../lib/public-ai-context.ts';

const root = process.cwd();
const fixture = JSON.parse(readFileSync(join(root, 'poc', 'ai-demo', '04_DADOS_DEMO_LIBGUEST_POC.json'), 'utf8'));
const seedSource = readFileSync(join(root, 'scripts', 'seed-ai-poc-demo.ts'), 'utf8');
const aiContextSource = readFileSync(join(root, 'lib', 'public-ai-context.ts'), 'utf8');

test('refuses every remote, production or Vercel seed environment', () => {
  assert.throws(() => assertLocalAiPocEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }), /non-local/i);
  assert.throws(() => assertLocalAiPocEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NODE_ENV: 'production' }), /production/i);
  assert.throws(() => assertLocalAiPocEnvironment({ SUPABASE_URL: 'http://localhost:54321', VERCEL: '1' }), /Vercel/i);
  assert.doesNotThrow(() => assertLocalAiPocEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }));
  assert.doesNotThrow(() => assertLocalAiPocEnvironment({ SUPABASE_URL: 'http://localhost:54321' }));
});

test('builds deterministic marked rows so repeated seed runs remain idempotent', () => {
  const first = buildDemoRecords(fixture, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const second = buildDemoRecords(fixture, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.deepEqual(second, first);
  const ids = [...first.sections, ...first.departments, ...first.policies, ...first.announcements].map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(first.sections.every((row) => row.title.startsWith('[DEMO]')));
  assert.deepEqual(new Set(first.sectionTranslations.map((row) => row.language)), new Set(['en', 'es']));
  assert.ok(first.sectionTranslations.every((row) => row.title?.startsWith('[DEMO]')));
  assert.match(seedSource, /\.upsert\(records\.sections, \{ onConflict: 'id' \}\)/);
  assert.doesNotMatch(seedSource, /\.select\('\*'\)/);
  assert.equal(fixture.hotel.slug, AI_POC_HOTEL_SLUG);
});

test('preserves real quick info and cleanup targets only marked demo values', () => {
  const current = {
    checkin_time: '15:00',
    checkout_time: '[DEMO] old checkout',
    breakfast_hours: null,
    wifi_name: 'Hotel Wi-Fi',
  };
  const update = buildSafeQuickInfoUpdate(current, fixture);
  assert.equal(update.checkin_time, undefined);
  assert.equal(update.wifi_name, undefined);
  assert.match(update.checkout_time || '', /^\[DEMO\]/);
  assert.match(update.breakfast_hours || '', /^\[DEMO\]/);
  assert.deepEqual(buildDemoQuickInfoCleanup(current), { checkout_time: null });
  assert.throws(() => assertDemoOwnership([{ id: 'collision', hotelId: 'hotel-a', marker: 'Real content' }], 'hotel-a'), /collision/i);
  assert.throws(() => assertDemoOwnership([{ id: 'collision', hotelId: 'hotel-b', marker: '[DEMO] Foreign fixture' }], 'hotel-a'), /collision/i);
  assert.match(seedSource, /\.in\('id', SECTION_IDS\)\.like\('title', `\$\{AI_POC_PREFIX\}%`\)/);
  assert.doesNotMatch(seedSource, /delete\(\)[\s\S]{0,120}\.eq\('slug', AI_POC_HOTEL_SLUG\)/);
});

function publicPageData(name: string, serviceTitle: string) {
  return {
    hotel: {
      id: '50200000-0000-4000-8000-000000000001',
      name,
      slug: AI_POC_HOTEL_SLUG,
      checkin_time: '[DEMO] A partir das 15h',
      checkout_time: '[DEMO] Até 12h',
      breakfast_hours: '[DEMO] 6h30–10h30' as string | null,
      wifi_name: '[DEMO] LIBGUEST-DEMO',
      wifi_password: 'SECRET-WIFI-PASSWORD',
      website_url: 'https://hotel.example/path?adminToken=secret',
      instagram_url: null,
      booking_url: null,
      whatsapp_number: '+55 21 99999-9999',
    },
    sections: [{ title: serviceTitle, content: 'Serviço público demonstrativo', category: 'AI_POC_DEMO_V1', operational_key: null as 'breakfast' | null }],
    departments: [{ name: '[DEMO] Recepção', description: 'Atendimento 24 horas', hours: '24 horas' }],
    policies: [{ title: '[DEMO] Silêncio', description: 'Evite ruídos entre 22h e 8h' }],
    announcements: [{
      title: '[DEMO] Assistente Virtual',
      body: 'Conteúdo público de teste',
      is_active: true,
      starts_at: null,
      ends_at: null,
      internal_notes: 'não expor',
      created_by: 'admin@example.com',
    }] as Array<{
      title: string;
      body: string;
      is_active: boolean;
      starts_at: string | null;
      ends_at: string | null;
      internal_notes?: string;
      created_by?: string;
    }>,
  };
}

test('builds bounded public-only context without identifiers, secrets or administrative data', () => {
  const context = buildPublicAiContext({ pageData: publicPageData('Grand Mercure Rio de Janeiro Copacabana', '[DEMO] Academia') as never, language: 'pt' });
  assert.match(context, /FONTE: LibGuest — dados públicos do hotel/);
  assert.match(context, /\[DEMO\] Academia/);
  assert.match(context, /Serviço público demonstrativo/);
  assert.match(context, /\[DEMO\] Recepção/);
  assert.match(context, /POLÍTICAS:/);
  assert.match(context, /COMUNICADOS:/);
  assert.match(context, /\[DEMO\] Assistente Virtual/);
  assert.match(context, /hotel\.example\/path/);
  assert.doesNotMatch(context, /AI_POC_DEMO_V1|50200000|SECRET-WIFI-PASSWORD|adminToken|99999-9999|roomToken|senha|UUID|não expor|admin@example/i);
  assert.ok(context.length <= PUBLIC_AI_CONTEXT_MAX_LENGTH);
});

test('forbids inferred department locations when public data has no location', () => {
  const data = publicPageData('Hotel A', 'Serviço A');
  data.departments = [{
    name: 'Recepção',
    description: 'Atendimento aos hóspedes',
    hours: '24 horas',
  }];

  const context = buildPublicAiContext({ pageData: data as never, language: 'pt' });

  assert.match(context, /Nome: Recepção/);
  assert.match(context, /Descrição pública: Atendimento aos hóspedes/);
  assert.match(context, /Horário: 24 horas/);
  assert.match(context, /Nunca deduza localização física de departamentos/);
  assert.match(context, /somente quando estiver explicitamente escrita nos dados públicos de DEPARTAMENTOS/);
  assert.doesNotMatch(context, /lobby|térreo|andar/i);
});

test('keeps an explicitly registered department location available to the model', () => {
  const data = publicPageData('Hotel A', 'Serviço A');
  data.departments = [{
    name: 'Recepção',
    description: 'Localização: ao lado da entrada principal.',
    hours: '24 horas',
  }];

  const context = buildPublicAiContext({ pageData: data as never, language: 'en' });

  assert.match(context, /Descrição pública: Localização: ao lado da entrada principal\./);
  assert.match(context, /Nunca deduza localização física de departamentos/);
});

test('uses the current public breakfast_hours without retaining a stale service schedule', () => {
  const data = publicPageData('Grand Mercure Rio de Janeiro Copacabana', '[DEMO] Café da manhã');
  data.hotel.breakfast_hours = '[DEMO] Horário público atualizado';
  data.sections[0].content = 'Buffet público. Horário: anterior que não deve prevalecer.';
  data.sections[0].operational_key = 'breakfast';

  const context = buildPublicAiContext({ pageData: data as never, language: 'pt' });

  assert.match(context, /Café da manhã: \[DEMO\] Horário público atualizado/);
  assert.match(context, /SERVIÇOS:\n- \[DEMO\] Café da manhã — Buffet público\./);
  assert.doesNotMatch(context, /anterior que não deve prevalecer/);
  assert.doesNotMatch(aiContextSource, /04_DADOS_DEMO_LIBGUEST_POC|6h30|7h15/);
  assert.doesNotMatch(context, /AI_POC_DEMO_V1|roomToken|admin@example|50200000/i);
  assert.ok(context.length <= PUBLIC_AI_CONTEXT_MAX_LENGTH);
});

test('does not infer breakfast semantics from a translated or matching title', () => {
  const data = publicPageData('Hotel A', 'Breakfast');
  data.hotel.breakfast_hours = '[DEMO] Horário canônico';
  data.sections[0].content = 'Editorial. Hours: independent text remains for an unclassified service.';
  data.sections[0].operational_key = null;

  const context = buildPublicAiContext({ pageData: data as never, language: 'en' });

  assert.match(context, /independent text remains for an unclassified service/);
  assert.equal(aiContextSource.includes(['BREAKFAST', 'SERVICE', 'TITLE'].join('_')), false);
  assert.doesNotMatch(aiContextSource, /breakfast\|desayuno|caf\[e/);
});

test('omits legacy breakfast service hours when the canonical field is empty', () => {
  const data = publicPageData('Hotel A', '[DEMO] Café da manhã');
  data.hotel.breakfast_hours = null;
  data.sections[0].content = 'Buffet público. Horário: valor legado não confirmado.';
  data.sections[0].operational_key = 'breakfast';

  const context = buildPublicAiContext({ pageData: data as never, language: 'pt' });

  assert.match(context, /\[DEMO\] Café da manhã — Buffet público\./);
  assert.doesNotMatch(context, /valor legado não confirmado/);
  assert.ok(context.length <= PUBLIC_AI_CONTEXT_MAX_LENGTH);
});

test('includes only active announcements inside their publication window', () => {
  const data = publicPageData('Hotel A', 'Serviço A');
  data.announcements = [
    { title: '[DEMO] Publicado', body: 'Deve aparecer', is_active: true, starts_at: null, ends_at: null },
    { title: '[DEMO] Inativo', body: 'Não deve aparecer', is_active: false, starts_at: null, ends_at: null },
    { title: '[DEMO] Futuro', body: 'Não deve aparecer', is_active: true, starts_at: '2999-01-01T00:00:00.000Z', ends_at: null },
    { title: '[DEMO] Expirado', body: 'Não deve aparecer', is_active: true, starts_at: null, ends_at: '2000-01-01T00:00:00.000Z' },
  ];
  data.sections = Array.from({ length: 16 }, (_, index) => ({
    title: `Serviço longo ${index}`,
    content: 'x'.repeat(1000),
    category: 'Demonstração',
    operational_key: null,
  }));
  data.departments = Array.from({ length: 12 }, (_, index) => ({
    name: `Departamento longo ${index}`,
    description: 'x'.repeat(1000),
    hours: '24 horas',
  }));
  data.policies = Array.from({ length: 12 }, (_, index) => ({
    title: `Política longa ${index}`,
    description: 'x'.repeat(1000),
  }));

  const context = buildPublicAiContext({ pageData: data as never, language: 'pt' });
  assert.match(context, /\[DEMO\] Publicado/);
  assert.doesNotMatch(context, /\[DEMO\] Inativo|\[DEMO\] Futuro|\[DEMO\] Expirado/);
  assert.ok(context.length <= PUBLIC_AI_CONTEXT_MAX_LENGTH);
});

test('keeps each hotel context isolated and handles empty or hostile-looking text safely', () => {
  const hotelA = buildPublicAiContext({ pageData: publicPageData('Hotel A', 'Serviço exclusivo A') as never, language: 'pt' });
  const hotelB = buildPublicAiContext({ pageData: publicPageData('Hotel B', 'Serviço exclusivo B') as never, language: 'en' });
  assert.match(hotelA, /Serviço exclusivo A/);
  assert.doesNotMatch(hotelA, /Hotel B|Serviço exclusivo B/);
  assert.match(hotelB, /Serviço exclusivo B/);

  const empty = publicPageData('Hotel vazio\u0000', 'x'.repeat(10000));
  empty.hotel.checkin_time = 'Contato guest@example.com, +55 21 99999-9999, senha: abc123, roomToken=secret';
  empty.sections = [];
  empty.departments = [];
  empty.policies = [];
  empty.announcements = [];
  const context = buildPublicAiContext({ pageData: empty as never, language: 'es' });
  assert.doesNotMatch(context, /\u0000/);
  assert.doesNotMatch(context, /guest@example|99999|abc123|roomToken/i);
  assert.match(context, /Nenhuma informação pública disponível/);
  assert.match(context, /REGRA: use somente os dados acima/);
  assert.ok(context.length <= PUBLIC_AI_CONTEXT_MAX_LENGTH);
});
