export const SERVICE_OPERATIONAL_KEYS = ['breakfast'] as const;

export type ServiceOperationalKey = (typeof SERVICE_OPERATIONAL_KEYS)[number];

export const SERVICE_OPERATIONAL_KEY_OPTIONS: Array<{
  value: ServiceOperationalKey;
  label: string;
}> = [{ value: 'breakfast', label: 'Café da manhã' }];

type OperationalSection = {
  operational_key: string | null | undefined;
  content: string | null | undefined;
};

const LEGACY_OPERATIONAL_HOURS_SUFFIX = /\s*(?:hor[aá]rio|hours?)\s*:\s*[^\r\n]*$/iu;

export function parseServiceOperationalKey(
  value: string | null | undefined
): ServiceOperationalKey | null {
  const normalized = value?.trim() || null;
  if (!normalized) return null;
  if (SERVICE_OPERATIONAL_KEYS.includes(normalized as ServiceOperationalKey)) {
    return normalized as ServiceOperationalKey;
  }
  throw new Error('Invalid service operational function');
}

export function isBreakfastOperationalSection(
  section: Pick<OperationalSection, 'operational_key'>
) {
  return section.operational_key === 'breakfast';
}

export function getServiceEditorialContent(section: OperationalSection) {
  if (!isBreakfastOperationalSection(section)) return section.content;
  const content = section.content?.trim();
  if (!content) return null;
  return content.replace(LEGACY_OPERATIONAL_HOURS_SUFFIX, '').trim() || null;
}

export function getServiceCanonicalHours(
  section: Pick<OperationalSection, 'operational_key'>,
  breakfastHours: string | null | undefined
) {
  if (!isBreakfastOperationalSection(section)) return null;
  return breakfastHours?.trim() || null;
}
