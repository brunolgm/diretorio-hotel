import type { SupportedPublicLanguage } from '../public-language.ts';
import { normalizeAssistantMessage } from '../assistant-router/normalize.ts';

export interface AssistantIntentDetection<TIntent extends string> {
  intent: TIntent;
  detectedLanguage: SupportedPublicLanguage | null;
}

export type ClosedIntentCatalog = Record<
  SupportedPublicLanguage,
  ReadonlySet<string>
>;

export function normalizeClosedCatalogText(value: string) {
  return normalizeAssistantMessage(value).normalized;
}

export function detectClosedCatalogIntent<TIntent extends string>({
  message,
  intent,
  catalog,
}: {
  message: string;
  intent: TIntent;
  catalog: ClosedIntentCatalog;
}): AssistantIntentDetection<TIntent> | null {
  const normalizedMessage = normalizeClosedCatalogText(message);
  const matchedLanguages = (Object.keys(catalog) as SupportedPublicLanguage[])
    .filter((language) => catalog[language].has(normalizedMessage));

  if (!matchedLanguages.length) return null;
  return {
    intent,
    detectedLanguage: matchedLanguages.length === 1 ? matchedLanguages[0] : null,
  };
}

export function resolveAssistantCapabilityLanguage(
  detection: AssistantIntentDetection<string>,
  interfaceLanguage: SupportedPublicLanguage
) {
  return detection.detectedLanguage ?? interfaceLanguage;
}
