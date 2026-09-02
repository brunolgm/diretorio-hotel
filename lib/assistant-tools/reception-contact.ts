import type { PublicHotelPageData } from '../public-hotel-data.ts';
import type { SupportedPublicLanguage } from '../public-language.ts';
import type {
  AssistantAction,
  GetReceptionContactInput,
  ReceptionContactResult,
} from './types.ts';
import {
  detectClosedCatalogIntent,
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
    'como falo com a recepcao',
    'preciso falar com alguem do hotel',
    'me passa o contato da recepcao',
    'contato da recepcao',
    'falar com a recepcao',
    'chame a recepcao',
  ]),
  en: new Set([
    'i want to talk to reception',
    'i want to speak to reception',
    'front desk contact',
    'how do i contact reception',
    'contact reception',
    'contact the front desk',
  ]),
  es: new Set([
    'quiero hablar con recepcion',
    'contacto de recepcion',
    'como contacto con recepcion',
    'hablar con recepcion',
  ]),
};

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
