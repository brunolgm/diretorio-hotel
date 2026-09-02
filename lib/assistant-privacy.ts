import type { SupportedPublicLanguage } from './public-language.ts';

export type AssistantPiiKind =
  | 'email'
  | 'phone'
  | 'uuid'
  | 'room_token'
  | 'hotel_id'
  | 'labeled_reservation'
  | 'room_number'
  | 'cpf';

const PII_PATTERNS: ReadonlyArray<readonly [AssistantPiiKind, RegExp]> = [
  ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i],
  ['room_token', /\broom[_-]?token\s*[:=#-]?\s*\S+/i],
  ['hotel_id', /\bhotel[_-]?id\s*[:=#-]?\s*\S+/i],
  ['labeled_reservation', /\b(?:reserva|reservation|booking)\s*(?:n(?:o|umero)?|number|n[º°.]?)?\s*[:=#-]?\s*[A-Z0-9-]{3,}\b/i],
  ['room_number', /\b(?:quarto|apartamento|apto|room)\s*(?:n(?:o|umero)?|number|n[º°.]?)?\s*[:=#-]?\s*\d{1,6}\b/i],
  ['cpf', /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/],
  ['phone', /(?:\+?\d{1,3}[ .()-]*)?(?:\(?\d{2,3}\)?[ .-]*)?\d{4,5}[ .-]*\d{4}\b/],
];

export const ASSISTANT_PRIVACY_COPY: Record<SupportedPublicLanguage, string> = {
  pt: 'Para proteger seus dados, evite enviar informações pessoais, número do apartamento ou dados da reserva por este chat. Posso ajudar com informações gerais ou direcionar você ao canal oficial do hotel.',
  en: 'To protect your data, please avoid sending personal information, room numbers, or reservation details through this chat. I can help with general information or direct you to the hotel’s official channel.',
  es: 'Para proteger tus datos, evita enviar información personal, el número del apartamento o datos de la reserva por este chat. Puedo ayudarte con información general o dirigirte al canal oficial del hotel.',
};

export function detectExplicitAssistantPii(text: string): AssistantPiiKind | null {
  for (const [kind, pattern] of PII_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}

export function containsExplicitAssistantPii(text: string) {
  return detectExplicitAssistantPii(text) !== null;
}
