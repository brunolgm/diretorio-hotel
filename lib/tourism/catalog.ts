export const TOURISM_TYPES = [
  { key: 'PLACE', labels: { pt: 'Lugar', en: 'Place', es: 'Lugar' } },
  { key: 'EXPERIENCE', labels: { pt: 'Experiência', en: 'Experience', es: 'Experiencia' } },
  { key: 'GASTRONOMY', labels: { pt: 'Gastronomia', en: 'Gastronomy', es: 'Gastronomía' } },
] as const;

export type TourismType = (typeof TOURISM_TYPES)[number]['key'];

export const TOURISM_CATEGORIES = [
  { type: 'PLACE', key: 'sights', labels: { pt: 'Pontos turísticos', en: 'Sights', es: 'Lugares de interés' } },
  { type: 'PLACE', key: 'beaches_and_nature', labels: { pt: 'Praias & Natureza', en: 'Beaches & Nature', es: 'Playas y naturaleza' } },
  { type: 'PLACE', key: 'culture_and_history', labels: { pt: 'Cultura & História', en: 'Culture & History', es: 'Cultura e historia' } },
  { type: 'PLACE', key: 'neighborhoods_and_regions', labels: { pt: 'Bairros & Regiões', en: 'Neighborhoods & Regions', es: 'Barrios y regiones' } },
  { type: 'PLACE', key: 'shopping', labels: { pt: 'Compras', en: 'Shopping', es: 'Compras' } },
  { type: 'EXPERIENCE', key: 'tours', labels: { pt: 'Passeios & Tours', en: 'Tours', es: 'Paseos y tours' } },
  { type: 'EXPERIENCE', key: 'local_culture', labels: { pt: 'Cultura Local', en: 'Local Culture', es: 'Cultura local' } },
  { type: 'EXPERIENCE', key: 'nature_and_adventure', labels: { pt: 'Natureza & Aventura', en: 'Nature & Adventure', es: 'Naturaleza y aventura' } },
  { type: 'EXPERIENCE', key: 'nightlife', labels: { pt: 'Vida Noturna', en: 'Nightlife', es: 'Vida nocturna' } },
  { type: 'EXPERIENCE', key: 'wellness', labels: { pt: 'Bem-estar', en: 'Wellness', es: 'Bienestar' } },
  { type: 'GASTRONOMY', key: 'restaurants', labels: { pt: 'Restaurantes', en: 'Restaurants', es: 'Restaurantes' } },
  { type: 'GASTRONOMY', key: 'bars', labels: { pt: 'Bares', en: 'Bars', es: 'Bares' } },
  { type: 'GASTRONOMY', key: 'cafes_and_bakeries', labels: { pt: 'Cafés & Confeitarias', en: 'Cafés & Bakeries', es: 'Cafés y pastelerías' } },
  { type: 'GASTRONOMY', key: 'local_cuisine', labels: { pt: 'Gastronomia Local', en: 'Local Cuisine', es: 'Gastronomía local' } },
  { type: 'GASTRONOMY', key: 'markets_and_fairs', labels: { pt: 'Mercados & Feiras', en: 'Markets & Fairs', es: 'Mercados y ferias' } },
] as const satisfies readonly { type: TourismType; key: string; labels: Record<'pt' | 'en' | 'es', string> }[];

export type TourismCategoryKey = (typeof TOURISM_CATEGORIES)[number]['key'];

export function isTourismCategoryPair(type: unknown, category: unknown): boolean {
  return TOURISM_CATEGORIES.some((entry) => entry.type === type && entry.key === category);
}
