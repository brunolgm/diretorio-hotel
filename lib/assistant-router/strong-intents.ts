import type { SupportedPublicLanguage } from '../public-language.ts';
import {
  detectClosedCatalogIntent,
  detectHousekeepingContactIntent,
  detectReceptionContactIntent,
  prepareHousekeepingRequest,
} from '../assistant-tools/index.ts';
import type { AssistantStrongIntentName } from './types.ts';

// `emergency` reserves the highest-priority contract only. No match or action is
// implemented until an approved operational response exists.
export const ASSISTANT_STRONG_INTENT_PRIORITY: readonly AssistantStrongIntentName[] = [
  'emergency',
  'human_handoff',
  'housekeeping_request',
  'reception_contact',
  'housekeeping_contact',
];

const HUMAN_HANDOFF_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set([
    'quero falar com atendente',
    'quero falar com uma pessoa',
    'quero falar com alguem',
    'preciso falar com alguem do hotel',
    'preciso de atendimento humano',
    'me transfere para um atendente',
    'me chama alguem',
    'chame um atendente',
    'prefiro falar com uma pessoa',
    'quero falar com a equipe',
  ]),
  en: new Set([
    'i want to talk to a person',
    'i want to talk to a human',
    'i need a human agent',
    'connect me to an agent',
    'i want to speak with someone',
    'i need to speak with hotel staff',
    'transfer me to a human',
  ]),
  es: new Set([
    'quiero hablar con una persona',
    'quiero hablar con un humano',
    'necesito un agente',
    'quiero hablar con alguien',
    'transfiereme a un agente',
    'necesito atencion humana',
  ]),
};

export function detectHumanHandoffIntent(message: string) {
  return detectClosedCatalogIntent({
    message,
    intent: 'human_handoff',
    catalog: HUMAN_HANDOFF_INTENTS,
  });
}

export function detectStrongAssistantIntent(message: string) {
  const handoff = detectHumanHandoffIntent(message);
  if (handoff) {
    return {
      capability: 'human_handoff' as const,
      detectedLanguage: handoff.detectedLanguage,
    };
  }

  const housekeepingRequest = prepareHousekeepingRequest(message);
  if (housekeepingRequest) {
    return {
      capability: 'housekeeping_request' as const,
      detectedLanguage: housekeepingRequest.detection.detectedLanguage,
      request: housekeepingRequest.request,
    };
  }

  const reception = detectReceptionContactIntent(message);
  if (reception) {
    return {
      capability: 'reception_contact' as const,
      detectedLanguage: reception.detectedLanguage,
    };
  }

  const housekeeping = detectHousekeepingContactIntent(message);
  if (housekeeping) {
    return {
      capability: 'housekeeping_contact' as const,
      detectedLanguage: housekeeping.detectedLanguage,
    };
  }

  return null;
}
