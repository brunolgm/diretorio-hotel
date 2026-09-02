import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import { normalizeAssistantMessage, routeAssistantMessage, shouldCallAI } from '../../lib/assistant-router/index.ts';
import {
  TOURISM_RECOMMENDATIONS_CAPABILITY,
  TOURISM_RECOMMENDATION_SOURCES,
  isOpenTourismQuestion,
  resolveTourismRecommendationSource,
} from '../../lib/assistant-tourism.ts';
import { buildPublicAiContext } from '../../lib/public-ai-context.ts';

const root = process.cwd();
const CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';

function pageData() {
  return {
    hotel: {
      name: 'Hotel Teste', slug: 'hotel-teste', checkin_time: null, checkout_time: null,
      breakfast_hours: null, wifi_name: null, website_url: null, instagram_url: null,
      booking_url: null, whatsapp_number: null,
    },
    sections: [{
      title: 'Restaurante do hotel',
      content: 'Jantar servido no salão interno.',
      category: 'Alimentação',
      operational_key: null,
    }],
    departments: [], policies: [], announcements: [], banners: [], layout: [],
    flightHomeCard: null, hasFallbackContent: false,
  };
}

function aiDependencies(answer: string) {
  let context = '';
  let clientCreations = 0;
  return {
    state: () => ({ context, clientCreations }),
    dependencies: {
      async getPageDataBySlug() { return pageData() as never; },
      createClient() {
        clientCreations += 1;
        return {
          async addContext(input: { prompt: string }) { context = input.prompt; },
          async converse() { return answer; },
        };
      },
    },
  };
}

test('keeps the internal three-source distinction without creating a tourism catalog', () => {
  assert.deepEqual(TOURISM_RECOMMENDATION_SOURCES, ['libguest_curated', 'general_ai', 'unavailable']);
  assert.equal(TOURISM_RECOMMENDATIONS_CAPABILITY, 'get_tourism_recommendations');
  assert.equal(resolveTourismRecommendationSource({ hasLibguestCuratedRecommendations: true, allowGeneralAi: true }), 'libguest_curated');
  assert.equal(resolveTourismRecommendationSource({ hasLibguestCuratedRecommendations: false, allowGeneralAi: true }), 'general_ai');
  assert.equal(resolveTourismRecommendationSource({ hasLibguestCuratedRecommendations: false, allowGeneralAi: false }), 'unavailable');

  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  assert.equal(migrations.some((name) => /tourism_recommend|tourism_catalog/i.test(name)), false);
});

test('routes open tourism to Maya with an explicit stable guardrail while preserving hotel restaurant questions', () => {
  for (const message of ['Restaurantes perto do hotel?', 'What should I visit nearby?', '¿Qué hacer en la zona?']) {
    const normalized = normalizeAssistantMessage(message);
    assert.equal(isOpenTourismQuestion(normalized), true);
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(decision.mode, 'tourism');
    assert.equal(decision.assistantRoute, 'ai');
    assert.equal(shouldCallAI(decision), true);
  }

  for (const message of ['Qual é o restaurante do hotel?', 'Qual o horário do restaurante?']) {
    const internal = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(internal.mode, 'ai');
  }
});

test('marks unsafe uncatalogued establishment details unavailable and strips model URLs and claims', async () => {
  const harness = aiDependencies(
    'O Restaurante Inventado é parceiro do hotel, abre às 19h, custa R$ 100 e fica a 5 minutos. https://evil.example/reserva'
  );
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Recomende um restaurante fora do hotel',
  }, harness.dependencies);

  assert.equal(result?.assistantRoute, 'ai');
  assert.equal(result?.recommendationSource, 'unavailable');
  assert.equal(result?.action, null);
  assert.doesNotMatch(result?.answer ?? '', /Sugestão geral/i);
  assert.match(result?.answer ?? '', /Confirme.*canais oficiais/i);
  assert.doesNotMatch(result?.answer ?? '', /Inventado|parceir|19h|R\$|5 minutos|https?:\/\/|evil\.example/i);
  assert.match(harness.state().context, /estabelecimentos externos não são informações confirmadas do hotel/i);
  assert.match(harness.state().context, /Nunca afirme parceria, preço, horário, distância, funcionamento ou disponibilidade/i);
  assert.match(harness.state().context, /Não produza URLs nem CTAs/i);
});

test('uses general_ai only when Maya actually provides suggestions and unavailable otherwise in PT EN ES', async () => {
  const examples = [
    ['pt', 'Sugiro visitar o Forte de Copacabana.', /Sugestão geral/, /Confirme.*canais oficiais/],
    ['en', 'I suggest visiting the local waterfront.', /General suggestion/, /confirm.*official channels/i],
    ['es', 'Sugiero conocer los museos del barrio.', /Sugerencia general/, /Confirma.*canales oficiales/],
  ] as const;
  for (const [language, modelAnswer, prefix, suffix] of examples) {
    const message = language === 'en'
      ? 'What should I visit nearby?'
      : language === 'es' ? '¿Qué hacer en la zona?' : 'O que fazer em Copacabana?';
    const suggested = aiDependencies(modelAnswer);
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID, message,
    }, suggested.dependencies);
    assert.equal(result?.recommendationSource, 'general_ai');
    assert.match(result?.answer ?? '', prefix);
    assert.match(result?.answer ?? '', suffix);
    assert.equal(result?.usageTrace.totalUpstreamCalls, 1);

    const empty = aiDependencies(language === 'en'
      ? 'I do not have confirmed information. Check official sources.'
      : language === 'es'
        ? 'No tengo información confirmada. Consulta recepción.'
        : 'Não tenho informações confirmadas. Consulte a recepção.');
    const unavailable = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID, message,
    }, empty.dependencies);
    assert.equal(unavailable?.recommendationSource, 'unavailable');
    assert.doesNotMatch(unavailable?.answer ?? '', /Sugestão geral|General suggestion|Sugerencia general/i);
    assert.equal(empty.state().clientCreations, 1);
    assert.equal(unavailable?.usageTrace.totalUpstreamCalls, 1);
  }
});

test('external named opening-hour questions fail unavailable without presenting a model time', async () => {
  const harness = aiDependencies('O Marius Degustare abre às 19h.');
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Qual o horário do Marius Degustare?',
  }, harness.dependencies);
  assert.equal(result?.recommendationSource, 'unavailable');
  assert.doesNotMatch(result?.answer ?? '', /19h|Sugestão geral/i);
});

test('uses a safe unavailable fallback without Maya when general tourism knowledge is disabled', async () => {
  const harness = aiDependencies('must not be used');
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Quais atrações posso visitar?',
  }, { ...harness.dependencies, allowGeneralTourismAi: false });

  assert.equal(harness.state().clientCreations, 0);
  assert.equal(result?.recommendationSource, 'unavailable');
  assert.equal(result?.action, null);
  assert.match(result?.answer ?? '', /ainda não publicou recomendações externas/i);
});

test('keeps published hotel restaurant content in context and allows a future server capability to replace fallback', async () => {
  const context = buildPublicAiContext({ pageData: pageData() as never, language: 'pt' });
  assert.match(context, /Restaurante do hotel/);
  assert.match(context, /Jantar servido no salão interno/);
  assert.match(context, /Conteúdo de restaurante.*dentro do hotel continua confirmado/i);

  const internalHarness = aiDependencies('O jantar é servido no salão interno.');
  const internal = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Qual o horário do restaurante do hotel?',
  }, internalHarness.dependencies);
  assert.equal(internal?.recommendationSource, 'libguest_curated');

  const harness = aiDependencies('must not be used');
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Recomende restaurantes perto do hotel',
  }, {
    ...harness.dependencies,
    async getTourismRecommendations() {
      return { answer: 'Curadoria pública do LibGuest.', action: null };
    },
  });

  assert.equal(harness.state().clientCreations, 0);
  assert.equal(result?.recommendationSource, 'libguest_curated');
  assert.equal(result?.answer, 'Curadoria pública do LibGuest.');
});
