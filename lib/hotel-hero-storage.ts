const HERO_FILE_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type SupportedHotelHeroMimeType = keyof typeof HERO_FILE_EXTENSION_BY_MIME_TYPE;

export function isSupportedHotelHeroMimeType(
  value: string
): value is SupportedHotelHeroMimeType {
  return value in HERO_FILE_EXTENSION_BY_MIME_TYPE;
}

export function getHotelHeroStoragePath(
  hotelId: string,
  mimeType: SupportedHotelHeroMimeType
) {
  return `${hotelId}/hero.${HERO_FILE_EXTENSION_BY_MIME_TYPE[mimeType]}`;
}

export function getHotelHeroStoragePaths(hotelId: string) {
  return Object.values(HERO_FILE_EXTENSION_BY_MIME_TYPE).map(
    (extension) => `${hotelId}/hero.${extension}`
  );
}
