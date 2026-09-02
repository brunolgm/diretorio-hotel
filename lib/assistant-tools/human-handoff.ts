import type { SupportedPublicLanguage } from '../public-language.ts';
import { selectDeterministicResponse } from '../assistant-router/natural-response.ts';
import { getReceptionContact, type GetReceptionContactDependencies } from './reception-contact.ts';
import type {
  AssistantAction,
  GetReceptionContactInput,
  ReceptionContactResult,
} from './types.ts';

const COPY = {
  pt: {
    available: [
      'Claro. Posso direcionar voc\u00ea ao canal de atendimento da equipe do hotel.',
      'Sem problema. Posso indicar o canal oficial de atendimento da equipe do hotel.',
    ],
    unavailable: 'N\u00e3o encontrei um canal p\u00fablico de atendimento da equipe configurado no momento.',
    phone: (phone: string) => `Claro. O canal p\u00fablico de atendimento da equipe \u00e9 o telefone ${phone}.`,
    label: 'Falar com a equipe',
  },
  en: {
    available: [
      "Sure. I can direct you to the hotel team's official contact channel.",
      "Of course. I can point you to the hotel team's official contact channel.",
    ],
    unavailable: 'I could not find a public hotel team contact channel configured right now.',
    phone: (phone: string) => `Sure. The hotel team's public contact channel is ${phone}.`,
    label: 'Contact the team',
  },
  es: {
    available: [
      'Claro. Puedo dirigirte al canal oficial de atenci\u00f3n del equipo del hotel.',
      'Por supuesto. Puedo indicarte el canal oficial de atenci\u00f3n del equipo del hotel.',
    ],
    unavailable: 'No encontr\u00e9 un canal p\u00fablico de atenci\u00f3n del equipo configurado en este momento.',
    phone: (phone: string) => `Claro. El canal p\u00fablico de atenci\u00f3n del equipo es el tel\u00e9fono ${phone}.`,
    label: 'Hablar con el equipo',
  },
} as const;

export interface HumanHandoffChatResponse {
  answer: string;
  action: AssistantAction | null;
}

export async function getHumanHandoffContact(
  input: GetReceptionContactInput,
  dependencies: GetReceptionContactDependencies
) {
  return getReceptionContact(input, dependencies);
}

export function buildHumanHandoffChatResponse(
  result: ReceptionContactResult,
  language: SupportedPublicLanguage,
  seed: string
): HumanHandoffChatResponse {
  const copy = COPY[language];
  const answer = !result.available
    ? copy.unavailable
    : result.channel === 'phone' && result.displayValue
      ? copy.phone(result.displayValue)
      : selectDeterministicResponse(copy.available, seed);

  return {
    answer,
    action: result.actionUrl
      ? { type: 'open_url', label: copy.label, url: result.actionUrl }
      : null,
  };
}
