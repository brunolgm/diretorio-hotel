import type { ExperienceBlockKey, ExperienceLayoutBlock } from './experience-layout.ts';
import { getComposedExperienceBlockKeys } from './experience-layout.ts';
import type { PublicHotelPageData } from './public-hotel-data.ts';

// Presentation only: loaders/RPCs already apply lifecycle, translations and entitlements.
// Keep every canonical block in this overview; never maintain a tenant content catalog.
export function getPublicExperienceOverview(data: PublicHotelPageData) {
  const available = new Set<ExperienceBlockKey>(['hero', 'quick_info', 'contact']);
  if (data.banners.length) available.add('banners');
  if (data.announcements.length) available.add('announcements');
  if (data.sections.length) available.add('services');
  if (data.departments.length) available.add('departments');
  if (data.policies.length) available.add('policies');
  return getComposedExperienceBlockKeys(data.layout, available);
}

export function getOverviewNavigation(layout: ExperienceLayoutBlock[], servicesCount: number) {
  const enabled = (key: ExperienceBlockKey) => layout.some((b) => b.blockKey === key && b.isEnabled);
  return {
    services: enabled('services') && servicesCount > 0,
    menu: false,
    information: enabled('quick_info'),
    contact: enabled('contact'),
  };
}
