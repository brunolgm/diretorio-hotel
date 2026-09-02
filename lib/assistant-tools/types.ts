import type { SupportedPublicLanguage } from '../public-language.ts';

export const ASSISTANT_ACTION_TYPES = ['open_url', 'confirm_request'] as const;

export interface AssistantOpenUrlAction {
  type: 'open_url';
  label: string;
  url: string;
}

export type HousekeepingRequest =
  | {
      kind: 'housekeeping';
      requestType: 'towels';
      quantity: number | null;
    }
  | {
      kind: 'housekeeping';
      requestType: 'room_cleaning';
      quantity: null;
    };

export type ConfirmableHousekeepingRequest =
  | {
      kind: 'housekeeping';
      requestType: 'towels';
      quantity: number;
    }
  | {
      kind: 'housekeeping';
      requestType: 'room_cleaning';
      quantity: null;
    };

export interface AssistantConfirmRequestAction {
  type: 'confirm_request';
  request: ConfirmableHousekeepingRequest;
  label: string;
  cancelLabel: string;
}

export interface HousekeepingPendingRequest {
  kind: 'housekeeping';
  requestType: 'towels';
  language: SupportedPublicLanguage;
}

export type ClarificationResolution =
  | {
      kind: 'resolved';
      request: HousekeepingRequest;
      detectedLanguage: SupportedPublicLanguage;
    }
  | {
      kind: 'retry';
      reason: 'out_of_range' | 'missing_quantity' | 'uncertain';
      detectedLanguage: SupportedPublicLanguage;
    }
  | {
      kind: 'cancelled';
      detectedLanguage: SupportedPublicLanguage;
    }
  | { kind: 'escape' };

export type AssistantAction = AssistantOpenUrlAction | AssistantConfirmRequestAction;

export interface AssistantContactInput {
  hotelSlug: string;
  language: SupportedPublicLanguage;
}

export type GetReceptionContactInput = AssistantContactInput;
export type GetHousekeepingContactInput = AssistantContactInput;
export type AssistantContactChannel = 'whatsapp' | 'phone' | 'contact_page' | 'none';

export interface AssistantDepartmentContactResult<TDepartment extends string> {
  available: boolean;
  department: TDepartment;
  channel: AssistantContactChannel;
  label: string;
  actionUrl: string | null;
  displayValue: string | null;
}

export type ReceptionContactResult = AssistantDepartmentContactResult<'reception'>;
export type HousekeepingContactResult = AssistantDepartmentContactResult<'housekeeping'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseActionLabel(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) return null;
  const label = value.trim();
  return /\p{C}/u.test(label) ? null : label;
}

export function parseHousekeepingPendingRequest(
  value: unknown
): HousekeepingPendingRequest | null {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'kind,language,requestType') {
    return null;
  }
  if (
    value.kind !== 'housekeeping' ||
    value.requestType !== 'towels' ||
    (value.language !== 'pt' && value.language !== 'en' && value.language !== 'es')
  ) {
    return null;
  }
  return { kind: 'housekeeping', requestType: 'towels', language: value.language };
}

function parseConfirmableHousekeepingRequest(
  value: unknown
): ConfirmableHousekeepingRequest | null {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'kind,quantity,requestType') {
    return null;
  }
  if (value.kind !== 'housekeeping') return null;
  if (value.requestType === 'room_cleaning' && value.quantity === null) {
    return { kind: 'housekeeping', requestType: 'room_cleaning', quantity: null };
  }
  if (
    value.requestType === 'towels' &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 1 &&
    value.quantity <= 6
  ) {
    return { kind: 'housekeeping', requestType: 'towels', quantity: value.quantity };
  }
  return null;
}

export function parseAssistantAction(value: unknown): AssistantAction | null {
  if (!isRecord(value)) return null;
  if (value.type === 'confirm_request') {
    if (Object.keys(value).sort().join(',') !== 'cancelLabel,label,request,type') return null;
    const label = parseActionLabel(value.label);
    const cancelLabel = parseActionLabel(value.cancelLabel);
    const request = parseConfirmableHousekeepingRequest(value.request);
    return label && cancelLabel && request
      ? { type: 'confirm_request', request, label, cancelLabel }
      : null;
  }
  if (
    Object.keys(value).sort().join(',') !== 'label,type,url' ||
    value.type !== 'open_url' ||
    typeof value.url !== 'string'
  ) {
    return null;
  }

  const label = parseActionLabel(value.label);
  if (!label) return null;

  if (/^\/hotel\/[a-z0-9]+(?:-[a-z0-9]+)*\/explorar\/contato(?:\?lang=(?:en|es))?$/.test(value.url)) {
    return { type: 'open_url', label, url: value.url };
  }

  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { type: 'open_url', label, url: url.toString() };
  } catch {
    return null;
  }
}
