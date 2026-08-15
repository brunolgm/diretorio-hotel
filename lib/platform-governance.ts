export const PLATFORM_HOTEL_BRANDS = [
  { value: 'mercure', label: 'Mercure' },
  { value: 'novotel', label: 'Novotel' },
  { value: 'grand-mercure', label: 'Grand Mercure' },
] as const;

export type PlatformHotelBrand = (typeof PLATFORM_HOTEL_BRANDS)[number]['value'];

export const PLATFORM_HOTEL_STATUSES = [
  { value: 'draft', label: 'Em preparação' },
  { value: 'active', label: 'Ativo' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'archived', label: 'Arquivado' },
] as const;

export type PlatformHotelStatus = (typeof PLATFORM_HOTEL_STATUSES)[number]['value'];

const STATUS_TRANSITIONS: Record<PlatformHotelStatus, readonly PlatformHotelStatus[]> = {
  draft: ['active', 'archived'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export function normalizePlatformHotelBrand(
  value: string | null | undefined
): PlatformHotelBrand | null | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return null;
  return PLATFORM_HOTEL_BRANDS.some((brand) => brand.value === normalized)
    ? (normalized as PlatformHotelBrand)
    : undefined;
}

export function normalizePlatformHotelStatus(
  value: string | null | undefined
): PlatformHotelStatus | null {
  const normalized = value?.trim().toLowerCase();

  return PLATFORM_HOTEL_STATUSES.some((status) => status.value === normalized)
    ? (normalized as PlatformHotelStatus)
    : null;
}

export function getPlatformHotelBrandLabel(value: string | null | undefined) {
  if (!value || value === 'unassigned') return 'Sem bandeira';
  return PLATFORM_HOTEL_BRANDS.find((brand) => brand.value === value)?.label || value;
}

export function getPlatformHotelStatusLabel(value: string) {
  return PLATFORM_HOTEL_STATUSES.find((status) => status.value === value)?.label || value;
}

export function getAllowedPlatformHotelStatusTransitions(status: PlatformHotelStatus) {
  return STATUS_TRANSITIONS[status];
}

export function isAllowedPlatformHotelStatusTransition(
  current: PlatformHotelStatus,
  next: PlatformHotelStatus
) {
  return STATUS_TRANSITIONS[current].includes(next);
}
