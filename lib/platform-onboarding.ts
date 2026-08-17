import { HOTEL_THEME_PRESETS, type HotelThemePreset } from './hotel-theme.ts';
import { normalizePlatformHotelBrand, type PlatformHotelBrand } from './platform-governance.ts';

export const ONBOARDING_LIMITS = {
  name: 120,
  city: 100,
  slug: 64,
  subdomain: 32,
  fullName: 120,
  email: 254,
} as const;

export type PlatformOnboardingInput = {
  name: string;
  city: string;
  slug: string;
  subdomain: string;
  brandCode: PlatformHotelBrand | null;
  themePreset: HotelThemePreset | null;
  adminFullName: string;
  adminEmail: string;
  confirmed: boolean;
};

export type PlatformOnboardingValidation =
  | { ok: true; value: PlatformOnboardingInput }
  | { ok: false; message: string };

function trim(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function generateHotelSlug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, ONBOARDING_LIMITS.slug).replace(/-$/g, '');
}

export function generateHotelSubdomain(slug: string) {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, ONBOARDING_LIMITS.subdomain);
}

export function isValidHotelSlug(value: string) {
  return value.length >= 3 && value.length <= ONBOARDING_LIMITS.slug
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isValidHotelSubdomain(value: string) {
  return value.length >= 3 && value.length <= ONBOARDING_LIMITS.subdomain
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(value)
    && !value.includes('--')
    && !['www', 'app', 'admin', 'api', 'guestdesk'].includes(value);
}

export function validatePlatformOnboardingForm(formData: FormData): PlatformOnboardingValidation {
  const name = trim(formData.get('name'));
  const city = trim(formData.get('city'));
  const slug = trim(formData.get('slug')).toLowerCase();
  const subdomain = trim(formData.get('subdomain')).toLowerCase();
  const rawBrand = trim(formData.get('brand_code'));
  const brandCode = normalizePlatformHotelBrand(rawBrand || null);
  const rawTheme = trim(formData.get('theme_preset'));
  const themePreset = HOTEL_THEME_PRESETS.some(({ value }) => value === rawTheme)
    ? rawTheme as HotelThemePreset : rawTheme ? undefined : null;
  const adminFullName = trim(formData.get('admin_full_name'));
  const adminEmail = trim(formData.get('admin_email')).toLowerCase();
  const confirmed = formData.get('confirmed') === 'true';

  if (!name || name.length > ONBOARDING_LIMITS.name) return { ok: false, message: 'Informe um nome de hotel válido.' };
  if (!city || city.length > ONBOARDING_LIMITS.city) return { ok: false, message: 'Informe uma cidade válida.' };
  if (!isValidHotelSlug(slug)) return { ok: false, message: 'Informe um slug válido com letras, números e hífens.' };
  if (!isValidHotelSubdomain(subdomain)) return { ok: false, message: 'Informe um subdomínio válido e não reservado.' };
  if (brandCode === undefined) return { ok: false, message: 'Selecione uma bandeira canônica.' };
  if (themePreset === undefined) return { ok: false, message: 'Selecione um tema suportado.' };
  if (!adminFullName || adminFullName.length > ONBOARDING_LIMITS.fullName) return { ok: false, message: 'Informe o nome do administrador inicial.' };
  if (adminEmail.length > ONBOARDING_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return { ok: false, message: 'Informe um e-mail válido para o administrador.' };
  if (!confirmed) return { ok: false, message: 'Confirme a criação do hotel em preparação.' };

  return { ok: true, value: { name, city, slug, subdomain, brandCode, themePreset, adminFullName, adminEmail, confirmed } };
}

type OperationResult<T = undefined> = { ok: true; value: T } | { ok: false; error: unknown };

export type HotelOnboardingProvisionResult =
  | { ok: true; hotelId: string; adminUserId: string }
  | { ok: false; stage: 'auth'; error: unknown }
  | { ok: false; stage: 'database'; adminUserId: string; error: unknown; compensated: boolean; compensationError?: unknown };

export async function provisionHotelOnboarding({
  inviteAuthUser, createHotel, deleteAuthUser,
}: {
  inviteAuthUser: () => Promise<OperationResult<{ userId: string }>>;
  createHotel: (userId: string) => Promise<OperationResult<{ hotelId: string }>>;
  deleteAuthUser: (userId: string) => Promise<OperationResult>;
}): Promise<HotelOnboardingProvisionResult> {
  const auth = await inviteAuthUser();
  if (!auth.ok) return { ok: false, stage: 'auth', error: auth.error };
  const database = await createHotel(auth.value.userId);
  if (database.ok) return { ok: true, hotelId: database.value.hotelId, adminUserId: auth.value.userId };
  const compensation = await deleteAuthUser(auth.value.userId);
  return {
    ok: false, stage: 'database', adminUserId: auth.value.userId, error: database.error,
    compensated: compensation.ok,
    ...(compensation.ok ? {} : { compensationError: compensation.error }),
  };
}
