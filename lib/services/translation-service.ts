import 'server-only';
import { getRequiredEnvVar, logWarningOnce } from '@/lib/env';
import { logOperationalError } from '@/lib/services/translation-admin';

export type SupportedTranslationLanguage = 'en' | 'es';

type TranslatableFieldMap = Record<string, string | null>;

const GOOGLE_TRANSLATE_URL =
  process.env.GOOGLE_CLOUD_TRANSLATION_API_URL ||
  'https://translation.googleapis.com/language/translate/v2';

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function translateTextBatch(
  values: string[],
  targetLanguage: SupportedTranslationLanguage
) {
  if (values.length === 0) {
    return null;
  }

  let apiKey: string;

  try {
    apiKey = getRequiredEnvVar('GOOGLE_CLOUD_TRANSLATION_API_KEY');
  } catch {
    logWarningOnce(
      'Google Cloud Translation is disabled because GOOGLE_CLOUD_TRANSLATION_API_KEY is missing.'
    );
    return null;
  }

  const response = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: values,
      source: 'pt',
      target: targetLanguage,
      format: 'text',
      model: 'nmt',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Translation request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: {
      translations?: Array<{
        translatedText?: string;
      }>;
    };
  };

  const translations = data.data?.translations || [];

  if (translations.length !== values.length) {
    throw new Error('Google Translation response size did not match request size.');
  }

  return translations.map((item) => decodeHtmlEntities(item.translatedText || ''));
}

async function tryTranslateTextFields<T extends TranslatableFieldMap>(
  fields: T,
  targetLanguage: SupportedTranslationLanguage
) {
  try {
    const entries = Object.entries(fields).filter(([, value]) => value !== null) as Array<
      [keyof T, string]
    >;

    if (!entries.length) {
      return fields;
    }

    const translatedValues = await translateTextBatch(
      entries.map(([, value]) => value),
      targetLanguage
    );

    if (!translatedValues) {
      return null;
    }

    const translatedFields = { ...fields };

    entries.forEach(([key], index) => {
      translatedFields[key] = translatedValues[index] as T[keyof T];
    });

    return translatedFields;
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'tryTranslateTextFields',
      operation: `translate content to ${targetLanguage}`,
      error,
    });
    return null;
  }
}

export async function translateSectionFields(
  fields: {
    title: string;
    content: string | null;
    cta: string | null;
    category: string | null;
  },
  targetLanguage: SupportedTranslationLanguage
) {
  return tryTranslateTextFields(fields, targetLanguage);
}

export async function translateDepartmentFields(
  fields: {
    name: string;
    description: string | null;
    action: string | null;
  },
  targetLanguage: SupportedTranslationLanguage
) {
  return tryTranslateTextFields(fields, targetLanguage);
}

export async function translatePolicyFields(
  fields: {
    title: string;
    description: string | null;
  },
  targetLanguage: SupportedTranslationLanguage
) {
  return tryTranslateTextFields(fields, targetLanguage);
}
