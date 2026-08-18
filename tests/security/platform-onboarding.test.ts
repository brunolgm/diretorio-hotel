import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG } from '../../lib/modules/catalog.ts';
import {
  LOCAL_PLATFORM_INVITE_REDIRECT_URL,
  PLATFORM_INVITE_REDIRECT_URL,
  resolvePlatformInviteRedirectUrl,
} from '../../lib/platform-invite-url.ts';
import {
  generateHotelSlug,
  generateHotelSubdomain,
  provisionHotelOnboarding,
  validatePlatformOnboardingForm,
} from '../../lib/platform-onboarding.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

function validForm() {
  const form = new FormData();
  form.set('name', 'Grand Mercure Recife');
  form.set('city', 'Recife');
  form.set('slug', 'grand-mercure-recife');
  form.set('subdomain', 'grandmercurerecife');
  form.set('brand_code', 'grand-mercure');
  form.set('theme_preset', 'graphite-gold');
  form.set('admin_full_name', 'Administrador Sintético');
  form.set('admin_email', 'admin@example.invalid');
  form.set('confirmed', 'true');
  return form;
}

test('generates canonical bounded slug and subdomain suggestions', () => {
  assert.equal(generateHotelSlug('  Hôtel São João -- Recife!  '), 'hotel-sao-joao-recife');
  assert.equal(generateHotelSubdomain('hotel-sao-joao-recife'), 'hotelsaojoaorecife');
  assert.ok(generateHotelSlug('a'.repeat(100)).length <= 64);
  assert.ok(generateHotelSubdomain('a'.repeat(100)).length <= 32);
});

test('validates every onboarding contract and explicit draft confirmation', () => {
  const valid = validatePlatformOnboardingForm(validForm());
  assert.equal(valid.ok, true);
  const invalid = validForm();
  invalid.set('slug', 'slug--inválido');
  assert.equal(validatePlatformOnboardingForm(invalid).ok, false);
  const unconfirmed = validForm();
  unconfirmed.delete('confirmed');
  assert.equal(validatePlatformOnboardingForm(unconfirmed).ok, false);
});

test('keeps the canonical twelve-module baseline available-only', () => {
  assert.equal(BASELINE_MODULE_KEYS.length, 12);
  assert.equal(new Set(BASELINE_MODULE_KEYS).size, 12);
  for (const key of BASELINE_MODULE_KEYS) {
    assert.equal(MODULE_CATALOG.find((module) => module.key === key)?.availability, 'available');
  }
  assert.equal(MODULE_CATALOG.filter((module) => module.availability === 'coming_soon').length, 7);
});

test('compensates an Auth invite only when the database transaction fails', async () => {
  const deleted: string[] = [];
  const failed = await provisionHotelOnboarding({
    inviteAuthUser: async () => ({ ok: true, value: { userId: 'user-1' } }),
    createHotel: async () => ({ ok: false, error: new Error('database failed') }),
    deleteAuthUser: async (userId) => { deleted.push(userId); return { ok: true, value: undefined }; },
  });
  assert.deepEqual(deleted, ['user-1']);
  assert.equal(failed.ok, false);
  assert.equal(!failed.ok && failed.stage === 'database' && failed.compensated, true);

  deleted.length = 0;
  const created = await provisionHotelOnboarding({
    inviteAuthUser: async () => ({ ok: true, value: { userId: 'user-2' } }),
    createHotel: async () => ({ ok: true, value: { hotelId: 'hotel-1' } }),
    deleteAuthUser: async (userId) => { deleted.push(userId); return { ok: true, value: undefined }; },
  });
  assert.deepEqual(created, { ok: true, hotelId: 'hotel-1', adminUserId: 'user-2' });
  assert.deepEqual(deleted, []);
});

test('does not compensate when the Auth invite itself is rejected', async () => {
  let databaseCalls = 0;
  let deleteCalls = 0;
  const result = await provisionHotelOnboarding({
    inviteAuthUser: async () => ({ ok: false, error: new Error('User already registered') }),
    createHotel: async () => { databaseCalls += 1; return { ok: true, value: { hotelId: 'never' } }; },
    deleteAuthUser: async () => { deleteCalls += 1; return { ok: true, value: undefined }; },
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.stage, 'auth');
  assert.equal(databaseCalls, 0);
  assert.equal(deleteCalls, 0);
});

test('reports incomplete Auth compensation distinctly', async () => {
  let deleteCalls = 0;
  const result = await provisionHotelOnboarding({
    inviteAuthUser: async () => ({ ok: true, value: { userId: 'user-3' } }),
    createHotel: async () => ({ ok: false, error: new Error('database failed') }),
    deleteAuthUser: async () => { deleteCalls += 1; return { ok: false, error: new Error('delete failed') }; },
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.stage === 'database' && result.compensated, false);
  assert.ok(!result.ok && result.stage === 'database' && result.compensationError);
  assert.equal(deleteCalls, 1);
});

test('uses only canonical allowlisted invitation destinations', () => {
  assert.equal(
    resolvePlatformInviteRedirectUrl('https://project.supabase.co'),
    PLATFORM_INVITE_REDIRECT_URL
  );
  assert.equal(PLATFORM_INVITE_REDIRECT_URL, 'https://libguest.digital/login');
  assert.equal(
    resolvePlatformInviteRedirectUrl('http://127.0.0.1:54321'),
    LOCAL_PLATFORM_INVITE_REDIRECT_URL
  );
  assert.equal(
    resolvePlatformInviteRedirectUrl('http://localhost:54321'),
    'http://localhost:3000/login'
  );
  assert.equal(
    resolvePlatformInviteRedirectUrl('http://localhost:9999'),
    PLATFORM_INVITE_REDIRECT_URL
  );
});

test('keeps Auth Admin server-only and executes database creation as the platform session', () => {
  const action = read('app', 'platform', 'hoteis', 'novo', 'actions.ts');
  const admin = read('lib', 'supabase', 'admin.ts');
  assert.match(action, /requirePlatformAccess\(\)/);
  assert.match(action, /inviteUserByEmail/);
  assert.match(action, /redirectTo: inviteRedirectTo/);
  assert.match(action, /getRequiredEnvVar\('NEXT_PUBLIC_SUPABASE_URL'\)/);
  assert.doesNotMatch(action, /formData\.get\(['"]redirect|headers\(\)|\.get\(['"](?:host|origin)/i);
  assert.match(action, /createClient\(\)/);
  assert.match(action, /rpc\('create_platform_hotel_onboarding'/);
  assert.match(action, /deleteUser/);
  assert.match(action, /Já existe um usuário com este e-mail\./);
  assert.doesNotMatch(action, /createUser|password\s*:/i);
  assert.match(admin, /import 'server-only'/);
  const browserForm = read('app', 'platform', 'hoteis', 'novo', 'onboarding-form.tsx');
  assert.doesNotMatch(browserForm, /service.role/i);
  assert.doesNotMatch(browserForm, /name=["'](?:password|senha)["']|type=["']password["']/i);
});

test('renders the five-step review flow without automatic activation', () => {
  const form = read('app', 'platform', 'hoteis', 'novo', 'onboarding-form.tsx');
  const action = read('app', 'platform', 'hoteis', 'novo', 'actions.ts');
  for (const label of ['Identidade', 'Endereço', 'Módulos', 'Administrador', 'Revisão']) assert.match(form, new RegExp(label));
  assert.match(form, /reportValidity/);
  assert.match(form, /Em breve/);
  assert.match(form, /BASELINE_MODULE_KEYS\.length/);
  assert.match(form, /Lifecycle inicial/);
  assert.match(action, /Hotel criado em preparação/);
  assert.match(action, /redirect\(`\/platform\/hoteis\/\$\{provisioning\.hotelId\}/);
  assert.doesNotMatch([form, action].join('\n'), /p_status|platform_status\s*[:=]\s*['"]active/i);
});

test('migration creates one narrow atomic draft-only RPC and controlled audit', () => {
  const migration = read('supabase', 'migrations', '202608170001_47_multi_hotel_onboarding.sql');
  assert.match(migration, /create function public\.create_platform_hotel_onboarding/);
  assert.match(migration, /security definer set search_path=''/i);
  assert.match(migration, /active_platform_admin_required/);
  assert.match(migration, /values\(new_hotel_id[\s\S]*?'draft'\)/);
  assert.match(migration, /platform_hotel_slug_conflict/);
  assert.match(migration, /platform_hotel_subdomain_conflict/);
  assert.match(migration, /perform public\.record_platform_audit_event/);
  assert.match(migration, /'hotel\.created'/);
  assert.match(migration, /'baseline_modules',11/);
  assert.match(migration, /'\(\[a-z0-9\._-\]\+\)'/);
  assert.match(migration, /array_agg\(matches\[1\] order by matches\[1\]\)/);
  assert.match(migration, /actual_keys is distinct from expected_keys/);
  assert.doesNotMatch(migration, /canonical_module_count|'''\[a-z0-9\.-\]\+'''/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete) on (table )?public\.(hotels|profiles|hotel_module_entitlements)/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]*service_role/i);
});
