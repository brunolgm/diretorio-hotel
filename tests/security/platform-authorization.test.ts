import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { resolveAuthenticatedDestination } from '../../lib/auth-destination.ts';
import {
  hasActivePlatformAccess,
  normalizePlatformRole,
} from '../../lib/platform-roles.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

test('accepts only an active canonical platform administrator', () => {
  assert.equal(
    hasActivePlatformAccess({ role: 'platform_admin', is_active: true }),
    true
  );
  assert.equal(
    hasActivePlatformAccess({ role: 'platform_admin', is_active: false }),
    false
  );
  assert.equal(hasActivePlatformAccess({ role: null, is_active: true }), false);
  assert.equal(normalizePlatformRole('administrador'), null);
});

test('routes platform-only identities without requiring a hotel profile', () => {
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: null,
      hasHotelAccess: false,
      hasPlatformAccess: true,
    }),
    '/platform'
  );
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: '/platform',
      hasHotelAccess: false,
      hasPlatformAccess: true,
    }),
    '/platform'
  );
});

test('preserves hotel login precedence unless platform was explicitly requested', () => {
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: null,
      hasHotelAccess: true,
      hasPlatformAccess: true,
    }),
    '/admin'
  );
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: '/platform',
      hasHotelAccess: true,
      hasPlatformAccess: true,
    }),
    '/platform'
  );
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: '/platform',
      hasHotelAccess: true,
      hasPlatformAccess: false,
    }),
    '/admin'
  );
  assert.equal(
    resolveAuthenticatedDestination({
      requestedPath: null,
      hasHotelAccess: false,
      hasPlatformAccess: false,
    }),
    '/acesso-indisponivel'
  );
});

test('keeps the platform guard independent from hotel profiles and admin authorization', () => {
  const guard = read('lib', 'platform-auth.ts');
  const layout = read('app', 'platform', 'layout.tsx');

  assert.match(guard, /auth\.getUser\(\)/);
  assert.match(guard, /rpc\('get_current_platform_access'\)/);
  assert.match(guard, /hasActivePlatformAccess/);
  assert.doesNotMatch(guard, /requireAdminAccess|getAdminHotel|from\('profiles'\)|hotel_id/);
  assert.match(layout, /requirePlatformAccess\(\)/);
  assert.doesNotMatch(layout, /requireAdminAccess|getAdminHotel/);
});

test('protects platform routing while preserving the hotel namespace', () => {
  const proxy = read('proxy.ts');
  const login = read('app', 'login', 'page.tsx');

  assert.match(proxy, /'\/platform\/:path\*'/);
  assert.match(proxy, /url\.searchParams\.set\('next', '\/platform'\)/);
  assert.match(login, /rpc\('get_current_platform_access'\)/);
  assert.match(login, /resolveAuthenticatedDestination/);
});

test('does not add platform_admin to hotel roles', () => {
  const hotelRoles = read('lib', 'app-roles.ts');
  const hotelGuard = read('lib', 'auth.ts');

  assert.doesNotMatch(hotelRoles, /platform_admin/);
  assert.doesNotMatch(hotelGuard, /platform_admin/);
});
