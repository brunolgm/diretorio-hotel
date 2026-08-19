type GrandMercurePropertyIdentity = {
  slug: string;
};

const GRAND_MERCURE_RIO_COPACABANA_SLUG = 'grandmercureriocopacabana';

export function isGrandMercureRioCopacabanaProperty(hotel: GrandMercurePropertyIdentity) {
  return hotel.slug === GRAND_MERCURE_RIO_COPACABANA_SLUG;
}

export function getGrandMercurePropertyLabel(hotelName: string) {
  const propertyName = hotelName.trim().replace(/^grand\s+mercure\s*/i, '').trim();
  return (propertyName || hotelName.trim()).toLocaleUpperCase('pt-BR');
}
