import type { Json } from '@/types/database';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'language_selected',
  'whatsapp_click',
  'website_click',
  'booking_click',
  'department_click',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsMetadata = Record<string, Json | undefined>;

export interface AnalyticsEventPayload {
  hotelId: string;
  hotelSlug: string;
  eventType: AnalyticsEventType;
  language: SupportedPublicLanguage;
  targetUrl?: string | null;
  departmentId?: string | null;
  metadata?: AnalyticsMetadata;
}

export function isAnalyticsEventType(value: string): value is AnalyticsEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}

export function isPlainAnalyticsMetadata(
  value: unknown
): value is AnalyticsMetadata {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
