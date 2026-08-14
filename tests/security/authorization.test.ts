import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessHotelResource, hasMinimumRole } from '../../lib/app-roles.ts';
import { isRoomToken, isUuid } from '../../lib/security/identifiers.ts';

const HOTEL_A = '10000000-0000-4000-8000-000000000001';
const HOTEL_B = '10000000-0000-4000-8000-000000000002';

test('applies role hierarchy without granting admin operations to editors', () => {
  assert.equal(hasMinimumRole('administrador', 'editor'), true);
  assert.equal(hasMinimumRole('editor', 'administrador'), false);
  assert.equal(hasMinimumRole('visualizador', 'operador'), false);
});

test('allows hotel A and rejects the same valid resource ID from hotel B', () => {
  assert.equal(
    canAccessHotelResource({ role: 'administrador', requiredRole: 'administrador', userHotelId: HOTEL_A, resourceHotelId: HOTEL_A }),
    true
  );
  assert.equal(
    canAccessHotelResource({ role: 'administrador', requiredRole: 'administrador', userHotelId: HOTEL_A, resourceHotelId: HOTEL_B }),
    false
  );
  assert.equal(
    canAccessHotelResource({ role: 'editor', requiredRole: 'administrador', userHotelId: HOTEL_A, resourceHotelId: HOTEL_A }),
    false
  );
  assert.equal(
    canAccessHotelResource({ role: 'administrador', requiredRole: 'administrador', userHotelId: null, resourceHotelId: HOTEL_A }),
    false
  );
  assert.equal(
    canAccessHotelResource({ role: null, requiredRole: 'visualizador', userHotelId: HOTEL_A, resourceHotelId: HOTEL_A }),
    false
  );
});

test('room-link administration requires editor access in the same hotel', () => {
  assert.equal(
    canAccessHotelResource({ role: 'visualizador', requiredRole: 'editor', userHotelId: HOTEL_A, resourceHotelId: HOTEL_A }),
    false
  );
  assert.equal(
    canAccessHotelResource({ role: 'editor', requiredRole: 'editor', userHotelId: HOTEL_A, resourceHotelId: HOTEL_A }),
    true
  );
  assert.equal(
    canAccessHotelResource({ role: 'editor', requiredRole: 'editor', userHotelId: HOTEL_A, resourceHotelId: HOTEL_B }),
    false
  );
});

test('validates synthetic UUIDs and room-token format', () => {
  assert.equal(isUuid(HOTEL_A), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isRoomToken('AbCdEfGhIjKlMnOpQrStUvWx'), true);
  assert.equal(isRoomToken('short-token'), false);
  assert.equal(isRoomToken('AbCdEfGhIjKlMnOpQrStUvW!'), false);
});
