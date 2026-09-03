import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSISTANT_STRONG_INTENT_PRIORITY,
  normalizeAssistantMessage,
  routeAssistantMessage,
  shouldCallAI,
} from '../../lib/assistant-router/index.ts';
import { runAssistantChat } from '../../lib/assistant-chat.ts';
import { applyContactDeclineToAnswer } from '../../lib/assistant-tools/reception-contact.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const CONTEXT_ID = 'b187f57c-c435-4605-99b8-4a5a9c3983f6';
const PENDING_TOWELS = {
  kind: 'housekeeping',
  requestType: 'towels',
  language: 'pt',
} as const;

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

function dependencies(onCreateClient: () => void = () => undefined) {
  return {
    async getPageDataBySlug() {
      return publicPageData() as never;
    },
    createClient() {
      onCreateClient();
      return {
        async addContext() {},
        async converse() {
          return 'Resposta da Maya';
        },
      };
    },
  };
}

test('normalizes NFKC, accents, case, punctuation and spaces while preserving the original', () => {
  const message = normalizeAssistantMessage('  CHAME A RECEP\u00c7\u00c3O!!!  ');
  assert.equal(message.original, '  CHAME A RECEP\u00c7\u00c3O!!!  ');
  assert.equal(message.normalized, 'chame a recepcao');
  assert.equal(normalizeAssistantMessage('\uff29 need\uff1a towels\u2026').normalized, 'i need towels');
});

test('detects human handoff as a closed strong intent in PT, EN and ES', () => {
  assert.deepEqual(ASSISTANT_STRONG_INTENT_PRIORITY, [
    'emergency',
    'human_handoff',
    'housekeeping_request',
    'reception_contact',
    'housekeeping_contact',
  ]);
  const examples = [
    ['quero falar com atendente', 'pt'],
    ['I want to talk to a human', 'en'],
    ['necesito atenci\u00f3n humana', 'es'],
  ] as const;

  for (const [message, language] of examples) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(decision.mode, 'capability');
    if (decision.mode !== 'capability') continue;
    assert.equal(decision.capability, 'human_handoff');
    assert.equal(decision.detectedLanguage, language);
    assert.equal(decision.assistantRoute, 'capability');
    assert.equal(shouldCallAI(decision), false);
  }
});

test('routes an explicit reception command locally without inventing operational information', async () => {
  let clientCreations = 0;
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'en',
    contextId: CONTEXT_ID,
    message: 'CHAME A RECEP\u00c7\u00c3O!!!',
  }, dependencies(() => { clientCreations += 1; }));

  assert.equal(clientCreations, 0);
  assert.equal(result?.assistantRoute, 'capability');
  assert.equal(result?.responseLanguage, 'pt');
  assert.equal(result?.action?.type, 'open_url');
  assert.doesNotMatch(result?.answer ?? '', /5521|quarto|room|lobby|24\s*h|24\/7/i);
});

test('routes every existing deterministic capability through the closed catalog', () => {
  const examples = [
    ['chame a recep\u00e7\u00e3o', 'reception_contact'],
    ['quero falar com a governan\u00e7a', 'housekeeping_contact'],
    ['preciso de duas toalhas', 'housekeeping_request'],
    ['meu quarto precisa ser limpo', 'housekeeping_request'],
  ] as const;

  for (const [message, capability] of examples) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(decision.mode, 'capability');
    if (decision.mode === 'capability') assert.equal(decision.capability, capability);
  }
});

test('strong intents override a pending clarification before it consumes the message', () => {
  for (const [message, capability] of [
    ['meu quarto precisa ser limpo', 'housekeeping_request'],
    ['quero falar com atendente', 'human_handoff'],
  ] as const) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt', pendingRequest: PENDING_TOWELS });
    assert.equal(decision.mode, 'capability');
    if (decision.mode === 'capability') assert.equal(decision.capability, capability);
  }

  const quantity = routeAssistantMessage({ message: 'duas', uiLanguage: 'pt', pendingRequest: PENDING_TOWELS });
  assert.equal(quantity.mode, 'clarification');
  assert.equal(quantity.assistantRoute, 'clarification');
  assert.equal(shouldCallAI(quantity), false);
});

test('closed cancellation clears clarification and does not become an AI message', () => {
  for (const message of ['cancelar', 'cancel', 'd\u00e9jalo']) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt', pendingRequest: PENDING_TOWELS });
    assert.equal(decision.mode, 'deterministic');
    assert.equal(decision.assistantRoute, 'deterministic');
    assert.equal(shouldCallAI(decision), false);
  }
});

test('targeted cancellation without local state is deterministic and creates no request', async () => {
  let classifierCalls = 0;
  let clientCreations = 0;
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Quero cancelar o pedido de toalhas.',
  }, {
    ...dependencies(() => { clientCreations += 1; }),
    async classifyMessage() { classifierCalls += 1; return null; },
  });
  assert.equal(result?.assistantRoute, 'deterministic');
  assert.equal(result?.action, null);
  assert.equal(result?.pendingRequest, null);
  assert.match(result?.answer ?? '', /não encontrei uma solicitação pendente/i);
  assert.match(result?.answer ?? '', /não consegue consultar ou cancelar/i);
  assert.doesNotMatch(result?.answer ?? '', /foi cancelad|enviad[ao] com sucesso/i);
  assert.deepEqual(result?.usageTrace, {
    resolutionPath: 'deterministic', classifierCalls: 0, fullAiCalls: 0, totalUpstreamCalls: 0,
  });
  assert.equal(classifierCalls, 0);
  assert.equal(clientCreations, 0);
});

test('explicit front-desk refusal is local in PT, EN and ES and does not persist', async () => {
  for (const [message, language] of [
    ['Não quero falar com a recepção.', 'pt'],
    ["I don't want to talk to reception.", 'en'],
    ['No quiero hablar con recepción.', 'es'],
  ] as const) {
    let classifierCalls = 0;
    let clientCreations = 0;
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID, message,
    }, {
      ...dependencies(() => { clientCreations += 1; }),
      async classifyMessage() { classifierCalls += 1; return null; },
    });
    assert.equal(result?.assistantRoute, 'deterministic');
    assert.equal(result?.action, null);
    assert.equal(result?.pendingRequest, null);
    assert.deepEqual(result?.usageTrace, {
      resolutionPath: 'deterministic', classifierCalls: 0, fullAiCalls: 0, totalUpstreamCalls: 0,
    });
    assert.equal(classifierCalls, 0);
    assert.equal(clientCreations, 0);
  }

  const later = await runAssistantChat({
    hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
    message: 'Agora quero falar com a recepção.',
  }, dependencies());
  assert.equal(later?.assistantRoute, 'capability');
  assert.equal(later?.action?.type, 'open_url');
});

test('front-desk refusal preserves the original remaining need in PT, EN and ES', async () => {
  for (const [message, language, expectedPrompt, mayaAnswer, forbiddenAdvice] of [
    [
      'Não quero falar com a recepção, só preciso saber o horário do café.',
      'pt',
      'só preciso saber o horário do café.',
      'O café é servido das 6h30 às 10h30. Consulte a recepção para confirmar.',
      /consulte a recepção/i,
    ],
    [
      'I don’t want to contact the front desk, I just need to know what time breakfast starts.',
      'en',
      'I just need to know what time breakfast starts.',
      'Breakfast starts at 6:30. Contact the front desk to confirm.',
      /contact the front desk/i,
    ],
    [
      'No quiero hablar con recepción, solo necesito saber a qué hora empieza el desayuno.',
      'es',
      'solo necesito saber a qué hora empieza el desayuno.',
      'El desayuno empieza a las 6:30. Consulta la recepción para confirmar.',
      /consulta la recepción/i,
    ],
  ] as const) {
    let conversationPrompt = '';
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID, message,
    }, {
      async getPageDataBySlug() { return publicPageData() as never; },
      async classifyMessage() { return null; },
      createClient() {
        return {
          async addContext() {},
          async converse(input) {
            conversationPrompt = input.prompt;
            return mayaAnswer;
          },
        };
      },
    });
    assert.equal(conversationPrompt, expectedPrompt);
    assert.equal(result?.assistantRoute, 'ai');
    assert.equal(result?.action, null);
    assert.doesNotMatch(result?.answer ?? '', forbiddenAdvice);
    assert.equal(result?.usageTrace.fullAiCalls, 1);
  }
});

test('contact refusal removes explicit operational advice but preserves factual reception text', async () => {
  for (const [answer, expected, forbidden] of [
    [
      'O café fica ao lado da recepção e funciona das 6h às 10h. Procure a recepção para resolver isso.',
      /O café fica ao lado da recepção e funciona das 6h às 10h\./,
      /Procure a recepção para resolver isso\./,
    ],
    [
      'Breakfast is beside the front desk. Contact the front desk for help.',
      /Breakfast is beside the front desk\./,
      /Contact the front desk for help\./,
    ],
    [
      'El desayuno está junto a la recepción. Habla con la recepción para resolverlo.',
      /El desayuno está junto a la recepción\./,
      /Habla con la recepción para resolverlo\./,
    ],
    [
      'O café funciona das 6h às 10h. Vou transferir você para a recepção.',
      /O café funciona das 6h às 10h\./,
      /Vou transferir você para a recepção\./,
    ],
    [
      'O café fica ao lado da recepção e funciona das 6h às 10h; procure a recepção para confirmar.',
      /O café fica ao lado da recepção e funciona das 6h às 10h\./,
      /procure a recepção para confirmar/i,
    ],
    [
      'Breakfast is served next to the front desk from 6am to 10am; contact the front desk to confirm.',
      /Breakfast is served next to the front desk from 6am to 10am\./,
      /contact the front desk to confirm/i,
    ],
    [
      'El desayuno se sirve junto a recepción de 6 a 10; habla con recepción para confirmar.',
      /El desayuno se sirve junto a recepción de 6 a 10\./,
      /habla con recepción para confirmar/i,
    ],
  ] as const) {
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language: 'pt', contextId: CONTEXT_ID,
      message: 'Não quero falar com a recepção, só quero saber sobre o café.',
    }, {
      async getPageDataBySlug() { return publicPageData() as never; },
      createClient() {
        return { async addContext() {}, async converse() { return answer; } };
      },
    });
    assert.match(result?.answer ?? '', expected);
    assert.doesNotMatch(result?.answer ?? '', forbidden);
  }
});

test('contact refusal preserves factual clauses around operational advice in PT, EN and ES', () => {
  const examples = [
    {
      language: 'pt',
      acknowledgement: 'Tudo bem. Vou respeitar essa preferência nesta interação.',
      fact: 'O café funciona das 6h às 10h.',
      secondFact: 'O restaurante fica no térreo.',
      recommendation: 'Procure a recepção para confirmar',
      transfer: 'Vou transferir você para a recepção',
      factAtReception: 'O café fica ao lado da recepção.',
      factAtReceptionWithHours: 'O café fica ao lado da recepção e funciona das 6h às 10h.',
      adversative: 'mas',
    },
    {
      language: 'en',
      acknowledgement: 'All right. I will respect that preference in this interaction.',
      fact: 'Breakfast is served from 6am to 10am.',
      secondFact: 'The restaurant is on the ground floor.',
      recommendation: 'Contact the front desk to confirm',
      transfer: 'I will transfer you to the front desk',
      factAtReception: 'Breakfast is served next to the front desk.',
      factAtReceptionWithHours: 'Breakfast is served next to the front desk from 6am to 10am.',
      adversative: 'but',
    },
    {
      language: 'es',
      acknowledgement: 'De acuerdo. Respetaré esa preferencia en esta interacción.',
      fact: 'El desayuno se sirve de 6 a 10.',
      secondFact: 'El restaurante está en la planta baja.',
      recommendation: 'Habla con recepción para confirmar',
      transfer: 'Voy a transferirte con recepción',
      factAtReception: 'El desayuno se sirve junto a recepción.',
      factAtReceptionWithHours: 'El desayuno se sirve junto a recepción de 6 a 10.',
      adversative: 'pero',
    },
  ] as const;

  for (const example of examples) {
    const prefix = `${example.acknowledgement} `;
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.fact.slice(0, -1)}; ${example.recommendation}.`,
        example.language
      ),
      `${prefix}${example.fact}`
    );
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.recommendation}, ${example.adversative} ${example.fact.toLocaleLowerCase(example.language)} `,
        example.language
      ),
      `${prefix}${example.fact}`
    );
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.fact.slice(0, -1)}; ${example.recommendation}; ${example.secondFact}`,
        example.language
      ),
      `${prefix}${example.fact} ${example.secondFact}`
    );
    assert.equal(
      applyContactDeclineToAnswer(`${example.recommendation}.`, example.language),
      `${prefix}${example.language === 'pt'
        ? 'Como posso ajudar de outra forma?'
        : example.language === 'en'
          ? 'How else can I help?'
          : '¿Cómo más puedo ayudarte?'}`
    );
    assert.equal(
      applyContactDeclineToAnswer(example.factAtReception, example.language),
      `${prefix}${example.factAtReception}`
    );
    assert.equal(
      applyContactDeclineToAnswer(example.factAtReceptionWithHours, example.language),
      `${prefix}${example.factAtReceptionWithHours}`
    );
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.transfer}, ${example.adversative} ${example.fact.toLocaleLowerCase(example.language)}`,
        example.language
      ),
      `${prefix}${example.fact}`
    );
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.fact.slice(0, -1)}; ${example.transfer}.`,
        example.language
      ),
      `${prefix}${example.fact}`
    );
    assert.equal(
      applyContactDeclineToAnswer(
        `${example.recommendation}; ${example.fact} ${example.recommendation}.`,
        example.language
      ),
      `${prefix}${example.fact}`
    );
  }
});

test('without refusal Maya reception information remains unchanged', async () => {
  for (const [language, message, mayaAnswer] of [
    [
      'pt',
      'Onde fica o café?',
      'Procure a recepção para confirmar, mas o café funciona das 6h às 10h.',
    ],
    [
      'en',
      'Where is breakfast served?',
      'Contact the front desk to confirm, but breakfast is served from 6am to 10am.',
    ],
    [
      'es',
      '¿Dónde se sirve el desayuno?',
      'Habla con recepción para confirmar, pero el desayuno se sirve de 6 a 10.',
    ],
  ] as const) {
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste', language, contextId: CONTEXT_ID, message,
    }, {
      async getPageDataBySlug() { return publicPageData() as never; },
      createClient() {
        return { async addContext() {}, async converse() { return mayaAnswer; } };
      },
    });
    assert.equal(result?.answer, mayaAnswer);
  }
});

test('generic negatives and informative mentions do not trigger deterministic cancellation or refusal', () => {
  for (const message of [
    'Não quero falar sobre isso agora.',
    'Não sei qual é o horário da recepção.',
    'Não encontrei toalhas no site.',
    'A recepção do casamento estava bonita.',
    'As toalhas estavam bem dobradas.',
  ]) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.notEqual(decision.mode, 'deterministic', message);
    if (decision.mode === 'capability') {
      assert.notEqual(decision.capability, 'housekeeping_request', message);
      assert.notEqual(decision.capability, 'reception_contact', message);
      assert.notEqual(decision.capability, 'human_handoff', message);
    }
  }
});

test('operational ambiguity enters classification while non-operational messages route to AI', () => {
  const operational = routeAssistantMessage({
    message: 'prefiro resolver com algu\u00e9m',
    uiLanguage: 'pt',
  });
  assert.equal(operational.mode, 'classification');
  assert.equal(operational.assistantRoute, 'classification');
  assert.equal(shouldCallAI(operational), false);

  for (const [message, reason] of [
    ['Qual o hor\u00e1rio do caf\u00e9?', 'open_question'],
    ['xyz', 'ambiguous'],
  ] as const) {
    const decision = routeAssistantMessage({ message, uiLanguage: 'pt' });
    assert.equal(decision.mode, 'ai');
    assert.equal(decision.assistantRoute, 'ai');
    if (decision.mode === 'ai') assert.equal(decision.reason, reason);
    assert.equal(shouldCallAI(decision), true);
  }
});

test('human handoff is localized, server-owned and never calls or claims GPTMaker transfer', async () => {
  for (const [message, language, label] of [
    ['quero falar com atendente', 'pt', 'Falar com a equipe'],
    ['I want to talk to a human', 'en', 'Contact the team'],
    ['necesito un agente', 'es', 'Hablar con el equipo'],
  ] as const) {
    let clientCreations = 0;
    const result = await runAssistantChat({
      hotelSlug: 'hotel-teste',
      language: 'pt',
      contextId: CONTEXT_ID,
      message,
    }, dependencies(() => { clientCreations += 1; }));

    assert.equal(clientCreations, 0);
    assert.equal(result?.assistantRoute, 'capability');
    assert.equal(result?.responseLanguage, language);
    assert.equal(result?.action?.type, 'open_url');
    assert.equal(result?.action?.label, label);
    assert.equal(result?.action?.type === 'open_url' ? result.action.url : null, 'https://wa.me/5521999999999');
    assert.doesNotMatch(result?.answer ?? '', /transferid|transferred|conect|assumiu|avisada|notificad/i);
  }
});

test('strong intent replaces clarification in the chat flow and GPTMaker remains uncreated', async () => {
  let clientCreations = 0;
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'pt',
    contextId: CONTEXT_ID,
    message: 'meu quarto precisa ser limpo',
    pendingRequest: PENDING_TOWELS,
  }, dependencies(() => { clientCreations += 1; }));

  assert.equal(clientCreations, 0);
  assert.equal(result?.assistantRoute, 'capability');
  assert.equal(result?.pendingRequest, null);
  assert.equal(result?.action?.type, 'confirm_request');
  if (result?.action?.type === 'confirm_request') {
    assert.equal(result.action.request.requestType, 'room_cleaning');
  }
});

test('cancellation clears pending state and a simple quantity continues clarification', async () => {
  let clientCreations = 0;
  const cancel = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'en',
    contextId: CONTEXT_ID,
    message: 'cancelar',
    pendingRequest: PENDING_TOWELS,
  }, dependencies(() => { clientCreations += 1; }));
  assert.equal(cancel?.pendingRequest, null);
  assert.equal(cancel?.action, null);
  assert.equal(cancel?.assistantRoute, 'deterministic');

  const quantity = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'en',
    contextId: CONTEXT_ID,
    message: 'duas',
    pendingRequest: PENDING_TOWELS,
  }, dependencies(() => { clientCreations += 1; }));
  assert.equal(quantity?.assistantRoute, 'clarification');
  assert.equal(quantity?.action?.type, 'confirm_request');
  assert.equal(clientCreations, 0);
});

test('general chat calls GPTMaker once and preserves the original message', async () => {
  let clientCreations = 0;
  let conversationPrompt = '';
  let contextPrompt = '';
  const original = 'Qual o HOR\u00c1RIO do caf\u00e9?!';
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'pt',
    contextId: CONTEXT_ID,
    message: original,
  }, {
    async getPageDataBySlug() {
      return publicPageData() as never;
    },
    createClient() {
      clientCreations += 1;
      return {
        async addContext(input) { contextPrompt = input.prompt; },
        async converse(input) {
          conversationPrompt = input.prompt;
          return 'Resposta da Maya';
        },
      };
    },
  });

  assert.equal(clientCreations, 1);
  assert.equal(conversationPrompt, original);
  assert.equal(result?.assistantRoute, 'ai');
  assert.match(contextPrompt, /Nunca afirme transfer\u00eancia humana/);
  assert.match(contextPrompt, /Nunca afirme que um pedido foi enviado/);
  assert.match(contextPrompt, /Nunca invente canais de contato, hor\u00e1rios operacionais/);
});

test('an unknown message also follows the AI route', async () => {
  let clientCreations = 0;
  const result = await runAssistantChat({
    hotelSlug: 'hotel-teste',
    language: 'pt',
    contextId: CONTEXT_ID,
    message: 'xyz without a closed catalog match',
  }, dependencies(() => { clientCreations += 1; }));

  assert.equal(clientCreations, 1);
  assert.equal(result?.assistantRoute, 'ai');
});

test('rate limit remains before routing and no classifier or external executor is introduced', () => {
  const routeSource = read('app', 'api', 'assistant', 'chat', 'route.ts');
  const routerSource = read('lib', 'assistant-router', 'router.ts');
  const tree = [
    routerSource,
    read('lib', 'assistant-router', 'strong-intents.ts'),
    read('lib', 'assistant-tools', 'human-handoff.ts'),
  ].join('\n');

  const postBody = routeSource.slice(routeSource.indexOf('export async function POST'));
  assert.ok(postBody.indexOf('consumeAssistantRateLimit') < postBody.indexOf('runAssistantChat'));
  assert.doesNotMatch(tree, /GPTMaker|n8n|MCP|fetch\(|supabase|roomToken|hotelId/i);
  assert.match(read('lib', 'assistant-chat.ts'), /routeAssistantMessage[\s\S]*switch \(decision\.mode\)/);
});
