import type { SupportedPublicLanguage } from './public-language.ts';
import type { NormalizedAssistantMessage } from './assistant-router/normalize.ts';
import type { PublicHotelPageData } from './public-hotel-data.ts';
import { getServiceEditorialContent } from './service-operational.ts';

export const TOURISM_RECOMMENDATION_SOURCES = [
  'libguest_curated',
  'general_ai',
  'unavailable',
] as const;

export type TourismRecommendationSource =
  typeof TOURISM_RECOMMENDATION_SOURCES[number];

export const TOURISM_RECOMMENDATIONS_CAPABILITY = 'get_tourism_recommendations' as const;

const HOTEL_RESTAURANT_PATTERN = /\b(?:restaurante|restaurant)\s+(?:do|del|of the)\s+hotel\b|\bhotel(?:'s)?\s+restaurant\b/;
const TOURISM_PATTERN = /\b(?:turismo|tourism|passeio|passeios|atracao|atracoes|attraction|attractions|lugar(?:es)? para visitar|places? to visit|sitios? para visitar|o que fazer|what to do|what should i visit|que puedo visitar|que hacer|ponto(?:s)? turistico|tourist spots?|comer fora|eat out|comer afuera)\b/;
const EXTERNAL_RESTAURANT_PATTERN = /(?:\b(?:recomend\w*|indiqu\w*|sugest\w*|suggest\w*)\b.*\b(?:restaurante|restaurantes|restaurant|restaurants)\b|\b(?:restaurante|restaurantes|restaurant|restaurants)\b.*\b(?:fora|outside|afuera|perto|nearby|cerca|regiao|area|zona)\b)/;
const NAMED_EXTERNAL_DETAILS_PATTERN = /(?:hor[aá]rio|pre[cç]o|dist[aâ]ncia|funciona|abert[oa]|dispon[ií]vel|what time|price|distance|open|available|precio|distancia|horario)[^?!.]{0,80}\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}'-]+/u;

export function isOpenTourismQuestion(message: NormalizedAssistantMessage) {
  if (HOTEL_RESTAURANT_PATTERN.test(message.normalized)) return false;
  return TOURISM_PATTERN.test(message.normalized) ||
    EXTERNAL_RESTAURANT_PATTERN.test(message.normalized) ||
    NAMED_EXTERNAL_DETAILS_PATTERN.test(message.original);
}

export function isPublishedHotelRestaurantQuestion(
  message: NormalizedAssistantMessage,
  pageData: Pick<PublicHotelPageData, 'sections'>
) {
  const asksAboutRestaurant = /\b(?:restaurante|restaurant)\b/.test(message.normalized);
  const explicitlyExternal = EXTERNAL_RESTAURANT_PATTERN.test(message.normalized);
  if (!asksAboutRestaurant || explicitlyExternal) return false;
  return pageData.sections.some((section) => {
    const publicText = `${section.title ?? ''} ${section.category ?? ''}`
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(?:restaurante|restaurant|alimentacao|food)\b/.test(publicText);
  });
}

export function resolvePublishedHotelRestaurantResponse(
  message: NormalizedAssistantMessage,
  pageData: Pick<PublicHotelPageData, 'sections'>
) {
  if (!isPublishedHotelRestaurantQuestion(message, pageData)) return null;
  const section = pageData.sections.find((item) => {
    const publicText = `${item.title ?? ''} ${item.category ?? ''}`
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(?:restaurante|restaurant|alimentacao|food)\b/.test(publicText);
  });
  if (!section?.title) return null;
  const content = getServiceEditorialContent(section);
  return [section.title, content].filter(Boolean).join(' — ');
}

export function resolveTourismRecommendationSource({
  hasLibguestCuratedRecommendations,
  allowGeneralAi,
}: {
  hasLibguestCuratedRecommendations: boolean;
  allowGeneralAi: boolean;
}): TourismRecommendationSource {
  if (hasLibguestCuratedRecommendations) return 'libguest_curated';
  return allowGeneralAi ? 'general_ai' : 'unavailable';
}

const GENERAL_AI_DISCLOSURE: Record<SupportedPublicLanguage, { prefix: string; suffix: string }> = {
  pt: {
    prefix: 'Sugestão geral (não é uma indicação oficial do hotel):',
    suffix: 'Confirme os detalhes e o funcionamento nos canais oficiais do estabelecimento antes de sair.',
  },
  en: {
    prefix: 'General suggestion (not an official hotel recommendation):',
    suffix: 'Please confirm details and opening status through the establishment’s official channels before leaving.',
  },
  es: {
    prefix: 'Sugerencia general (no es una recomendación oficial del hotel):',
    suffix: 'Confirma los detalles y el funcionamiento en los canales oficiales del establecimiento antes de salir.',
  },
};

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const UNSOURCED_OPERATIONAL_CLAIM_PATTERN = /(?:\bparceir\w*\b|\bpartner(?:ship|ed)?\b|\bprecio\b|\bpre[cç]o\b|\bcusta?\b|(?:R\$|US\$|[$€£])\s*\d|\b\d+(?:[.,]\d+)?\s*(?:km|metros?|meters?|millas?|miles?)\b|\b\d+\s*(?:minutos?|minutes?)\b|\b\d{1,2}(?::\d{2}|h\d{0,2})\b|\babert[oa]s?\b|\bopen(?:s|ing)?\b|\bfunciona(?:mento)?\b|\bdispon[ií]vel\b|\bavailable\b)/i;

const UNSOURCED_DETAILS_REMOVED: Record<SupportedPublicLanguage, string> = {
  pt: 'Não há detalhes públicos cadastrados no LibGuest para eu confirmar esse estabelecimento.',
  en: 'LibGuest has no published details that let me confirm this establishment.',
  es: 'LibGuest no tiene detalles públicos registrados que me permitan confirmar este establecimiento.',
};

const UNAVAILABLE_COPY: Record<SupportedPublicLanguage, string> = {
  pt: 'O hotel ainda não publicou recomendações externas no LibGuest. Confirme opções e detalhes nos canais oficiais dos estabelecimentos.',
  en: 'The hotel has not yet published external recommendations in LibGuest. Please confirm options and details through the establishments’ official channels.',
  es: 'El hotel aún no ha publicado recomendaciones externas en LibGuest. Confirma las opciones y los detalles en los canales oficiales de los establecimientos.',
};

const GENERAL_SUGGESTION_PATTERN = /\b(?:recomendo|recomendaria|sugiro|considere|voce pode (?:visitar|conhecer|experimentar)|vale conhecer|i recommend|i suggest|consider|you (?:can|could) (?:visit|try|explore)|recomiendo|sugiero|considera|puedes (?:visitar|conocer|probar))\b/i;
const GENERAL_SUGGESTION_LIST_PATTERN = /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+\p{L}.{2,}/mu;
const NO_SUGGESTION_PATTERN = /\b(?:nao tenho|nao ha|nao possuo|sem informacoes|nenhuma informacao|consulte (?:a )?recepcao|fale com (?:a )?recepcao|i (?:do not|don't) have|no information|contact the front desk|check official sources|no tengo|no hay|sin informacion|consulta (?:con )?recepcion)\b/i;

export function removeModelProvidedUrls(answer: string) {
  return answer
    .replace(URL_PATTERN, '[link removido]')
    .replace(/[ \t]+\n/g, '\n');
}

export function discloseGeneralAiTourismSuggestion(
  answer: string,
  language: SupportedPublicLanguage
) {
  const safeAnswer = removeModelProvidedUrls(answer).trim();
  const copy = GENERAL_AI_DISCLOSURE[language];
  const guardedAnswer = UNSOURCED_OPERATIONAL_CLAIM_PATTERN.test(safeAnswer)
    ? UNSOURCED_DETAILS_REMOVED[language]
    : safeAnswer;
  return `${copy.prefix}\n\n${guardedAnswer}\n\n${copy.suffix}`;
}

export function buildUnavailableTourismResponse(language: SupportedPublicLanguage) {
  return UNAVAILABLE_COPY[language];
}

export function resolveGeneralAiTourismResponse(
  answer: string,
  language: SupportedPublicLanguage
): { answer: string; source: Extract<TourismRecommendationSource, 'general_ai' | 'unavailable'> } {
  const safeAnswer = removeModelProvidedUrls(answer).trim();
  const normalized = safeAnswer
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const hasSuggestion = GENERAL_SUGGESTION_PATTERN.test(normalized) ||
    GENERAL_SUGGESTION_LIST_PATTERN.test(safeAnswer);
  const isUnavailable =
    !safeAnswer ||
    NO_SUGGESTION_PATTERN.test(normalized) ||
    UNSOURCED_OPERATIONAL_CLAIM_PATTERN.test(safeAnswer) ||
    !hasSuggestion;
  if (isUnavailable) {
    return { answer: buildUnavailableTourismResponse(language), source: 'unavailable' };
  }
  return {
    answer: discloseGeneralAiTourismSuggestion(safeAnswer, language),
    source: 'general_ai',
  };
}
