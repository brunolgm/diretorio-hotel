import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MODULE_CATALOG, BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';

const path = 'supabase/migrations/20261028012744_52_2_tourism_governance_available.sql';
const sql = readFileSync(path, 'utf8');
const previous = readFileSync('supabase/migrations/202608250001_51_travel_flights_entitlement.sql', 'utf8');
const rpc = (source: string) => source.match(/create or replace function public\.update_platform_hotel_module\([\s\S]*?end;\s*\$\$;/)?.[0].replace(/\r/g, '');

test('new governance migration changes only the Tourism availability exclusion in the reviewed RPC', () => {
  assert.equal(rpc(sql), rpc(previous)?.replace("'fb.menu','content.tourism','analytics.advanced'", "'fb.menu','analytics.advanced'"));
  assert.doesNotMatch(sql.replace(/\r/g, '').replace(rpc(sql)!, ''), /(?:insert into|update|delete from|alter table|create table) public\./i);
  assert.match(sql, /CREATE OR REPLACE preserves/);
  assert.match(sql, /has_function_privilege\('anon'/);
  assert.match(sql, /has_function_privilege\('service_role'/);
});

test('Tourism becomes opt-in available without changing any other module or onboarding default', () => {
  const before = execFileSync('git', ['show', '91634a4:lib/modules/catalog.ts'], { encoding: 'utf8' });
  const after = readFileSync('lib/modules/catalog.ts', 'utf8');
  const restore = after.replace(/\{ key: 'content.tourism'[^\n]+/, before.match(/\{ key: 'content.tourism'[^\r\n]+/)![0]);
  assert.equal(restore.replace(/\r/g, ''), before.replace(/\r/g, ''));
  assert.equal(MODULE_CATALOG.find((m) => m.key === 'content.tourism')?.availability, 'available');
  assert.equal(BASELINE_MODULE_KEYS.length, 12);
  assert.ok(!(BASELINE_MODULE_KEYS as readonly string[]).includes('content.tourism'));
  const blocked = rpc(sql)!.match(/if p_enabled and p_module_key in\(([^)]*)\)/)![1];
  assert.deepEqual([...blocked.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(), MODULE_CATALOG.filter((m) => m.availability === 'coming_soon').map((m) => m.key).sort());
  assert.match(sql, /active_platform_admin_required/);
  assert.match(sql, /record_platform_audit_event/);
});

test('existing migrations remain unchanged and the current historical SQL checks retain safeguards', () => {
  assert.equal(execFileSync('git', ['diff', '--name-only', '--', 'supabase/migrations'], { encoding: 'utf8' }).trim(), '');
  const onboarding = readFileSync('supabase/tests/47_multi_hotel_onboarding_rls_verification.sql', 'utf8');
  assert.match(onboarding, /experience\.navigation/);
  assert.match(onboarding, /travel\.flights/);
  assert.match(onboarding, /content\\\.tourism/);
  assert.match(onboarding, /twelve-module/);
});
