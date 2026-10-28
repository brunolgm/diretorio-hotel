import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';

const calls: string[] = [];
let authorized = true;
let mode = 'success';
let createdId = '';
const fixture = {
  auth: async () => { calls.push('authorize'); if (!authorized) throw new Error('access denied'); return { user: { id: 'ea100000-0000-4000-8000-000000000001' } }; },
  client: () => ({ rpc: async (name: string) => {
    calls.push(name);
    if (name === 'check_platform_hotel_admin_creation') return { data: mode === 'preflight-reject' ? null : true, error: mode === 'preflight-reject' ? { message: 'platform_admin_identity_exists' } : null };
    if (mode === 'db-timeout') throw new Error('synthetic private details');
    return { data: [{ hotel_id: 'ea000000-0000-4000-8000-000000000001', admin_user_id: createdId }], error: null };
  } }),
  admin: () => ({ auth: { admin: { createUser: async (input: { app_metadata: { platform_hotel_admin: { hotel_id: string; actor_id: string; operation_id: string } } }) => {
    calls.push('auth-create');
    assert.equal(input.app_metadata.platform_hotel_admin.hotel_id, 'ea000000-0000-4000-8000-000000000001');
    assert.equal(input.app_metadata.platform_hotel_admin.actor_id, 'ea100000-0000-4000-8000-000000000001');
    assert.ok(input.app_metadata.platform_hotel_admin.operation_id);
    return mode === 'auth-conflict' ? { data: { user: null }, error: { code: 'email_exists' } } : { data: { user: { id: createdId } }, error: null };
  } } } }),
  revalidate: () => { calls.push('revalidate'); },
};
Object.assign(globalThis, { __platformAdminTest: fixture });
const stubs: Record<string, string> = {
  '@/lib/platform-auth': 'export const requirePlatformAccess = globalThis.__platformAdminTest.auth;',
  '@/lib/supabase/server': 'export const createClient = globalThis.__platformAdminTest.client;',
  '@/lib/supabase/admin': 'export const createAdminClient = globalThis.__platformAdminTest.admin;',
  'next/cache': 'export const revalidatePath = globalThis.__platformAdminTest.revalidate;',
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (stubs[specifier]) return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: new URL('../../' + specifier.slice(2) + '.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { addPlatformHotelAdminAction } = await import('../../app/platform/hoteis/[id]/admin-actions.ts');
hooks.deregister();

function form() {
  const data = new FormData();
  data.set('hotel_id', 'ea000000-0000-4000-8000-000000000001');
  data.set('full_name', 'Synthetic Admin');
  data.set('email', 'admin@example.invalid');
  data.set('password', randomUUID());
  data.set('role', 'platform_admin'); // Untrusted fields cannot select privileged roles.
  data.set('is_active', 'false');
  return data;
}
function reset(nextMode = 'success') { calls.length = 0; mode = nextMode; authorized = true; createdId = randomUUID(); }

test('server action refuses authorization before inspecting/provisioning credentials', async () => {
  reset(); authorized = false;
  await assert.rejects(addPlatformHotelAdminAction({}, form()), /access denied/);
  assert.deepEqual(calls, ['authorize']);
});
test('server action rejects malformed tenant and the existing short-password rule before any RPC/Auth call', async () => {
  for (const field of ['hotel_id', 'password']) {
    reset(); const data = form(); data.set(field, 'x');
    assert.ok((await addPlatformHotelAdminAction({}, data)).error);
    assert.deepEqual(calls, ['authorize']);
  }
});
test('server action rejects known and racing Auth conflicts without any association', async () => {
  for (const nextMode of ['preflight-reject', 'auth-conflict']) {
    reset(nextMode);
    const result = await addPlatformHotelAdminAction({}, form());
    assert.match(result.error || '', /Já existe uma identidade/);
    assert.equal(calls.includes('add_platform_hotel_admin'), false);
  }
});
test('server action success orders preflight, Auth, transactional association and cache invalidation', async () => {
  reset();
  const data = form();
  const result = await addPlatformHotelAdminAction({}, data);
  assert.ok(result.success);
  assert.deepEqual(calls, ['authorize', 'check_platform_hotel_admin_creation', 'auth-create', 'add_platform_hotel_admin', 'revalidate']);
  assert.equal(JSON.stringify(result).includes(data.get('password') as string), false);
});
test('server action loss of database response returns only reconciliation reference, without raw error or password', async () => {
  reset('db-timeout');
  const data = form(); const result = await addPlatformHotelAdminAction({}, data);
  assert.ok(result.reconciliationId);
  assert.equal(result.success, undefined);
  assert.doesNotMatch(JSON.stringify(result), /synthetic private details/);
  assert.equal(JSON.stringify(result).includes(data.get('password') as string), false);
  assert.equal(calls.includes('revalidate'), false);
});