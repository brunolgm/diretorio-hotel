import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const page = read('app', 'admin', 'voos', 'page.tsx');
const actions = read('app', 'admin', 'voos', 'actions.ts');
const layout = read('app', 'admin', 'voos', 'layout.tsx');
const navigation = read('lib', 'admin-navigation.ts');
const configurationMigration = read('supabase', 'migrations', '202608250002_51_flight_center_configuration.sql');
const reorderMigration = read('supabase', 'migrations', '202608250003_51_flight_center_airport_reorder.sql');
const behavioralMatrix = read('supabase', 'tests', '51_flight_center_configuration_behavioral_matrix.sql');

test('gates the route and its navigation entry with travel.flights', () => {
  assert.match(layout, /requireHotelModule\('travel\.flights'\)/);
  assert.match(navigation, /href: '\/admin\/voos'[\s\S]*moduleKey: 'travel\.flights'[\s\S]*requiredRole: 'visualizador'/);
  assert.match(page, /requireAdminAccess\('visualizador'\)/);
});

test('allows viewer reads while every mutation requires editor and entitlement', () => {
  assert.match(page, /hasMinimumRole\(profile\.normalizedRole, 'editor'\)/);
  assert.match(actions, /requireAdminAccess\('editor'\)/);
  assert.match(actions, /requireHotelModule\('travel\.flights'\)/);
  assert.equal((actions.match(/export async function/g) || []).length, 5);
  assert.doesNotMatch(page, /action=\{[^}]+\}[\s\S]{0,120}canManage\s*\?\s*false/i);
});

test('derives tenant scope on the server and never accepts a browser hotel id', () => {
  assert.doesNotMatch(actions, /formData[^\n]*hotel_id|readTrimmedString\(formData, 'hotel_id'\)|p_hotel_id/);
  assert.match(actions, /profile\.hotel_id/);
  assert.match(actions, /\.eq\('hotel_id', profile\.hotel_id\)/);
  assert.match(configurationMigration, /has_active_hotel_role\(hotel_id,'editor'\)/);
});

test('keeps the airport catalog read-only and rejects inactive or duplicate airports', () => {
  assert.match(page, /from\('airports'\)\.select\('\*'\)\.eq\('is_active', true\)/);
  assert.doesNotMatch(actions, /from\('airports'\)\.(insert|update|delete|upsert)/);
  assert.match(actions, /\.eq\('is_active', true\)\.maybeSingle\(\)/);
  assert.match(actions, /já está configurado para o hotel/);
  assert.match(configurationMigration, /primary key\(hotel_id,airport_id\)/);
  assert.doesNotMatch(configurationMigration, /grant (?:insert|update|delete)[\s\S]{0,100}public\.airports to authenticated/i);
});

test('validates UUIDs and every numeric schema bound before airport writes', () => {
  assert.match(actions, /isUuid\(airportId\)/);
  for (const maximum of [1440, 2880, 720]) {
    assert.match(actions, new RegExp(`max: ${maximum}`));
  }
  assert.match(actions, /Number\.isInteger\(value\)/);
  assert.match(actions, /length >= 20/);
});

test('reorders the complete hotel airport set atomically without transient collisions', () => {
  assert.match(actions, /rpc\('reorder_current_hotel_airports'/);
  assert.match(reorderMigration, /security definer set search_path=''/);
  assert.match(reorderMigration, /has_active_hotel_role\(current_hotel_id,'editor'\)/);
  assert.match(reorderMigration, /is_hotel_module_enabled\(current_hotel_id,'travel\.flights'\)/);
  assert.match(reorderMigration, /configured_count<>requested_count/);
  assert.match(reorderMigration, /count\(distinct requested\.id\)/);
  assert.match(reorderMigration, /set constraints public\.hotel_airports_sort_order_key deferred/);
  assert.match(reorderMigration, /unnest\(p_airport_ids\) with ordinality/);
  assert.doesNotMatch(actions, /\.update\(\{\s*sort_order[\s\S]*for\s*\(/i);
});

test('settings never enable entitlement and absent settings are created only by editor save', () => {
  assert.match(actions, /from\('hotel_flight_settings'\)/);
  assert.match(actions, /\.insert\(\{ hotel_id: profile\.hotel_id, \.\.\.payload \}\)/);
  assert.doesNotMatch(`${page}\n${actions}\n${reorderMigration}`, /(?:insert|update|upsert)[\s\S]{0,80}hotel_module_entitlements/i);
  assert.doesNotMatch(page, /from\('hotel_flight_settings'\)\.(insert|upsert|update)/);
});

test('records all changes in the existing audit system', () => {
  for (const action of [
    'flight.settings_updated',
    'flight.airport_added',
    'flight.airport_updated',
    'flight.airport_removed',
  ]) {
    assert.match(actions, new RegExp(action.replace('.', '\\.')));
  }
  assert.equal((actions.match(/recordAdminAuditEvent\(\{/g) || []).length, 4);
  assert.match(reorderMigration, /record_admin_audit_event[\s\S]*'flight\.airports_reordered'/);
});

test('adds no anonymous exposure and no public Flight Center implementation', () => {
  assert.match(reorderMigration, /revoke all on function public\.reorder_current_hotel_airports\(uuid\[\]\)[\s\S]*from public,anon,authenticated,service_role/);
  assert.match(reorderMigration, /grant execute on function public\.reorder_current_hotel_airports\(uuid\[\]\) to authenticated/);
  assert.doesNotMatch(reorderMigration, /grant execute[\s\S]{0,100}to anon/i);
  assert.doesNotMatch(`${page}\n${actions}`, /localStorage|roomToken|analytics|flight provider|airline/i);
});

test('extends the rollback-only lab matrix with viewer, atomicity and audit checks', () => {
  assert.match(behavioralMatrix, /(?:^|\n)begin;/i);
  assert.match(behavioralMatrix, /viewer could not read own hotel configuration/i);
  assert.match(behavioralMatrix, /viewer updated settings/i);
  assert.match(behavioralMatrix, /viewer reordered airports/i);
  assert.match(behavioralMatrix, /atomic reorder did not preserve unique order/i);
  assert.match(behavioralMatrix, /airport reorder audit missing/i);
  assert.match(behavioralMatrix, /anon reordered airports/i);
  assert.match(behavioralMatrix, /rollback;\s*$/i);
});
