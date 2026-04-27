import { createClient } from '@/lib/supabase/server';
import {
  type SupportedTranslationLanguage,
  translateAnnouncementFields,
  translateDepartmentFields,
  translatePolicyFields,
  translatePromotionalBannerFields,
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

export type TranslationAvailabilityStatus = 'complete' | 'partial' | 'missing';

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
    return `Conteúdo salvo em português. A tradução ${missingLanguages} não pôde ser atualizada, então parte da experiência pública pode usar fallback em PT até a próxima retradução.`;
  }

  return 'Conteúdo salvo em português, mas as traduções EN e ES não puderam ser atualizadas. A publicação em PT continua disponível e o fallback em português pode ser usado na experiência pública.';
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

export function buildOperationalErrorMessage(
  subject: string,
  operation: string,
  guidance = 'Revise os dados informados e tente novamente.'
) {
  return `NÃ£o foi possÃ­vel ${operation} ${subject}. ${guidance}`;
}

export function logOperationalError({
  module,
  action,
  operation,
  hotelId,
  targetId,
  error,
}: {
  module: string;
  action: string;
  operation: string;
  hotelId?: string;
  targetId?: string;
  error: unknown;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

  console.error(`[${module}] ${action} failed`, {
    operation,
    hotelId,
    targetId,
    message,
  });
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

export function getTranslationAvailabilityLabel(status: TranslationAvailabilityStatus) {
  if (status === 'complete') {
    return 'EN e ES disponíveis';
  }

  if (status === 'partial') {
    return 'Fallback parcial em PT';
  }

  return 'Fallback em PT';
}

export function getTranslationAvailabilityDescription(status: TranslationAvailabilityStatus) {
  if (status === 'complete') {
    return 'O conteúdo em inglês e espanhol já está disponível para a experiência pública.';
  }

  if (status === 'partial') {
    return 'Parte do conteúdo público ainda pode aparecer em português quando EN ou ES estiverem ausentes.';
  }

  return 'Inglês e espanhol ainda não estão disponíveis. A experiência pública usa o conteúdo em português como fallback.';
}

export function getTranslationWorkflowHelpItems() {
  return [
    'Português é o conteúdo fonte deste cadastro.',
    'As versões em inglês e espanhol são geradas ao salvar.',
    'Se a tradução não estiver disponível, a experiência pública usa o texto em português como fallback.',
    'Falhas de tradução não impedem a publicação do conteúdo em português.',
  ];
}

export function getRetranslationHelpText() {
  return 'Use retraduzir quando alterar o texto em português e quiser atualizar EN/ES a partir da versão fonte.';
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
      logOperationalError({
        module: 'translation',
        action: 'syncSectionTranslations',
        operation: 'persist translations',
        targetId: sectionId,
        error,
      });
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'syncSectionTranslations',
      operation: 'translate and persist',
      targetId: sectionId,
      error,
    });
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
      logOperationalError({
        module: 'translation',
        action: 'syncDepartmentTranslations',
        operation: 'persist translations',
        targetId: departmentId,
        error,
      });
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'syncDepartmentTranslations',
      operation: 'translate and persist',
      targetId: departmentId,
      error,
    });
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
      logOperationalError({
        module: 'translation',
        action: 'syncPolicyTranslations',
        operation: 'persist translations',
        targetId: policyId,
        error,
      });
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'syncPolicyTranslations',
      operation: 'translate and persist',
      targetId: policyId,
      error,
    });
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}

export async function syncAnnouncementTranslations({
  supabase,
  announcementId,
  fields,
}: {
  supabase: AppSupabaseClient;
  announcementId: string;
  fields: {
    title: string;
    body: string | null;
  };
}): Promise<TranslationSyncResult> {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translateAnnouncementFields(fields, 'en'),
      translateAnnouncementFields(fields, 'es'),
    ]);

    const successfulLanguages: SupportedTranslationLanguage[] = [];
    const failedLanguages: SupportedTranslationLanguage[] = [];
    const translations = [];

    if (englishTranslation) {
      successfulLanguages.push('en');
      translations.push({
        announcement_id: announcementId,
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
        announcement_id: announcementId,
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
      .from('hotel_announcement_translations')
      .upsert(translations, { onConflict: 'announcement_id,language' });

    if (error) {
      logOperationalError({
        module: 'translation',
        action: 'syncAnnouncementTranslations',
        operation: 'persist translations',
        targetId: announcementId,
        error,
      });
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'syncAnnouncementTranslations',
      operation: 'translate and persist',
      targetId: announcementId,
      error,
    });
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}

export async function syncPromotionalBannerTranslations({
  supabase,
  bannerId,
  fields,
}: {
  supabase: AppSupabaseClient;
  bannerId: string;
  fields: {
    title: string;
    subtitle: string | null;
    cta_label: string | null;
  };
}): Promise<TranslationSyncResult> {
  try {
    const timestamp = new Date().toISOString();
    const [englishTranslation, spanishTranslation] = await Promise.all([
      translatePromotionalBannerFields(fields, 'en'),
      translatePromotionalBannerFields(fields, 'es'),
    ]);

    const successfulLanguages: SupportedTranslationLanguage[] = [];
    const failedLanguages: SupportedTranslationLanguage[] = [];
    const translations = [];

    if (englishTranslation) {
      successfulLanguages.push('en');
      translations.push({
        banner_id: bannerId,
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
        banner_id: bannerId,
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
      .from('hotel_promotional_banner_translations')
      .upsert(translations, { onConflict: 'banner_id,language' });

    if (error) {
      logOperationalError({
        module: 'translation',
        action: 'syncPromotionalBannerTranslations',
        operation: 'persist translations',
        targetId: bannerId,
        error,
      });
      return buildSyncResult([], TARGET_LANGUAGES);
    }

    return buildSyncResult(successfulLanguages, failedLanguages);
  } catch (error) {
    logOperationalError({
      module: 'translation',
      action: 'syncPromotionalBannerTranslations',
      operation: 'translate and persist',
      targetId: bannerId,
      error,
    });
    return buildSyncResult([], TARGET_LANGUAGES);
  }
}
