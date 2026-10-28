import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { HOTEL_BRAND_CODES, isAllowedAdminThemePreset, isHotelBrandCode, resolveHotelTheme } from '../../lib/hotel-theme.ts';
import { resolveAdminTheme } from '../../lib/admin-theme.ts';
import { getPlatformHotelBrandLabel, normalizePlatformHotelBrand } from '../../lib/platform-governance.ts';
import { generateHotelSlug, generateHotelSubdomain, isValidHotelSlug, isValidHotelSubdomain, validatePlatformOnboardingForm } from '../../lib/platform-onboarding.ts';
import { getDefaultExperienceLayout, EXPERIENCE_BLOCK_KEYS } from '../../lib/experience-layout.ts';
import { getPublicExperienceOverview, getOverviewNavigation } from '../../lib/public-experience-overview.ts';
import { MODULE_CATALOG, BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';
import { getAdminNavigationForRole } from '../../lib/admin-navigation.ts';
import { getPublicCopy } from '../../lib/public-copy.ts';
import type { PublicHotelPageData } from '../../lib/public-hotel-data.ts';

const read = (p: string) => readFileSync(p, 'utf8');
const matrix = ['grand-mercure', 'novotel', 'mercure', 'bugan', null] as const;
const empty = () => ({ layout: getDefaultExperienceLayout(), banners: [], announcements: [], sections: [], departments: [], policies: [] }) as unknown as PublicHotelPageData;

test('canonical brand matrix accepts Bugan and preserves fallback and existing identities', () => {
  for (const brand of matrix) {
    assert.equal(normalizePlatformHotelBrand(brand), brand);
    assert.equal(resolveAdminTheme(brand).code, brand ?? 'libguest-default');
    assert.equal(resolveHotelTheme(brand, null).preset, brand ?? 'midnight-slate');
    if (brand) assert.ok(isHotelBrandCode(brand));
  }
  assert.deepEqual([...HOTEL_BRAND_CODES].sort(), ['bugan', 'grand-mercure', 'mercure', 'novotel']);
  assert.equal(getPlatformHotelBrandLabel('bugan'), 'Bugan');
  assert.equal(normalizePlatformHotelBrand('bugan-recife'), undefined);
  assert.equal(isHotelBrandCode(null), false);
  assert.equal(isHotelBrandCode('invalid'), false);
  assert.equal(resolveHotelTheme('invalid', null).preset, 'midnight-slate');
});

test('Bugan onboarding uses canonical form validation, syntax and existing suggestion behavior', () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Bugan Recife', city: 'Recife, PE', slug: 'bugan-recife', subdomain: 'bugan-recife', brand_code: 'bugan', theme_preset: '', admin_full_name: 'Synthetic Admin', admin_email: 'admin@example.invalid', confirmed: 'true' })) form.set(key, value);
  assert.equal(validatePlatformOnboardingForm(form).ok, true);
  assert.equal(generateHotelSlug('Bugan Recife'), 'bugan-recife');
  assert.equal(generateHotelSubdomain('bugan-recife'), 'buganrecife');
  assert.ok(isValidHotelSlug('bugan-recife'));
  assert.ok(isValidHotelSubdomain('bugan-recife'));
  form.set('brand_code', 'bugan-recife');
  assert.equal(validatePlatformOnboardingForm(form).ok, false);
  form.set('brand_code', '');
  assert.equal(validatePlatformOnboardingForm(form).ok, true);
});

test('theme governance and per-call token isolation hold for the full matrix', () => {
  for (const brand of matrix) {
    assert.equal(isAllowedAdminThemePreset({ brand_code: brand, theme_preset: null }, 'bugan'), brand === 'bugan');
    const original = resolveAdminTheme(brand);
    const modified = resolveAdminTheme('bugan');
    modified.colors.accent = '#000000';
    modified.semantic.success = '#000000';
    assert.deepEqual(resolveAdminTheme(brand), original);
    assert.equal(resolveHotelTheme(brand, '#123456').tokens.accent, '#123456');
    assert.notEqual(resolveHotelTheme(brand, null).tokens.accent, '#123456');
  }
  assert.equal(resolveHotelTheme('bugan', null).tokens.background, '#F7F1E9');
  assert.equal(resolveHotelTheme('bugan', null).tokens.accent, '#AD6433');
  assert.deepEqual(resolveAdminTheme('bugan').semantic, resolveAdminTheme(null).semantic);
});

test('compact overview uses all canonical blocks, preserves reorder and hides unavailable content', () => {
  const data = empty();
  assert.deepEqual(getPublicExperienceOverview(data), ['hero', 'quick_info', 'contact']);
  for (const field of ['banners', 'announcements', 'sections', 'departments', 'policies'] as const) data[field] = [{}] as never;
  assert.deepEqual(getPublicExperienceOverview(data), [...EXPERIENCE_BLOCK_KEYS]);
  data.layout = data.layout.map((block) => ({ ...block, position: 20 - block.position }));
  const keys = getPublicExperienceOverview(data);
  assert.equal(keys[0], 'hero');
  assert.equal(keys[1], 'contact');
  data.layout = data.layout.map((block) => ({ ...block, isEnabled: block.blockKey === 'hero' }));
  assert.deepEqual(getPublicExperienceOverview(data), ['hero']);
  assert.deepEqual(getOverviewNavigation(data.layout, 1), { services: false, menu: false, information: false, contact: false });
});

test('optional flights, tourism and AI remain off baseline and preserve tourism maturity', () => {
  assert.equal(BASELINE_MODULE_KEYS.length, 12);
  for (const key of ['travel.flights', 'content.tourism', 'analytics.advanced']) assert.ok(!(BASELINE_MODULE_KEYS as readonly string[]).includes(key));
  assert.equal(MODULE_CATALOG.find((m) => m.key === 'content.tourism')?.availability, 'coming_soon');
  assert.equal(MODULE_CATALOG.find((m) => m.key === 'travel.flights')?.availability, 'available');
  assert.ok(!MODULE_CATALOG.some((m) => /concierge|gptmaker/i.test(m.key)));
  const overview = read('components/public/public-experience-overview.tsx');
  assert.doesNotMatch(overview, /supabase|fetch\(|gptmaker|roomToken|wifi_password|setInterval/);
  assert.match(overview, /flightHomeCard \?/);
  assert.match(overview, /activeRoomContext \?/);
  assert.match(overview, /hotel\.wifi_name/);
  assert.match(overview, /getPublicExperienceOverview\(pageData\)/);
});

test('Bugan reuses multilingual copy and the same role/entitlement navigation as every theme', () => {
  assert.equal(getPublicCopy('pt').stayInformation, 'Informações da estadia');
  assert.equal(getPublicCopy('en').stayInformation, 'Stay information');
  assert.equal(getPublicCopy('es').stayInformation, 'Información de la estadía');
  for (const brand of matrix) {
    const theme = resolveAdminTheme(brand);
    assert.ok(theme.code);
    const baseline = new Set(BASELINE_MODULE_KEYS);
    const nav = getAdminNavigationForRole('visualizador', baseline).flatMap((group) => group.items);
    assert.ok(!nav.some((item) => item.href === '/admin/voos' || item.href === '/admin/turismo' || item.href === '/admin/usuarios'));
    const withFlights = new Set([...BASELINE_MODULE_KEYS, 'travel.flights'] as const);
    assert.ok(getAdminNavigationForRole('visualizador', withFlights).flatMap((group) => group.items).some((item) => item.href === '/admin/voos'));
  }
});

test('admin metrics preserve loader errors and route attention/links through existing permissions', () => {
  const page = read('app/admin/experiencia/page.tsx');
  assert.match(page, /sources\.some\(\(\{ error \}\) => error\)\) throw new Error/);
  assert.match(page, /translationResults\.some\(\(\{ error \}\) => error\)\) throw new Error/);
  assert.match(page, /getAdminNavigationForRole\(profile\.normalizedRole, enabledModules\)/);
  assert.match(page, /checks\.filter\(\(check\) => !check\.passed\)/);
  assert.match(page, /!enabledModules\.has\('core.directory'\)/);
  assert.doesNotMatch(page, /Salvar rascunho|Publicar alterações|Alterações pendentes/);
});

test('migration changes only the allowlists, Bugan onboarding default and insert-only layout default', () => {
  const migration = read('supabase/migrations/20261027215620_bugan_canonical_brand.sql');
  const source = read('supabase/migrations/202608180001_50_public_experience_composition.sql');
  const functionBody = (sql: string, name: string) => sql.slice(sql.indexOf(`function public.${name}(`)).split('$$;')[0];
  const prior = functionBody(source, 'create_platform_hotel_onboarding');
  const next = functionBody(migration, 'create_platform_hotel_onboarding');
  assert.equal(next.replace("not in('mercure','novotel','grand-mercure','bugan')", "not in('mercure','novotel','grand-mercure')").replace("p_brand_code,case when p_brand_code='bugan' then coalesce(p_theme_preset,'bugan') else p_theme_preset end,'draft'", "p_brand_code,p_theme_preset,'draft'").replace(/\r/g, ''), prior.replace(/\r/g, ''));
  const governance = read('supabase/migrations/202608140002_46c_platform_hotel_governance.sql');
  assert.equal(functionBody(migration, 'update_platform_hotel_brand').replace("not in ('mercure', 'novotel', 'grand-mercure', 'bugan')", "not in ('mercure', 'novotel', 'grand-mercure')").replace(/\r/g, ''), functionBody(governance, 'update_platform_hotel_brand').replace(/\r/g, ''));
  assert.doesNotMatch(migration, /grant |create policy|disable row level security|delete from/i);
  assert.match(migration, /brand_code is null/);
  assert.match(migration, /when new\.brand_code='bugan' then b\.bugan_position/);
});
