import assert from 'node:assert/strict';
import test from 'node:test';
import {
  provisionAuthUserWithProfile,
  updateProfileThenAuth,
} from '../../lib/security/user-consistency.ts';

test('calls Auth compensation when profile creation fails', async () => {
  const calls: string[] = [];
  const result = await provisionAuthUserWithProfile({
    createAuthUser: async () => ({ ok: true, value: { userId: 'synthetic-user' } }),
    createProfile: async () => ({ ok: false, error: 'profile failure' }),
    deleteAuthUser: async (userId) => {
      calls.push(userId);
      return { ok: true, value: undefined };
    },
  });

  assert.deepEqual(calls, ['synthetic-user']);
  assert.equal(result.ok, false);
  if (!result.ok && result.stage === 'profile') assert.equal(result.compensated, true);
});

test('reports a failed Auth rollback instead of returning partial success', async () => {
  const result = await provisionAuthUserWithProfile({
    createAuthUser: async () => ({ ok: true, value: { userId: 'synthetic-user' } }),
    createProfile: async () => ({ ok: false, error: 'profile failure' }),
    deleteAuthUser: async () => ({ ok: false, error: 'rollback failure' }),
  });
  assert.equal(result.ok, false);
  if (!result.ok && result.stage === 'profile') assert.equal(result.compensated, false);
});

test('restores the profile when the subsequent Auth update fails', async () => {
  let restored = false;
  const result = await updateProfileThenAuth({
    updateProfile: async () => ({ ok: true, value: undefined }),
    updateAuth: async () => ({ ok: false, error: 'auth failure' }),
    restoreProfile: async () => {
      restored = true;
      return { ok: true, value: undefined };
    },
  });
  assert.equal(restored, true);
  assert.equal(result.ok, false);
  if (!result.ok && result.stage === 'auth') assert.equal(result.compensated, true);
});
