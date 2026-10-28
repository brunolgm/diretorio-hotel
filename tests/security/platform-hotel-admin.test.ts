import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { provisionExistingHotelAdmin } from '../../lib/platform-hotel-admin.ts';

const read = (path: string) => readFileSync(path, 'utf8');

test('preflight rejection and failure never create an identity', async () => {
  for (const check of ['conflict', 'invalid', 'throw'] as const) {
    let creates = 0;
    const result = await provisionExistingHotelAdmin({
      preflight: async () => { if (check === 'throw') throw new Error('transport'); return check; },
      createIdentity: async () => { creates++; return { userId: 'new' }; },
      associate: async () => { throw new Error('must not run'); },
    });
    assert.equal(creates, 0);
    assert.equal(result.outcome, check === 'conflict' ? 'conflict' : 'invalid');
  }
});

test('Auth conflicts, rejection and uncertain responses never associate', async () => {
  for (const outcome of ['conflict', 'invalid', 'reconcile', 'throw'] as const) {
    let associations = 0;
    const result = await provisionExistingHotelAdmin({
      preflight: async () => 'ready',
      createIdentity: async () => { if (outcome === 'throw') throw new Error('private provider error'); return outcome; },
      associate: async () => { associations++; return true; },
    });
    assert.equal(associations, 0);
    assert.equal(result.outcome, outcome === 'throw' ? 'reconcile' : outcome);
    assert.doesNotMatch(JSON.stringify(result), /private provider/);
  }
});

test('confirmed association succeeds, definitive rollback and lost responses reconcile without deletion', async () => {
  for (const db of ['success', 'rollback', 'timeout-after-commit'] as const) {
    const result = await provisionExistingHotelAdmin({
      preflight: async () => 'ready', createIdentity: async () => ({ userId: 'new' }),
      associate: async (id) => { assert.equal(id, 'new'); if (db === 'timeout-after-commit') throw new Error('network'); return db === 'success'; },
    });
    assert.equal(result.outcome, db === 'success' ? 'success' : 'reconcile');
  }
});

test('simultaneous same-email requests and retry after timeout/success fail safely', async () => {
  const identities = new Set<string>();
  const profiles = new Map<string, string>();
  async function attempt(email: string, timeout = false) {
    return provisionExistingHotelAdmin({
      preflight: async () => identities.has(email) ? 'conflict' : 'ready',
      createIdentity: async () => {
        if (identities.has(email)) return 'conflict';
        identities.add(email); return { userId: email };
      },
      associate: async (id) => { assert.equal(profiles.has(id), false); profiles.set(id, 'hotel-a'); if (timeout) throw new Error('lost response'); return true; },
    });
  }
  const simultaneous = await Promise.all([attempt('one'), attempt('one')]);
  assert.deepEqual(simultaneous.map(r => r.outcome).sort(), ['conflict', 'success']);
  assert.equal((await attempt('one')).outcome, 'conflict');
  assert.equal((await attempt('two', true)).outcome, 'reconcile');
  assert.equal((await attempt('two')).outcome, 'conflict');
  assert.equal(profiles.size, 2);
  assert.equal(identities.size, 2);
  assert.deepEqual((await Promise.all([attempt('three'), attempt('four')])).map(r => r.outcome), ['success', 'success']);
});

test('action keeps Auth Admin server-side, derives provenance from session and excludes password from returned state', () => {
  const action = read('app/platform/hoteis/[id]/admin-actions.ts');
  assert.match(action, /requirePlatformAccess\(\)/);
  assert.match(action, /password.length < 6/);
  assert.match(action, /app_metadata:.*platform_hotel_admin/);
  assert.match(action, /actor_id: user.id/);
  assert.match(action, /check_platform_hotel_admin_creation/);
  assert.match(action, /supabase.rpc\('add_platform_hotel_admin'/);
  assert.doesNotMatch(action, /console\.|deleteUser|\.from\(|formData.*role|JSON.stringify/);
  assert.doesNotMatch(action, /return[^;]*(?:password|formData|error\.message)/);
  assert.match(read('lib/supabase/admin.ts'), /import 'server-only'/);
  const form = read('app/platform/hoteis/[id]/add-admin-form.tsx');
  assert.match(form, /type="password"/);
  assert.match(form, /autoComplete="new-password"/);
  assert.match(form, /useFormStatus/);
  assert.doesNotMatch(form, /createAdminClient|supabase|console\.|analytics|localStorage|name="role"|name="is_active"/);
});

test('RPC has least privilege, trusted provenance, fixed role and transactionally controlled audit', () => {
  const sql = read('supabase/migrations/20261028100544_platform_existing_hotel_admin.sql');
  assert.match(sql, /active_platform_admin_required/);
  assert.match(sql, /for share/);
  assert.match(sql, /for update/);
  assert.match(sql, /raw_app_meta_data/);
  assert.doesNotMatch(sql, /raw_user_meta_data|delete from|insert into public.hotels|update public.hotels|insert into auth\.|update auth\.|grant .*service_role/i);
  assert.match(sql, /hotel.admin_added/);
  assert.match(sql, /'result','success'/);
  assert.match(sql, /record_platform_audit_event/);
  assert.match(sql, /security definer set search_path=''/);
  assert.match(sql, /from public,anon,authenticated,service_role/);
  assert.match(sql, /to authenticated/);
});