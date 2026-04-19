import { createClient } from '@/lib/supabase/server';
import {
  type SupportedTranslationLanguage,
  translateDepartmentFields,
  translatePolicyFields,
  translateSectionFields,
} from '@/lib/services/translation-service';

type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TARGET_LANGUAGES: SupportedTranslationLanguage[] = ['en', 'es'];

export type TranslationSyncState = 'complete' | 'partial' | 'failed';

export interface TranslationSyncResult {
  status: TranslationSyncState;
  successfulLanguages: SupportedTranslationLanguage[];
  failedLanguages: SupportedTranslationLanguage[];
}

type TranslationAvailabilityStatus = 'complete' | 'partial' | 'missing';

function getSyncStatus(successfulLanguages: SupportedTranslationLanguage[]): TranslationSyncState {
  if (successfulLanguages.length === TARGET_LANGUAGES.length) {
    return 'complete';
  }

  if (successfulLanguages.length > 0) {
    return 'partial';
  }

  return 'failed';
}

function buildSyncResult(
  successfulLanguages: SupportedTranslationLanguage[],
  failedLanguages: SupportedTranslationLanguage[]
): TranslationSyncResult {
  return {
    status: getSyncStatus(successfulLanguages),
    successfulLanguages,
    failedLanguages,
  };
}

function formatLanguageLabel(language: SupportedTranslationLanguage) {
  return language.toUpperCase();
}

export function formatTranslationWarning(result: TranslationSyncResult) {
  if (result.status === 'complete') {
    return null;
  }

  if (result.status === 'partial') {
    const missingLanguages = result.failedLanguages.map(formatLanguageLabel).join(' e ');
    return `Conteúdo salvo em português, mas a tradução ${missingLanguages} não pôde ser atualizada.`;
  }

  return 'Conteúdo salvo em português, mas as traduções EN e ES não puderam ser atualizadas.';
}

export function buildFeedbackRedirect(
  pathname: string,
  params: {
    success?: string;
    error?: string;
    warning?: string | null;
  }
) {
  const query = new URLSearchParams();

  if (params.success) {
    query.set('success', params.success);
  }

  if (params.error) {
    query.set('error', params.error);
  }

  if (params.warning) {
    query.set('warning', params.warning);
  }

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function getAvailableTranslationLanguages(translations: Array<{ language: string }>) {
  const available = new Set<SupportedTranslationLanguage>();

  translations.forEach((translation) => {
    if (translation.language === 'en' || translation.language === 'es') {
      available.add(translation.language);
    }
  });

  return available;
}

export function getTranslationAvailabilityStatus(
  availableLanguages: Set<SupportedTranslationLanguage>
): TranslationAvailabilityStatus {
  if (availableLanguages.size === TARGET_LANGUAGES.length) {
    return 'complete';
  }

  if (availableLanguages.size > 0) {
    return 'partial';
  }

  return 'missing';
}

export async function syncSectionTranslations({
  supabase,
  sectionId,
  fields,
}: {
  supabase: AppSupabaseClient;
  sectionId: string;
  fields: {
    title: string;
    content: string | null;
    cta: string | null;
    category: string | null;
  };
}): Promise<TranslationSyncResult> {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translateSectionFields(fields, 'en'),
      translateSectionFields(fields, 'es'),
    ]);

    const successfulLanguages: SupportedTranslationLanguage[] = [];
    const failedLanguages: SupportedTranslationLanguage[] = [];
    const translations = [];

    if (englishTranslation) {
      successfulLanguages.push('en');
      translations.push({
        section_id: sectionId,
        language: 'en' as const,
        ...englishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('en');
    }

    if (spanishTranslation) {
      successfulLanguages.push('es');
      translations.push({
        section_id: sectionId,
        language: 'es' as const,
        ...spanishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('es');
    }

    if (!translations.length) {
      return buildSyncResult(successfulLanguages, failedLanguages);
    }

    const { error } = await supabase
      .from('hotel_section_translations')
      .upsert(translations, { onConflict: 'section_id,language' });

    if (error) {
      console.error('Failed to persist section translations:', error);
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    console.error('Failed to sync section translations:', error);
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}

export async function syncDepartmentTranslations({
  supabase,
  departmentId,
  fields,
}: {
  supabase: AppSupabaseClient;
  departmentId: string;
  fields: {
    name: string;
    description: string | null;
    action: string | null;
  };
}): Promise<TranslationSyncResult> {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translateDepartmentFields(fields, 'en'),
      translateDepartmentFields(fields, 'es'),
    ]);

    const successfulLanguages: SupportedTranslationLanguage[] = [];
    const failedLanguages: SupportedTranslationLanguage[] = [];
    const translations = [];

    if (englishTranslation) {
      successfulLanguages.push('en');
      translations.push({
        department_id: departmentId,
        language: 'en' as const,
        ...englishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('en');
    }

    if (spanishTranslation) {
      successfulLanguages.push('es');
      translations.push({
        department_id: departmentId,
        language: 'es' as const,
        ...spanishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('es');
    }

    if (!translations.length) {
      return buildSyncResult(successfulLanguages, failedLanguages);
    }

    const { error } = await supabase
      .from('hotel_department_translations')
      .upsert(translations, { onConflict: 'department_id,language' });

    if (error) {
      console.error('Failed to persist department translations:', error);
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    console.error('Failed to sync department translations:', error);
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}

export async function syncPolicyTranslations({
  supabase,
  policyId,
  fields,
}: {
  supabase: AppSupabaseClient;
  policyId: string;
  fields: {
    title: string;
    description: string | null;
  };
}): Promise<TranslationSyncResult> {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translatePolicyFields(fields, 'en'),
      translatePolicyFields(fields, 'es'),
    ]);

    const successfulLanguages: SupportedTranslationLanguage[] = [];
    const failedLanguages: SupportedTranslationLanguage[] = [];
    const translations = [];

    if (englishTranslation) {
      successfulLanguages.push('en');
      translations.push({
        policy_id: policyId,
        language: 'en' as const,
        ...englishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('en');
    }

    if (spanishTranslation) {
      successfulLanguages.push('es');
      translations.push({
        policy_id: policyId,
        language: 'es' as const,
        ...spanishTranslation,
        updated_at: timestamp,
      });
    } else {
      failedLanguages.push('es');
    }

    if (!translations.length) {
      return buildSyncResult(successfulLanguages, failedLanguages);
    }

    const { error } = await supabase
      .from('hotel_policy_translations')
      .upsert(translations, { onConflict: 'policy_id,language' });

    if (error) {
      console.error('Failed to persist policy translations:', error);
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    console.error('Failed to sync policy translations:', error);
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}
