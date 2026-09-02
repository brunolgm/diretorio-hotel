import type { PublicHotelPageData } from '../public-hotel-data.ts';
import type { SupportedPublicLanguage } from '../public-language.ts';
import { normalizeClosedCatalogText } from './intent-detection.ts';
import type {
  AssistantContactInput,
  AssistantDepartmentContactResult,
} from './types.ts';

const LANGUAGES = new Set<SupportedPublicLanguage>(['pt', 'en', 'es']);
const HOTEL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PublicContactDependencies {
  getPageDataBySlug(
    slug: string,
    language: SupportedPublicLanguage
  ): Promise<PublicHotelPageData | null>;
}

export interface PublicContactLabels {
  whatsapp: string;
  phone: string;
  departmentUrl: string;
  contactPage: string;
  unavailable: string;
}

export interface PublicDepartmentContactConfig<TDepartment extends string> {
  department: TDepartment;
  departmentNames: ReadonlySet<string>;
  labels: Record<SupportedPublicLanguage, PublicContactLabels>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAssistantContactInput(value: unknown): value is AssistantContactInput {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'hotelSlug,language') return false;
  return typeof value.hotelSlug === 'string' &&
    value.hotelSlug.length <= 80 &&
    HOTEL_SLUG_PATTERN.test(value.hotelSlug) &&
    typeof value.language === 'string' &&
    LANGUAGES.has(value.language as SupportedPublicLanguage);
}

function parsePublicPhone(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const telMatch = trimmed.match(/^tel:\s*(\+?[\d ().-]+)$/i);
  const candidate = telMatch?.[1] ?? trimmed;
  const digits = candidate.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return { digits, displayValue: `+${digits}` };
}

function parsePublicContactUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^tel:/i.test(value)) {
    const phone = parsePublicPhone(value);
    return phone ? {
      channel: 'phone' as const,
      actionUrl: null,
      displayValue: phone.displayValue,
    } : null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'wa.me') {
      const phone = parsePublicPhone(url.pathname.slice(1));
      return phone ? {
        channel: 'whatsapp' as const,
        actionUrl: `https://wa.me/${phone.digits}`,
        displayValue: phone.displayValue,
      } : null;
    }
    if (hostname === 'api.whatsapp.com' || hostname === 'web.whatsapp.com') {
      const phone = parsePublicPhone(url.searchParams.get('phone'));
      return phone ? {
        channel: 'whatsapp' as const,
        actionUrl: `https://wa.me/${phone.digits}`,
        displayValue: phone.displayValue,
      } : null;
    }
    return {
      channel: 'contact_page' as const,
      actionUrl: url.toString(),
      displayValue: null,
    };
  } catch {
    return null;
  }
}

function buildInternalContactUrl(hotelSlug: string, language: SupportedPublicLanguage) {
  const query = language === 'pt' ? '' : `?lang=${language}`;
  return `/hotel/${hotelSlug}/explorar/contato${query}`;
}

export function unavailablePublicDepartmentContact<TDepartment extends string>(
  language: SupportedPublicLanguage,
  config: PublicDepartmentContactConfig<TDepartment>
): AssistantDepartmentContactResult<TDepartment> {
  return {
    available: false,
    department: config.department,
    channel: 'none',
    label: config.labels[language].unavailable,
    actionUrl: null,
    displayValue: null,
  };
}

export function resolvePublicDepartmentContact<TDepartment extends string>({
  input,
  pageData,
  config,
}: {
  input: AssistantContactInput;
  pageData: PublicHotelPageData;
  config: PublicDepartmentContactConfig<TDepartment>;
}): AssistantDepartmentContactResult<TDepartment> {
  if (pageData.hotel.slug !== input.hotelSlug) {
    return unavailablePublicDepartmentContact(input.language, config);
  }
  const labels = config.labels[input.language];
  const department = pageData.departments.find(
    (item) => item.enabled !== false &&
      config.departmentNames.has(normalizeClosedCatalogText(item.name))
  );
  const departmentContact = parsePublicContactUrl(department?.url);

  if (departmentContact && departmentContact.channel !== 'phone') {
    return {
      available: true,
      department: config.department,
      channel: departmentContact.channel,
      label: departmentContact.channel === 'whatsapp'
        ? labels.whatsapp
        : labels.departmentUrl,
      actionUrl: departmentContact.actionUrl,
      displayValue: departmentContact.displayValue,
    };
  }

  const hotelWhatsapp = parsePublicPhone(pageData.hotel.whatsapp_number);
  if (hotelWhatsapp) {
    return {
      available: true,
      department: config.department,
      channel: 'whatsapp',
      label: labels.whatsapp,
      actionUrl: `https://wa.me/${hotelWhatsapp.digits}`,
      displayValue: hotelWhatsapp.displayValue,
    };
  }

  if (departmentContact?.channel === 'phone') {
    return {
      available: true,
      department: config.department,
      channel: 'phone',
      label: labels.phone,
      actionUrl: null,
      displayValue: departmentContact.displayValue,
    };
  }

  const contactPageEnabled = pageData.layout.some(
    (block) => block.blockKey === 'contact' && block.isEnabled
  );
  if (contactPageEnabled) {
    return {
      available: true,
      department: config.department,
      channel: 'contact_page',
      label: labels.contactPage,
      actionUrl: buildInternalContactUrl(input.hotelSlug, input.language),
      displayValue: null,
    };
  }

  return unavailablePublicDepartmentContact(input.language, config);
}

export async function getPublicDepartmentContact<TDepartment extends string>(
  input: AssistantContactInput,
  dependencies: PublicContactDependencies,
  config: PublicDepartmentContactConfig<TDepartment>
) {
  if (!isAssistantContactInput(input)) {
    return unavailablePublicDepartmentContact('pt', config);
  }
  const pageData = await dependencies.getPageDataBySlug(input.hotelSlug, input.language);
  if (!pageData) return unavailablePublicDepartmentContact(input.language, config);
  return resolvePublicDepartmentContact({ input, pageData, config });
}
