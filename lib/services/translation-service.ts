import 'server-only';
import { getRequiredEnvVar, logWarningOnce } from '@/lib/env';
import { logOperationalError } from '@/lib/services/operational-logger';
import { tourismTranslationFields, type TourismTranslationFields } from '@/lib/tourism/translations';

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
  targetLanguage: SupportedTranslationLanguage,
  signal?: AbortSignal,
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
    ...(signal ? { signal } : {}),
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
  targetLanguage: SupportedTranslationLanguage,
  tourism = false,
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
      targetLanguage,
      tourism ? AbortSignal.timeout(10_000) : undefined,
    );

    if (!translatedValues) {
      return null;
    }

    const translatedFields = { ...fields };

    entries.forEach(([key], index) => {
      translatedFields[key] = translatedValues[index] as T[keyof T];
    });

    return translatedFields;
  } catch {
    logOperationalError({
      module: 'translation',
      action: 'tryTranslateTextFields',
      operation: `translate content to ${targetLanguage}`,
      error: tourism ? 'Tourism translation unavailable' : 'Translation unavailable',
    });
    return null;
  }
}

export async function translateTourismFields(
  fields: TourismTranslationFields,
  targetLanguage: SupportedTranslationLanguage,
) {
  return tryTranslateTextFields(tourismTranslationFields(fields), targetLanguage, true);
}

export async function translateFbFields(fields: Record<string, string|null>, language: SupportedTranslationLanguage) {
  return tryTranslateTextFields(fields, language, true);
}

export async function translateSectionFields(
  fields: Record<string,string|null>,
  targetLanguage: SupportedTranslationLanguage,
  protectedTerms: string[] = [],
) {
  // Preserve technical/numeric literals before the same Google batch used by all editorial domains.
  const literals:string[]=[];
  const protect=(value:string)=>{const marker=`ZXQ${String(literals.length).padStart(5,'0')}QXZ`;literals.push(value);return marker;};
  const terms=protectedTerms.filter(Boolean).sort((a,b)=>b.length-a.length).map(value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const pattern=new RegExp([...(terms.length?[terms.join('|')]:[]),'https?:\\/\\/[^\\s]+','[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}','\\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\b','(?:R\\$|US\\$|€|\\$)\\s*\\d[\\d.,]*','(?<=(?:Piso|Andar|Bloco|Quarto|UH)\\s)[A-Za-z0-9-]+','\\*?\\d+(?:[:.,/–—-]\\d+)*(?:%|h)?','\\b[A-Z][A-Z0-9_-]+\\b','\\b[A-Z][a-z]+[A-Z][A-Za-z]*\\b'].join('|'),'g');
  const masked=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value?.replace(pattern,protect)??null]));
  const textual=Object.fromEntries(Object.entries(masked).filter(([,value])=>value&&/\p{L}/u.test(value.replace(/ZXQ\d{5}QXZ/g,''))));
  const translated=Object.keys(textual).length?await tryTranslateTextFields(textual,targetLanguage,true):{};
  if(!translated)return null;
  const result={...masked,...translated};
  for(const key of Object.keys(result)) {
    if(result[key]===null)continue;
    for(const marker of masked[key]?.match(/ZXQ\d{5}QXZ/g)||[]) if(!result[key]!.includes(marker))return null;
    result[key]=result[key]!.replace(/ZXQ(\d{5})QXZ/g,(_,index)=>literals[Number(index)]);
    if(fields[key]?.trim()&&!result[key]?.trim())return null;
  }
  return result;
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

export async function translateAnnouncementFields(
  fields: {
    title: string;
    body: string | null;
  },
  targetLanguage: SupportedTranslationLanguage
) {
  return tryTranslateTextFields(fields, targetLanguage);
}

export async function translatePromotionalBannerFields(
  fields: {
    title: string;
    subtitle: string | null;
    cta_label: string | null;
  },
  targetLanguage: SupportedTranslationLanguage
) {
  return tryTranslateTextFields(fields, targetLanguage);
}

/** V3 editorial fields use the same server-side Google batch and PT source as existing domains. */
export async function translateExperienceMediaFields(fields: {title:string|null;description:string|null;alt_text:string|null;cta_label:string|null}, targetLanguage: SupportedTranslationLanguage) {
 return tryTranslateTextFields(fields,targetLanguage);
}
