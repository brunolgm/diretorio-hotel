import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';
import type { Database } from '../../types/database.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '202608250002_51_flight_center_configuration.sql');

test('creates only the three minimal Sprint 51 configuration entities', () => {
  for (const table of ['airports', 'hotel_airports', 'hotel_flight_settings']) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.doesNotMatch(migration, /create table public\.airline_official_links/i);
  assert.doesNotMatch(migration, /insert into public\.(airports|hotel_airports|hotel_flight_settings)/i);
});

test('keeps global airport writes server-only and exposes no anonymous table reads', () => {
  assert.match(migration, /revoke all on table public\.airports from public,anon,authenticated,service_role/i);
  assert.match(migration, /grant select,insert,update on table public\.airports to service_role/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[\s\S]{0,100}public\.airports to authenticated/i);
  assert.doesNotMatch(migration, /grant select[\s\S]{0,100}to anon/i);
  assert.match(migration, /51_hotel_read_active_airports[\s\S]*?travel\.flights/i);
});

test('gates all hotel-scoped configuration policies by role, hotel and entitlement', () => {
  for (const table of ['hotel_airports', 'hotel_flight_settings']) {
    const tablePolicies = migration.match(
      new RegExp(`create policy [\\s\\S]*? on public\\.${table}[\\s\\S]*?(?=create policy|grant select)`, 'gi')
    ) || [];
    assert.ok(tablePolicies.length >= 4);
    assert.ok(tablePolicies.every((policy) => /has_active_hotel_role/.test(policy)));
    assert.ok(tablePolicies.every((policy) => /travel\.flights/.test(policy)));
  }
  assert.match(migration, /exists\(select 1 from public\.airports a where a\.id=airport_id and a\.is_active\)/i);
});

test('enforces deterministic airport ordering and one settings row per hotel', () => {
  assert.match(migration, /primary key\(hotel_id,airport_id\)/i);
  assert.match(migration, /unique\(hotel_id,sort_order\) deferrable initially deferred/i);
  assert.match(migration, /sort_order between 1 and 20/i);
  assert.match(migration, /hotel_id uuid primary key references public\.hotels\(id\) on delete cascade/i);
});

test('keeps settings separate from entitlement and preserves the twelve-module baseline', () => {
  assert.equal(BASELINE_MODULE_KEYS.length, 12);
  assert.equal((BASELINE_MODULE_KEYS as readonly string[]).includes('travel.flights'), false);
  assert.doesNotMatch(migration, /insert into public\.hotel_module_entitlements/i);
  assert.doesNotMatch(migration, /update public\.hotel_module_entitlements/i);
  assert.doesNotMatch(migration, /create or replace function public\.is_hotel_module_enabled/i);
});

test('updates the structured database contract for all three entities', () => {
  type Tables = Database['public']['Tables'];
  const airport: Tables['airports']['Insert'] = {
    iata_code: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', country_code: 'BR',
    timezone: 'America/Sao_Paulo', latitude: -22.81, longitude: -43.25,
  };
  const hotelAirport: Tables['hotel_airports']['Insert'] = {
    hotel_id: 'hotel-id', airport_id: 'airport-id', sort_order: 1,
  };
  const settings: Tables['hotel_flight_settings']['Insert'] = { hotel_id: 'hotel-id' };
  assert.equal(airport.iata_code, 'GIG');
  assert.equal(hotelAirport.sort_order, 1);
  assert.equal(settings.hotel_id, 'hotel-id');
});

test('ships a rollback-only lab matrix covering tenant isolation and grants', () => {
  const behavioral = read('supabase', 'tests', '51_flight_center_configuration_behavioral_matrix.sql');
  assert.match(behavioral, /(?:^|\n)begin;/i);
  assert.match(behavioral, /hotel A read hotel B configuration/i);
  assert.match(behavioral, /hotel A wrote hotel B settings/i);
  assert.match(behavioral, /server could not manage global airport/i);
  assert.match(behavioral, /settings enabled travel\.flights/i);
  assert.match(behavioral, /duplicate hotel airport accepted/i);
  assert.match(behavioral, /duplicate sort order accepted/i);
  assert.match(behavioral, /duplicate 1:1 settings accepted/i);
  assert.match(behavioral, /anon read airports/i);
  assert.match(behavioral, /rollback;\s*$/i);
});

test('does not touch roomToken, public experience, analytics or Sprint 50 composition', () => {
  assert.doesNotMatch(migration, /room[_]?token|hotel_room_links|analytics|hotel_experience_layout/i);
  for (const forbiddenPath of [
    ['lib', 'room-context.ts'],
    ['lib', 'room-links.ts'],
    ['lib', 'public-routes.ts'],
    ['lib', 'experience-layout.ts'],
  ]) {
    assert.ok(read(...forbiddenPath).length > 0);
  }
});
