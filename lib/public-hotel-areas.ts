import type { PublicHotelSection } from '@/lib/public-hotel-data';

const TOURISM_TERMS = [
  'turismo',
  'tourism',
  'turistico',
  'tourist',
  'passeio',
  'passeios',
  'tour',
  'tours',
  'mapa',
  'map',
  'atracao',
  'attraction',
  'experiencia local',
  'local experience',
  'mobilidade',
  'transfer',
];

function normalizeSearchText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isTourismSection(section: PublicHotelSection) {
  const searchable = normalizeSearchText(`${section.title} ${section.category || ''}`);
  return TOURISM_TERMS.some((term) => searchable.includes(term));
}

export function getRoomMenuSection(sections: PublicHotelSection[]) {
  return sections.find((section) => section.service_action_type === 'room_restaurant_menu') || null;
}

export function getTourismSections(sections: PublicHotelSection[]) {
  return sections.filter(isTourismSection);
}
