import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG, MODULE_KEYS } from '../../lib/modules/catalog.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migrationPath = ['supabase', 'migrations', '202608250001_51_travel_flights_entitlement.sql'];

test('registers travel.flights as an available optional operations module', () => {
  const flightModule = MODULE_CATALOG.find(({ key }) => key === 'travel.flights');
  assert.ok(MODULE_KEYS.includes('travel.flights'));
  assert.equal(flightModule?.availability, 'available');
  assert.equal(flightModule?.group, 'operations');
  assert.equal(BASELINE_MODULE_KEYS.length, 12);
  assert.equal((BASELINE_MODULE_KEYS as readonly string[]).includes('travel.flights'), false);
});

test('extends every database module allowlist without provisioning the new entitlement', () => {
  const migration = read(...migrationPath);
  assert.match(migration, /add constraint hotel_module_entitlements_module_key_check[\s\S]*?'travel\.flights'/i);
  assert.match(migration, /create or replace function public\.is_hotel_module_enabled[\s\S]*?'travel\.flights'/i);
  assert.match(migration, /create or replace function public\.get_platform_hotel_modules[\s\S]*?'travel\.flights'/i);
  assert.match(migration, /create or replace function public\.update_platform_hotel_module[\s\S]*?'travel\.flights'/i);
  assert.doesNotMatch(migration, /insert into public\.hotel_module_entitlements[\s\S]{0,500}'travel\.flights'/i);
  assert.doesNotMatch(migration, /create or replace function public\.create_platform_hotel_onboarding/i);
});

test('keeps Platform mutation security, availability and auditing contracts intact', () => {
  const migration = read(...migrationPath);
  const updateFunction = migration.match(
    /create or replace function public\.update_platform_hotel_module[\s\S]*?end;\r?\n\$\$;/i
  )?.[0] || '';
  assert.match(updateFunction, /active_platform_admin_required/);
  assert.match(updateFunction, /platform_module_invalid/);
  assert.match(updateFunction, /platform_module_dependency_required/);
  assert.match(updateFunction, /perform public\.record_platform_audit_event/);
  assert.doesNotMatch(
    updateFunction.match(/platform_module_not_available[\s\S]*/i)?.[0] || '',
    /travel\.flights/
  );
  assert.match(migration, /grant execute on function public\.get_platform_hotel_modules\(uuid\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.update_platform_hotel_module\(uuid,text,boolean\) to authenticated/i);
});

test('preserves onboarding and Sprint 50 experience-layout contracts', () => {
  const onboarding = read('supabase', 'migrations', '202608180001_50_public_experience_composition.sql');
  const migration = read(...migrationPath);
  const baselineValues = onboarding.match(
    /insert into public\.hotel_module_entitlements\(hotel_id,module_key,is_enabled,enabled_at,enabled_by\)[\s\S]*?\) baseline\(module_key\)/i
  )?.[0] || '';
  assert.match(onboarding, /'baseline_modules',12/);
  assert.doesNotMatch(baselineValues, /travel\.flights/);
  assert.doesNotMatch(migration, /hotel_experience_layout|get_public_hotel_experience_layout|experience-layout/i);
});

test('ships a rollback-only behavioral matrix for enable, disable and onboarding isolation', () => {
  const behavioral = read('supabase', 'tests', '51_travel_flights_entitlement_behavioral_matrix.sql');
  assert.match(behavioral, /(?:^|\n)begin;/i);
  assert.match(behavioral, /update_platform_hotel_module[\s\S]*?'travel\.flights',true/i);
  assert.match(behavioral, /update_platform_hotel_module[\s\S]*?'travel\.flights',false/i);
  assert.match(behavioral, /create_platform_hotel_onboarding/i);
  assert.match(behavioral, /baseline is not exactly twelve/i);
  assert.match(behavioral, /rollback;\s*$/i);
});
