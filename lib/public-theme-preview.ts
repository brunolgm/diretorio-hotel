import {
  isHotelBrandPreset,
  isHotelThemePreset,
  type HotelVisualPreset,
} from '@/lib/hotel-theme';

export function resolveDevelopmentThemePreview(
  value: string | string[] | undefined,
): HotelVisualPreset | null {
  if (process.env.NODE_ENV !== 'development' || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return isHotelThemePreset(normalized) || isHotelBrandPreset(normalized)
    ? normalized
    : null;
}
