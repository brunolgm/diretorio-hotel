import type { SupportedPublicLanguage } from '../public-language.ts';
import { parseHousekeepingTowelQuantity } from '../assistant-tools/request-housekeeping.ts';
import type {
  AssistantClassification,
  AssistantRouteDecision,
  ClassifiedAssistantIntent,
} from './types.ts';
import type { NormalizedAssistantMessage } from './normalize.ts';

export const ASSISTANT_CLASSIFICATION_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.90,
  MEDIUM_CONFIDENCE: 0.70,
} as const;
export const CLASSIFIER_MESSAGE_MAX = 600;

export type AssistantClassificationConfidenceBand = 'high' | 'medium' | 'low';

export const CLASSIFIED_ASSISTANT_INTENTS: readonly ClassifiedAssistantIntent[] = [
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
];

const INTENTS = new Set<ClassifiedAssistantIntent>(CLASSIFIED_ASSISTANT_INTENTS);
const OPERATIONAL_SIGNALS = new Set([
  // PT
  'ajuda', 'ajudar', 'alguem', 'arrumar', 'atendente', 'atender', 'atendimento',
  'complicado', 'governanca', 'limpar', 'limpeza', 'quarto', 'recepcao', 'resolver',
  'toalha', 'toalhas',
  // EN
  'agent', 'clean', 'cleaning', 'complicated', 'front', 'help', 'housekeeping',
  'person', 'reception', 'room', 'someone', 'staff', 'towel', 'towels',
  // ES
  'agente', 'alguien', 'atencion', 'ayuda', 'ayudar', 'complicado', 'gobernanza',
  'habitacion', 'limpiar', 'limpieza', 'recepcion', 'resolver', 'toalla', 'toallas',
]);
const CLASSIFIER_SENSITIVE_TEXT = /(?:\broom[_-]?token\b|\bhotel[_-]?id\b|\b(?:meu nome|minha reserva|my name|my reservation|mi nombre|mi reserva|email|telefone|phone|correo)\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d ().-]{7,}\d))/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function shouldClassifyMessage(message: NormalizedAssistantMessage) {
  if (
    !message.normalized ||
    message.original.length > CLASSIFIER_MESSAGE_MAX ||
    CLASSIFIER_SENSITIVE_TEXT.test(message.original)
  ) return false;
  return message.normalized.split(' ').some((word) => OPERATIONAL_SIGNALS.has(word));
}

export function parseAssistantClassification(value: unknown): AssistantClassification | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed) || Object.keys(parsed).sort().join(',') !== 'confidence,detectedLanguage,intent') {
    return null;
  }
  if (
    typeof parsed.intent !== 'string' ||
    !INTENTS.has(parsed.intent as ClassifiedAssistantIntent) ||
    typeof parsed.confidence !== 'number' ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1 ||
    (parsed.detectedLanguage !== null &&
      parsed.detectedLanguage !== 'pt' &&
      parsed.detectedLanguage !== 'en' &&
      parsed.detectedLanguage !== 'es')
  ) {
    return null;
  }
  return {
    intent: parsed.intent as ClassifiedAssistantIntent,
    confidence: parsed.confidence,
    detectedLanguage: parsed.detectedLanguage as SupportedPublicLanguage | null,
  };
}

export function buildAssistantClassifierPrompt(message: string) {
  return [
    'Classifique a mensagem do hospede em exatamente uma intencao permitida.',
    'Nao responda ao hospede. Nao execute acoes. Retorne somente JSON valido.',
    `Intencoes: ${CLASSIFIED_ASSISTANT_INTENTS.join(', ')}.`,
    'Formato exato: {"intent":"unknown","confidence":0,"detectedLanguage":null}.',
    'confidence deve estar entre 0 e 1. detectedLanguage deve ser pt, en, es ou null.',
    `Mensagem: ${JSON.stringify(message)}`,
  ].join('\n');
}

export function getAssistantClassificationConfidenceBand(
  confidence: number
): AssistantClassificationConfidenceBand {
  if (confidence >= ASSISTANT_CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE) return 'high';
  if (confidence >= ASSISTANT_CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
}

function aiDecision(
  message: NormalizedAssistantMessage,
  reason: 'general_chat' | 'open_question' | 'ambiguous'
): AssistantRouteDecision {
  return {
    mode: 'ai',
    assistantRoute: 'ai',
    reason,
    message,
  };
}

function tourismDecision(
  message: NormalizedAssistantMessage
): AssistantRouteDecision {
  return {
    mode: 'tourism',
    assistantRoute: 'ai',
    reason: 'open_tourism',
    message,
  };
}

export function applyAssistantClassification({
  classification,
  message,
  uiLanguage,
}: {
  classification: AssistantClassification | null;
  message: NormalizedAssistantMessage;
  uiLanguage: SupportedPublicLanguage;
}): AssistantRouteDecision {
  const aiReason = message.original.includes('?')
    ? 'open_question'
    : message.normalized.split(' ').length > 1
      ? 'general_chat'
      : 'ambiguous';
  if (
    !classification ||
    getAssistantClassificationConfidenceBand(classification.confidence) !== 'high'
  ) {
    return aiDecision(message, aiReason);
  }

  const detectedLanguage = classification.detectedLanguage;
  const language = detectedLanguage ?? uiLanguage;
  const capabilityBase = {
    mode: 'capability' as const,
    assistantRoute: 'capability' as const,
    detectedLanguage,
    message,
  };

  switch (classification.intent) {
    case 'human_handoff':
    case 'reception_contact':
    case 'housekeeping_contact':
      return { ...capabilityBase, capability: classification.intent };
    case 'housekeeping_request_towels':
      return {
        ...capabilityBase,
        capability: 'housekeeping_request',
        request: {
          kind: 'housekeeping',
          requestType: 'towels',
          quantity: parseHousekeepingTowelQuantity(message.original, language),
        },
      };
    case 'housekeeping_request_room_cleaning':
      return {
        ...capabilityBase,
        capability: 'housekeeping_request',
        request: { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null },
      };
    case 'tourism':
      return tourismDecision(message);
    default:
      return aiDecision(message, aiReason);
  }
}
