import type { SupportedPublicLanguage } from '../public-language.ts';
import {
  detectClosedCatalogIntent,
  normalizeClosedCatalogText,
  type AssistantIntentDetection,
} from './intent-detection.ts';
import type {
  AssistantConfirmRequestAction,
  ClarificationResolution,
  HousekeepingPendingRequest,
  HousekeepingRequest,
} from './types.ts';

const CLARIFICATION_CANCEL_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set([
    'cancelar', 'cancela', 'deixa pra la', 'deixe pra la', 'nao quero mais',
    'nao preciso mais',
  ]),
  en: new Set([
    'cancel', 'never mind', 'nevermind', 'i don t want it anymore', 'i dont want it anymore',
    'i no longer want it',
  ]),
  es: new Set([
    'cancelar', 'cancela', 'dejalo', 'dejalo estar', 'no quiero mas',
    'ya no lo quiero',
  ]),
};

const HOUSEKEEPING_CANCELLATION_INTENTS: Record<
  SupportedPublicLanguage,
  ReadonlyMap<string, 'towels' | 'room_cleaning'>
> = {
  pt: new Map([
    ['quero cancelar o pedido de toalhas', 'towels'],
    ['quero cancelar a solicitacao de toalhas', 'towels'],
    ['cancelar o pedido de toalhas', 'towels'],
    ['cancelar pedido de toalhas', 'towels'],
    ['cancelar a solicitacao de toalhas', 'towels'],
    ['quero cancelar o pedido de limpeza', 'room_cleaning'],
    ['quero cancelar a solicitacao de limpeza', 'room_cleaning'],
    ['cancelar o pedido de limpeza', 'room_cleaning'],
    ['cancelar pedido de limpeza', 'room_cleaning'],
  ]),
  en: new Map([
    ['i want to cancel the towel request', 'towels'],
    ['cancel the towel request', 'towels'],
    ['cancel my towel request', 'towels'],
    ['i want to cancel the room cleaning request', 'room_cleaning'],
    ['cancel the room cleaning request', 'room_cleaning'],
  ]),
  es: new Map([
    ['quiero cancelar el pedido de toallas', 'towels'],
    ['quiero cancelar la solicitud de toallas', 'towels'],
    ['cancelar el pedido de toallas', 'towels'],
    ['cancelar la solicitud de toallas', 'towels'],
    ['quiero cancelar la solicitud de limpieza', 'room_cleaning'],
  ]),
};

export const HOUSEKEEPING_PREPARATION_DISCARDED_COPY: Record<
  SupportedPublicLanguage,
  string
> = {
  pt: 'A solicitação em preparação foi descartada. Nada foi enviado ao hotel.',
  en: 'The request being prepared was discarded. Nothing was sent to the hotel.',
  es: 'La solicitud en preparación fue descartada. No se envió nada al hotel.',
};

export const HOUSEKEEPING_CANCELLATION_UNAVAILABLE_COPY: Record<
  SupportedPublicLanguage,
  string
> = {
  pt: 'Não encontrei uma solicitação pendente nesta conversa. O LibGuest ainda não consegue consultar ou cancelar solicitações que já tenham sido enviadas ao hotel.',
  en: 'I could not find a pending request in this conversation. LibGuest cannot yet check or cancel requests that may already have been sent to the hotel.',
  es: 'No encontré una solicitud pendiente en esta conversación. LibGuest todavía no puede consultar ni cancelar solicitudes que ya se hayan enviado al hotel.',
};

const QUANTITY_TOKENS: Record<SupportedPublicLanguage, Readonly<Record<string, number>>> = {
  pt: {
    '1': 1, um: 1, uma: 1,
    '2': 2, dois: 2, duas: 2,
    '3': 3, tres: 3,
    '4': 4, quatro: 4,
    '5': 5, cinco: 5,
    '6': 6, seis: 6,
  },
  en: {
    '1': 1, one: 1,
    '2': 2, two: 2,
    '3': 3, three: 3,
    '4': 4, four: 4,
    '5': 5, five: 5,
    '6': 6, six: 6,
  },
  es: {
    '1': 1, uno: 1, una: 1,
    '2': 2, dos: 2,
    '3': 3, tres: 3,
    '4': 4, cuatro: 4,
    '5': 5, cinco: 5,
    '6': 6, seis: 6,
  },
};

const CLARIFICATION_QUANTITY_PREFIXES: Record<
  SupportedPublicLanguage,
  readonly string[]
> = {
  pt: ['', 'quero ', 'so ', 'pode ser '],
  en: ['', 'i want ', 'just ', 'make it '],
  es: ['', 'quiero ', 'solo ', 'puede ser '],
};

const CLARIFICATION_TOWEL_SUFFIXES: Record<SupportedPublicLanguage, readonly string[]> = {
  pt: ['', ' toalha', ' toalhas'],
  en: ['', ' towel', ' towels'],
  es: ['', ' toalla', ' toallas'],
};

const OUT_OF_RANGE_WORDS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set(['sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte']),
  en: new Set(['seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']),
  es: new Set(['siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte']),
};

const UNCERTAIN_CLARIFICATION_RESPONSES: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set(['muitas', 'muitas toalhas', 'nao sei']),
  en: new Set(['many', 'many towels', 'i dont know']),
  es: new Set(['muchas', 'muchas toallas', 'no se']),
};

const MISSING_QUANTITY_RESPONSES: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set(['toalha', 'toalhas', 'quantas posso pedir']),
  en: new Set(['towel', 'towels', 'how many can i request']),
  es: new Set(['toalla', 'toallas', 'cuantas puedo pedir']),
};

function towelIntentPhrases(
  language: SupportedPublicLanguage,
  withoutQuantity: readonly string[],
  template: (token: string) => string
) {
  return new Set([
    ...withoutQuantity,
    ...Object.keys(QUANTITY_TOKENS[language]).map(template),
  ]);
}

const TOWEL_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: towelIntentPhrases('pt', [
    'preciso de toalha',
    'preciso de toalhas',
    'preciso de 1 toalha',
    'preciso de uma toalha',
    'quero toalhas',
  ], (token) => `preciso de ${token} toalhas`),
  en: towelIntentPhrases('en', ['i need towels'], (token) => `i need ${token} towels`),
  es: towelIntentPhrases('es', ['necesito toallas'], (token) => `necesito ${token} toallas`),
};

const ROOM_CLEANING_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set([
    'meu quarto precisa ser limpo',
    'preciso de limpeza no quarto',
    'quero solicitar limpeza do quarto',
  ]),
  en: new Set([
    'i need my room cleaned',
    'my room needs cleaning',
    'i want room cleaning',
  ]),
  es: new Set([
    'necesito limpieza en la habitacion',
    'mi habitacion necesita limpieza',
  ]),
};

const OUT_OF_RANGE_TOWEL_PATTERNS: Record<SupportedPublicLanguage, RegExp> = {
  pt: /^preciso de (\d+) toalhas$/,
  en: /^i need (\d+) towels$/,
  es: /^necesito (\d+) toallas$/,
};

const COPY = {
  pt: {
    quantityQuestion: 'Quantas toalhas você precisa?',
    towelsAnswer: (quantity: number) => `Posso preparar uma solicitação de ${quantity} ${quantity === 1 ? 'toalha' : 'toalhas'} para a Governança. Deseja confirmar?`,
    cleaningAnswer: 'Posso preparar uma solicitação de limpeza para a Governança. Deseja confirmar?',
    confirm: 'Confirmar solicitação',
    cancel: 'Cancelar',
    retryRange: 'Informe uma quantidade entre 1 e 6 toalhas.',
    retryUncertain: 'Tudo bem. Quando souber, informe uma quantidade entre 1 e 6 toalhas.',
  },
  en: {
    quantityQuestion: 'How many towels do you need?',
    towelsAnswer: (quantity: number) => `I can prepare a request for ${quantity} towels for Housekeeping. Would you like to confirm?`,
    cleaningAnswer: 'I can prepare a room cleaning request for Housekeeping. Would you like to confirm?',
    confirm: 'Confirm request',
    cancel: 'Cancel',
    retryRange: 'Please enter a quantity between 1 and 6 towels.',
    retryUncertain: 'No problem. When you know, enter a quantity between 1 and 6 towels.',
  },
  es: {
    quantityQuestion: '¿Cuántas toallas necesitas?',
    towelsAnswer: (quantity: number) => `Puedo preparar una solicitud de ${quantity} toallas para Gobernanza. ¿Deseas confirmarla?`,
    cleaningAnswer: 'Puedo preparar una solicitud de limpieza de la habitación para Gobernanza. ¿Deseas confirmarla?',
    confirm: 'Confirmar solicitud',
    cancel: 'Cancelar',
    retryRange: 'Indica una cantidad entre 1 y 6 toallas.',
    retryUncertain: 'No hay problema. Cuando lo sepas, indica una cantidad entre 1 y 6 toallas.',
  },
} as const;

export interface HousekeepingRequestDetection
  extends AssistantIntentDetection<'request_housekeeping'> {
  requestType: 'towels' | 'room_cleaning';
}

export interface PreparedHousekeepingRequest {
  detection: HousekeepingRequestDetection;
  request: HousekeepingRequest;
}

export interface PreparedHousekeepingChatResponse {
  answer: string;
  action: AssistantConfirmRequestAction | null;
  pendingRequest: HousekeepingPendingRequest | null;
  responseLanguage: SupportedPublicLanguage;
}

function detectCatalogLanguage(
  normalized: string,
  catalog: Record<SupportedPublicLanguage, ReadonlySet<string>>,
  fallback: SupportedPublicLanguage
) {
  const matches = (Object.keys(catalog) as SupportedPublicLanguage[])
    .filter((language) => catalog[language].has(normalized));
  return matches.length === 1 ? matches[0] : fallback;
}

function detectCancellationLanguage(
  message: string,
  catalog: Record<SupportedPublicLanguage, ReadonlySet<string>>,
  fallback: SupportedPublicLanguage | null
) {
  const normalized = normalizeClosedCatalogText(message);
  const matches = (Object.keys(catalog) as SupportedPublicLanguage[])
    .filter((language) => catalog[language].has(normalized));
  if (!matches.length) return null;
  return matches.length === 1 ? matches[0] : fallback ?? matches[0];
}

export function detectHousekeepingPreparationCancellation(
  message: string,
  fallback: SupportedPublicLanguage
) {
  return detectHousekeepingPreparationCancellationTarget(message, fallback)?.detectedLanguage ?? null;
}

export interface HousekeepingPreparationCancellationTarget {
  detectedLanguage: SupportedPublicLanguage;
  requestType: 'towels' | 'room_cleaning' | null;
}

export function detectHousekeepingPreparationCancellationTarget(
  message: string,
  fallback: SupportedPublicLanguage
): HousekeepingPreparationCancellationTarget | null {
  const genericLanguage = detectCancellationLanguage(
    message,
    CLARIFICATION_CANCEL_INTENTS,
    fallback
  );
  if (genericLanguage) return { detectedLanguage: genericLanguage, requestType: null };

  const normalized = normalizeClosedCatalogText(message);
  const matches: HousekeepingPreparationCancellationTarget[] = [];
  for (const language of Object.keys(HOUSEKEEPING_CANCELLATION_INTENTS) as SupportedPublicLanguage[]) {
    const requestType = HOUSEKEEPING_CANCELLATION_INTENTS[language].get(normalized);
    if (requestType) matches.push({ detectedLanguage: language, requestType });
  }
  if (!matches.length) return null;
  return matches.length === 1 ? matches[0] : { ...matches[0], detectedLanguage: fallback };
}

export function detectHousekeepingCancellationWithoutPending(message: string) {
  const cancellation = detectHousekeepingPreparationCancellationTarget(message, 'pt');
  return cancellation?.requestType ? cancellation.detectedLanguage : null;
}

function matchClarificationQuantity(
  normalized: string,
  fallback: SupportedPublicLanguage
) {
  const matches: Array<{ language: SupportedPublicLanguage; quantity: number }> = [];
  for (const language of Object.keys(QUANTITY_TOKENS) as SupportedPublicLanguage[]) {
    for (const [token, quantity] of Object.entries(QUANTITY_TOKENS[language])) {
      if (CLARIFICATION_QUANTITY_PREFIXES[language].some((prefix) =>
        CLARIFICATION_TOWEL_SUFFIXES[language].some(
          (suffix) => normalized === `${prefix}${token}${suffix}`
        )
      )) {
        matches.push({ language, quantity });
      }
    }
  }
  if (!matches.length) return null;
  const quantity = matches[0].quantity;
  if (matches.some((match) => match.quantity !== quantity)) return null;
  const languages = new Set(matches.map((match) => match.language));
  return {
    quantity,
    detectedLanguage: languages.size === 1 ? matches[0].language : fallback,
  };
}

function matchedOutOfRangeTowelLanguage(normalizedMessage: string) {
  const matches = (Object.keys(OUT_OF_RANGE_TOWEL_PATTERNS) as SupportedPublicLanguage[])
    .filter((language) => OUT_OF_RANGE_TOWEL_PATTERNS[language].test(normalizedMessage));
  return matches.length === 1 ? matches[0] : null;
}

export function detectHousekeepingRequestIntent(
  message: string
): HousekeepingRequestDetection | null {
  const towels = detectClosedCatalogIntent({
    message,
    intent: 'request_housekeeping',
    catalog: TOWEL_INTENTS,
  });
  if (towels) return { ...towels, requestType: 'towels' };

  const normalizedMessage = normalizeClosedCatalogText(message);
  const outOfRangeLanguage = matchedOutOfRangeTowelLanguage(normalizedMessage);
  if (outOfRangeLanguage) {
    return {
      intent: 'request_housekeeping',
      detectedLanguage: outOfRangeLanguage,
      requestType: 'towels',
    };
  }

  const cleaning = detectClosedCatalogIntent({
    message,
    intent: 'request_housekeeping',
    catalog: ROOM_CLEANING_INTENTS,
  });
  return cleaning ? { ...cleaning, requestType: 'room_cleaning' } : null;
}

export function parseHousekeepingTowelQuantity(
  value: string,
  language: SupportedPublicLanguage
) {
  const normalized = normalizeClosedCatalogText(value);
  const clarificationQuantity = matchClarificationQuantity(normalized, language);
  if (clarificationQuantity) return clarificationQuantity.quantity;
  const directQuantity = QUANTITY_TOKENS[language][normalized];
  if (directQuantity) return directQuantity;

  const words = normalized.split(' ');
  const towelWord = language === 'pt' ? /^toalhas?$/ : language === 'en' ? /^towels?$/ : /^toallas?$/;
  const towelIndex = words.findIndex((word) => towelWord.test(word));
  if (towelIndex <= 0) return null;
  return QUANTITY_TOKENS[language][words[towelIndex - 1]] ?? null;
}

export function resolveHousekeepingQuantityClarification(
  message: string,
  pendingRequest: HousekeepingPendingRequest
): ClarificationResolution {
  const fallback = pendingRequest.language;
  const cancellationLanguage = detectHousekeepingPreparationCancellation(message, fallback);
  if (cancellationLanguage) {
    return { kind: 'cancelled', detectedLanguage: cancellationLanguage };
  }

  const normalized = normalizeClosedCatalogText(message);

  const valid = matchClarificationQuantity(normalized, fallback);
  if (valid) {
    return {
      kind: 'resolved',
      request: {
        kind: 'housekeeping',
        requestType: 'towels',
        quantity: valid.quantity,
      },
      detectedLanguage: valid.detectedLanguage,
    };
  }

  const numericMatch = normalized.match(/^(\d+)(?: (?:toalhas?|towels?|toallas?))?$/);
  if (numericMatch) {
    return {
      kind: 'retry',
      reason: 'out_of_range',
      detectedLanguage: fallback,
    };
  }

  for (const language of Object.keys(OUT_OF_RANGE_WORDS) as SupportedPublicLanguage[]) {
    const words = OUT_OF_RANGE_WORDS[language];
    const towelSuffix = language === 'pt' ? ' toalhas' : language === 'en' ? ' towels' : ' toallas';
    if (words.has(normalized) || words.has(normalized.replace(new RegExp(`${towelSuffix}$`), ''))) {
      return { kind: 'retry', reason: 'out_of_range', detectedLanguage: language };
    }
  }

  for (const [reason, catalog] of [
    ['uncertain', UNCERTAIN_CLARIFICATION_RESPONSES],
    ['missing_quantity', MISSING_QUANTITY_RESPONSES],
  ] as const) {
    if ((Object.values(catalog) as ReadonlySet<string>[]).some((values) => values.has(normalized))) {
      return {
        kind: 'retry',
        reason,
        detectedLanguage: detectCatalogLanguage(normalized, catalog, fallback),
      };
    }
  }

  return { kind: 'escape' };
}

export function buildHousekeepingClarificationRetryResponse(
  reason: Extract<ClarificationResolution, { kind: 'retry' }>['reason'],
  language: SupportedPublicLanguage
): PreparedHousekeepingChatResponse {
  const copy = COPY[language];
  return {
    answer: reason === 'uncertain' ? copy.retryUncertain : copy.retryRange,
    action: null,
    pendingRequest: { kind: 'housekeeping', requestType: 'towels', language },
    responseLanguage: language,
  };
}

/**
 * Builds a validated request proposal only. It does not execute or transmit the request.
 * Future flow: confirm_request -> POST /api/assistant/actions/housekeeping -> n8n
 * -> real sent/failed result. No executeHousekeepingRequest exists in this POC stage.
 */
export function prepareHousekeepingRequest(message: string): PreparedHousekeepingRequest | null {
  const detection = detectHousekeepingRequestIntent(message);
  if (!detection) return null;
  const language = detection.detectedLanguage;
  const quantity = detection.requestType === 'towels' && language
    ? parseHousekeepingTowelQuantity(message, language)
    : null;
  return {
    detection,
    request: detection.requestType === 'towels'
      ? { kind: 'housekeeping', requestType: 'towels', quantity }
      : { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
  };
}

export function continueHousekeepingQuantityClarification(
  message: string,
  pendingRequest: HousekeepingPendingRequest
): HousekeepingRequest {
  return {
    kind: 'housekeeping',
    requestType: 'towels',
    quantity: parseHousekeepingTowelQuantity(message, pendingRequest.language),
  };
}

export function buildPreparedHousekeepingChatResponse(
  request: HousekeepingRequest,
  language: SupportedPublicLanguage
): PreparedHousekeepingChatResponse {
  const copy = COPY[language];
  if (request.requestType === 'towels') {
    if (request.quantity === null) {
      return {
        answer: copy.quantityQuestion,
        action: null,
        pendingRequest: { kind: 'housekeeping', requestType: 'towels', language },
        responseLanguage: language,
      };
    }

    return {
      answer: copy.towelsAnswer(request.quantity),
      action: {
        type: 'confirm_request',
        request: { kind: 'housekeeping', requestType: 'towels', quantity: request.quantity },
        label: copy.confirm,
        cancelLabel: copy.cancel,
      },
      pendingRequest: null,
      responseLanguage: language,
    };
  }

  return {
    answer: copy.cleaningAnswer,
    action: {
      type: 'confirm_request',
      request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
      label: copy.confirm,
      cancelLabel: copy.cancel,
    },
    pendingRequest: null,
    responseLanguage: language,
  };
}
