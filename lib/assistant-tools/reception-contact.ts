import type { PublicHotelPageData } from '../public-hotel-data.ts';
import type { SupportedPublicLanguage } from '../public-language.ts';
import type {
  AssistantAction,
  GetReceptionContactInput,
  ReceptionContactResult,
} from './types.ts';
import {
  detectClosedCatalogIntent,
  normalizeClosedCatalogText,
} from './intent-detection.ts';
import {
  getPublicDepartmentContact,
  isAssistantContactInput,
  resolvePublicDepartmentContact,
  type PublicContactDependencies,
  type PublicDepartmentContactConfig,
} from './public-contact.ts';

const RECEPTION_NAMES = new Set([
  'recepcao',
  'recepcao do hotel',
  'reception',
  'hotel reception',
  'front desk',
  'recepcion',
  'recepcion del hotel',
]);
const RECEPTION_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set([
    'quero falar com a recepcao',
    'agora quero falar com a recepcao',
    'como falo com a recepcao',
    'preciso falar com alguem do hotel',
    'me passa o contato da recepcao',
    'contato da recepcao',
    'falar com a recepcao',
    'chame a recepcao',
  ]),
  en: new Set([
    'i want to talk to reception',
    'now i want to talk to reception',
    'i want to speak to reception',
    'front desk contact',
    'how do i contact reception',
    'contact reception',
    'contact the front desk',
  ]),
  es: new Set([
    'quiero hablar con recepcion',
    'ahora quiero hablar con recepcion',
    'contacto de recepcion',
    'como contacto con recepcion',
    'hablar con recepcion',
  ]),
};

const CONTACT_DECLINE_PREFIXES: Record<SupportedPublicLanguage, readonly string[]> = {
  pt: [
    'nao quero falar com a recepcao',
    'nao quero falar com recepcao',
    'nao quero contato com a recepcao',
    'nao quero falar com atendente',
    'nao quero falar com um atendente',
    'nao quero falar com uma pessoa',
    'nao quero atendimento humano',
    'prefiro nao falar com a recepcao',
  ],
  en: [
    'i don t want to talk to reception',
    'i dont want to talk to reception',
    'i do not want to talk to reception',
    'i don t want to speak to reception',
    'i dont want to speak to reception',
    'i do not want to speak to reception',
    'i don t want to contact the front desk',
    'i dont want to contact the front desk',
    'i do not want to contact the front desk',
    'i don t want to talk to a human',
    'i dont want to talk to a human',
    'i do not want to talk to a human',
    'i don t want a human agent',
    'i dont want a human agent',
    'i do not want a human agent',
  ],
  es: [
    'no quiero hablar con recepcion',
    'no quiero contactar con recepcion',
    'no quiero hablar con un agente',
    'no quiero hablar con una persona',
    'no quiero atencion humana',
    'prefiero no hablar con recepcion',
  ],
};

const OPERATIONAL_CONTACT_RECOMMENDATION_PATTERNS = [
  /\b(?:fale|converse) com (?:a |o |um |uma )?(?:recepcao|atendente|equipe do hotel)\b/i,
  /\b(?:entre em contato com|contate|procure|consulte|chame|ligue para|va ate|dirija se a) (?:a |o |um |uma )?(?:recepcao|atendente|equipe do hotel)\b/i,
  /\b(?:contact|call|ask|visit) (?:the |a )?(?:reception|front desk|human agent|hotel staff)\b/i,
  /\b(?:talk|speak) to (?:the |a )?(?:reception|front desk|human agent|hotel staff)\b/i,
  /\b(?:go to|check with|reach out to) (?:the |a )?(?:reception|front desk|human agent|hotel staff)\b/i,
  /\b(?:contacta|contacte|llama|busca|consulta|consulte|ve a|acude a) (?:la |el |un |una )?(?:recepcion|agente humano|personal del hotel)\b/i,
  /\bhabla con (?:la |el |un |una )?(?:recepcion|agente humano|personal del hotel)\b/i,
  /\b(?:vou|estou) (?:te |lhe )?(?:transferir|encaminhar|conectar|transferindo|encaminhando|conectando) (?:voce )?(?:para|com) (?:a |o |um |uma )?(?:recepcao|atendente|equipe do hotel)\b/i,
  /\bi (?:will|ll|am) (?:transfer|connect|transferring|connecting) you (?:to|with) (?:the |a )?(?:reception|front desk|human agent|hotel staff)\b/i,
  /\b(?:voy a|estoy) (?:transferirte|conectarte|transfiriendote|conectandote) (?:con|a) (?:la |el |un |una )?(?:recepcion|agente humano|personal del hotel)\b/i,
] as const;

const CONTACT_DECLINE_COPY = {
  pt: {
    standalone: 'Tudo bem. Não vou abrir o contato com a recepção. Como posso ajudar de outra forma?',
    acknowledgement: 'Tudo bem. Vou respeitar essa preferência nesta interação.',
    fallback: 'Como posso ajudar de outra forma?',
  },
  en: {
    standalone: 'All right. I will not open contact with the front desk. How else can I help?',
    acknowledgement: 'All right. I will respect that preference in this interaction.',
    fallback: 'How else can I help?',
  },
  es: {
    standalone: 'De acuerdo. No abriré el contacto con recepción. ¿Cómo más puedo ayudarte?',
    acknowledgement: 'De acuerdo. Respetaré esa preferencia en esta interacción.',
    fallback: '¿Cómo más puedo ayudarte?',
  },
} as const;

export interface ContactDeclineDetection {
  detectedLanguage: SupportedPublicLanguage;
  remainingMessage: string | null;
}

function extractOriginalRemainder(message: string, normalizedPrefix: string) {
  const originalWords = Array.from(message.matchAll(/[\p{L}\p{N}]+/gu));
  const prefixWordCount = normalizedPrefix.split(' ').length;
  const finalPrefixWord = originalWords[prefixWordCount - 1];
  if (!finalPrefixWord || finalPrefixWord.index === undefined) return null;
  const remainder = message
    .slice(finalPrefixWord.index + finalPrefixWord[0].length)
    .replace(/^[\s,;:.!?…—–-]+/u, '')
    .trim();
  return remainder || null;
}

export function detectContactDecline(message: string): ContactDeclineDetection | null {
  const normalized = normalizeClosedCatalogText(message);
  for (const language of Object.keys(CONTACT_DECLINE_PREFIXES) as SupportedPublicLanguage[]) {
    for (const prefix of CONTACT_DECLINE_PREFIXES[language]) {
      if (normalized === prefix) return { detectedLanguage: language, remainingMessage: null };
      if (!normalized.startsWith(`${prefix} `)) continue;
      return {
        detectedLanguage: language,
        remainingMessage: extractOriginalRemainder(message, prefix),
      };
    }
  }
  return null;
}

export function buildContactDeclinedResponse(language: SupportedPublicLanguage) {
  return CONTACT_DECLINE_COPY[language].standalone;
}

function findOperationalContactStart(clause: string) {
  for (const word of clause.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (word.index === undefined) continue;
    const suffix = normalizeClosedCatalogText(clause.slice(word.index));
    if (OPERATIONAL_CONTACT_RECOMMENDATION_PATTERNS.some((pattern) =>
      pattern.exec(suffix)?.index === 0
    )) {
      return word.index;
    }
  }
  return null;
}

function preserveFactualClausePrefix(clause: string) {
  const operationalStart = findOperationalContactStart(clause);
  if (operationalStart === null) return clause.trim();
  return clause
    .slice(0, operationalStart)
    .trimEnd()
    .replace(/[\s,;:—–-]+$/u, '')
    .replace(/\s+(?:mas|but|pero|e|and|y)$/iu, '')
    .replace(/[\s,;:—–-]+$/u, '')
    .trim();
}

function punctuateFactualClause(clause: string) {
  const factualClause = preserveFactualClausePrefix(clause)
    .replace(/^\p{Ll}/u, (initial) => initial.toLocaleUpperCase());
  if (!factualClause || /[.!?]$/u.test(factualClause)) return factualClause;
  return `${factualClause}.`;
}

export function applyContactDeclineToAnswer(
  answer: string,
  language: SupportedPublicLanguage
) {
  const hasOperationalRecommendation = findOperationalContactStart(answer) !== null;
  const safeSentences = hasOperationalRecommendation
    ? answer
        .split(/(?:;\s*|,\s*(?:mas|but|pero)\s+|(?<=[.!?])\s+)/iu)
        .map(punctuateFactualClause)
        .filter(Boolean)
        .join(' ')
        .trim()
    : answer.trim();
  const copy = CONTACT_DECLINE_COPY[language];
  return `${copy.acknowledgement} ${safeSentences || copy.fallback}`;
}

const COPY = {
  pt: {
    whatsappLabel: 'Falar com a recepção',
    whatsappAnswer: 'Claro. Você pode falar com a recepção pelo WhatsApp oficial do hotel.',
    phoneLabel: 'Telefone da recepção',
    phoneAnswer: (phone: string) => `Você pode falar com a recepção pelo telefone ${phone}.`,
    contactLabel: 'Abrir área de Contato',
    contactAnswer: 'Não encontrei um canal direto da recepção configurado no momento. Consulte a área de Contato do hotel.',
    unavailableLabel: 'Recepção indisponível',
    unavailableAnswer: 'Não encontrei um canal público da recepção configurado no momento. Consulte a área de Contato do hotel.',
  },
  en: {
    whatsappLabel: 'Contact the front desk',
    whatsappAnswer: 'You can contact the front desk through the hotel’s official WhatsApp.',
    phoneLabel: 'Front desk phone',
    phoneAnswer: (phone: string) => `You can contact the front desk by phone at ${phone}.`,
    contactLabel: 'Open Contact area',
    contactAnswer: 'I could not find a direct front desk channel configured right now. Please check the hotel’s Contact area.',
    unavailableLabel: 'Front desk unavailable',
    unavailableAnswer: 'I could not find a public front desk channel configured right now. Please check the hotel’s Contact area.',
  },
  es: {
    whatsappLabel: 'Hablar con recepción',
    whatsappAnswer: 'Puedes contactar con recepción a través del WhatsApp oficial del hotel.',
    phoneLabel: 'Teléfono de recepción',
    phoneAnswer: (phone: string) => `Puedes contactar con recepción por teléfono en el ${phone}.`,
    contactLabel: 'Abrir área de Contacto',
    contactAnswer: 'No encontré un canal directo de recepción configurado en este momento. Consulta el área de Contacto del hotel.',
    unavailableLabel: 'Recepción no disponible',
    unavailableAnswer: 'No encontré un canal público de recepción configurado en este momento. Consulta el área de Contacto del hotel.',
  },
} as const;

const RECEPTION_CONTACT_CONFIG: PublicDepartmentContactConfig<'reception'> = {
  department: 'reception',
  departmentNames: RECEPTION_NAMES,
  labels: {
    pt: {
      whatsapp: COPY.pt.whatsappLabel,
      phone: COPY.pt.phoneLabel,
      departmentUrl: COPY.pt.contactLabel,
      contactPage: COPY.pt.contactLabel,
      unavailable: COPY.pt.unavailableLabel,
    },
    en: {
      whatsapp: COPY.en.whatsappLabel,
      phone: COPY.en.phoneLabel,
      departmentUrl: COPY.en.contactLabel,
      contactPage: COPY.en.contactLabel,
      unavailable: COPY.en.unavailableLabel,
    },
    es: {
      whatsapp: COPY.es.whatsappLabel,
      phone: COPY.es.phoneLabel,
      departmentUrl: COPY.es.contactLabel,
      contactPage: COPY.es.contactLabel,
      unavailable: COPY.es.unavailableLabel,
    },
  },
};

export type GetReceptionContactDependencies = PublicContactDependencies;

export interface ReceptionContactChatResponse {
  answer: string;
  action: AssistantAction | null;
}

export function isGetReceptionContactInput(value: unknown): value is GetReceptionContactInput {
  return isAssistantContactInput(value);
}

export function detectReceptionContactIntent(
  message: string
) {
  return detectClosedCatalogIntent({
    message,
    intent: 'reception_contact',
    catalog: RECEPTION_INTENTS,
  });
}

export function resolveReceptionContactFromPublicData({
  input,
  pageData,
}: {
  input: GetReceptionContactInput;
  pageData: PublicHotelPageData;
}): ReceptionContactResult {
  return resolvePublicDepartmentContact({
    input,
    pageData,
    config: RECEPTION_CONTACT_CONFIG,
  });
}

/**
 * Internal LibGuest capability prepared for a future MCP adapter.
 * It performs read-only public-data resolution and must not execute guest requests.
 */
export async function getReceptionContact(
  input: GetReceptionContactInput,
  dependencies: GetReceptionContactDependencies
) {
  return getPublicDepartmentContact(input, dependencies, RECEPTION_CONTACT_CONFIG);
}

export function buildReceptionContactChatResponse(
  result: ReceptionContactResult,
  language: SupportedPublicLanguage
): ReceptionContactChatResponse {
  const copy = COPY[language];
  const answer = result.channel === 'whatsapp'
    ? copy.whatsappAnswer
    : result.channel === 'phone' && result.displayValue
      ? copy.phoneAnswer(result.displayValue)
      : result.channel === 'contact_page'
        ? copy.contactAnswer
        : copy.unavailableAnswer;
  return {
    answer,
    action: result.actionUrl
      ? { type: 'open_url', label: result.label, url: result.actionUrl }
      : null,
  };
}
