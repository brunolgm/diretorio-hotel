import type { PublicHotelPageData } from '../public-hotel-data.ts';
import type { SupportedPublicLanguage } from '../public-language.ts';
import { detectClosedCatalogIntent } from './intent-detection.ts';
import {
  getPublicDepartmentContact,
  isAssistantContactInput,
  resolvePublicDepartmentContact,
  type PublicContactDependencies,
  type PublicDepartmentContactConfig,
} from './public-contact.ts';
import type {
  AssistantAction,
  GetHousekeepingContactInput,
  HousekeepingContactResult,
} from './types.ts';

// TODO(assistant-department-semantics): replace this name catalog with a structured public key.
const HOUSEKEEPING_NAMES = new Set(['governanca', 'housekeeping', 'gobernanza']);
const HOUSEKEEPING_INTENTS: Record<SupportedPublicLanguage, ReadonlySet<string>> = {
  pt: new Set([
    'quero falar com a governanca',
    'preciso falar com a governanca',
    'como falo com a governanca',
    'me passa o contato da governanca',
  ]),
  en: new Set([
    'i want to talk to housekeeping',
    'i need to talk to housekeeping',
    'how do i contact housekeeping',
    'housekeeping contact',
  ]),
  es: new Set([
    'quiero hablar con gobernanza',
    'necesito hablar con gobernanza',
    'como contacto con gobernanza',
    'contacto de gobernanza',
  ]),
};

const COPY = {
  pt: {
    directLabel: 'Falar com a Governança',
    phoneLabel: 'Telefone da Governança',
    contactLabel: 'Abrir área de Contato',
    unavailableLabel: 'Governança indisponível',
    directAnswer: 'Claro. Você pode falar com a Governança por este canal.',
    fallbackAnswer: 'Não encontrei um canal direto da Governança configurado no momento. Consulte a área de Contato do hotel.',
  },
  en: {
    directLabel: 'Contact Housekeeping',
    phoneLabel: 'Housekeeping phone',
    contactLabel: 'Open Contact area',
    unavailableLabel: 'Housekeeping unavailable',
    directAnswer: 'You can contact Housekeeping through this channel.',
    fallbackAnswer: 'I could not find a direct Housekeeping channel configured right now. Please check the hotel’s Contact area.',
  },
  es: {
    directLabel: 'Hablar con Gobernanza',
    phoneLabel: 'Teléfono de Gobernanza',
    contactLabel: 'Abrir área de Contacto',
    unavailableLabel: 'Gobernanza no disponible',
    directAnswer: 'Puedes contactar con Gobernanza por este canal.',
    fallbackAnswer: 'No encontré un canal directo de Gobernanza configurado en este momento. Consulta el área de Contacto del hotel.',
  },
} as const;

const HOUSEKEEPING_CONTACT_CONFIG: PublicDepartmentContactConfig<'housekeeping'> = {
  department: 'housekeeping',
  departmentNames: HOUSEKEEPING_NAMES,
  labels: {
    pt: {
      whatsapp: COPY.pt.directLabel,
      phone: COPY.pt.phoneLabel,
      departmentUrl: COPY.pt.directLabel,
      contactPage: COPY.pt.contactLabel,
      unavailable: COPY.pt.unavailableLabel,
    },
    en: {
      whatsapp: COPY.en.directLabel,
      phone: COPY.en.phoneLabel,
      departmentUrl: COPY.en.directLabel,
      contactPage: COPY.en.contactLabel,
      unavailable: COPY.en.unavailableLabel,
    },
    es: {
      whatsapp: COPY.es.directLabel,
      phone: COPY.es.phoneLabel,
      departmentUrl: COPY.es.directLabel,
      contactPage: COPY.es.contactLabel,
      unavailable: COPY.es.unavailableLabel,
    },
  },
};

export type GetHousekeepingContactDependencies = PublicContactDependencies;

export interface HousekeepingContactChatResponse {
  answer: string;
  action: AssistantAction | null;
}

export function isGetHousekeepingContactInput(
  value: unknown
): value is GetHousekeepingContactInput {
  return isAssistantContactInput(value);
}

export function detectHousekeepingContactIntent(message: string) {
  return detectClosedCatalogIntent({
    message,
    intent: 'housekeeping_contact',
    catalog: HOUSEKEEPING_INTENTS,
  });
}

export function resolveHousekeepingContactFromPublicData({
  input,
  pageData,
}: {
  input: GetHousekeepingContactInput;
  pageData: PublicHotelPageData;
}): HousekeepingContactResult {
  return resolvePublicDepartmentContact({
    input,
    pageData,
    config: HOUSEKEEPING_CONTACT_CONFIG,
  });
}

/**
 * Internal read-only LibGuest capability prepared for a future MCP adapter.
 * Business rules must remain here; an MCP server must only adapt this contract.
 */
export async function getHousekeepingContact(
  input: GetHousekeepingContactInput,
  dependencies: GetHousekeepingContactDependencies
) {
  return getPublicDepartmentContact(input, dependencies, HOUSEKEEPING_CONTACT_CONFIG);
}

export function buildHousekeepingContactChatResponse(
  result: HousekeepingContactResult,
  language: SupportedPublicLanguage
): HousekeepingContactChatResponse {
  const copy = COPY[language];
  const hasDirectChannel = result.channel === 'whatsapp' ||
    result.channel === 'phone' ||
    (result.channel === 'contact_page' && result.label === copy.directLabel);
  return {
    answer: hasDirectChannel ? copy.directAnswer : copy.fallbackAnswer,
    action: result.actionUrl
      ? { type: 'open_url', label: result.label, url: result.actionUrl }
      : null,
  };
}
