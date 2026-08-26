export const CANONICAL_PUBLIC_NAVIGATION_KEYS = [
  'home',
  'services',
  'menu',
  'information',
  'contact',
] as const;

export type CanonicalPublicNavigationKey =
  (typeof CANONICAL_PUBLIC_NAVIGATION_KEYS)[number];

export interface PublicNavigationAvailability {
  services: boolean;
  menu: boolean;
  information: boolean;
  contact: boolean;
}

export function getPublicNavigationAvailability({
  layout,
  servicesModuleEnabled,
  servicesContentCount,
  menuModuleEnabled,
  menuContentCount,
}: {
  layout: ReadonlyArray<{ blockKey: string; isEnabled: boolean }>;
  servicesModuleEnabled: boolean;
  servicesContentCount: number;
  menuModuleEnabled: boolean;
  menuContentCount: number;
}): PublicNavigationAvailability {
  const enabled = (blockKey: string) =>
    layout.some((block) => block.blockKey === blockKey && block.isEnabled);

  return {
    services: enabled('services') && servicesModuleEnabled && servicesContentCount > 0,
    menu: menuModuleEnabled && menuContentCount > 0,
    information: enabled('quick_info'),
    contact: enabled('contact'),
  };
}

export function getCanonicalPublicNavigationKeys(
  availability: PublicNavigationAvailability
) {
  return CANONICAL_PUBLIC_NAVIGATION_KEYS.filter(
    (key) => key === 'home' || availability[key]
  );
}
