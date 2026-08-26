import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_LIMITS,
  validateAnalyticsPayload,
} from '../../lib/analytics.ts';
import { isJsonContentType, readUtf8BodyWithLimit } from '../../lib/security/http.ts';

const HOTEL_SLUG = 'hotel-a-fixture';
const DEPARTMENT_ID = '20000000-0000-4000-8000-000000000001';

test('accepts an official website_click payload', () => {
  const result = validateAnalyticsPayload({
    hotelSlug: HOTEL_SLUG,
    eventType: 'website_click',
    language: 'pt',
  });

  assert.equal(result.ok, true);
});

test('accepts only the closed Flight Center event and service-action catalogs', () => {
  for (const eventType of [
    'flight_center_view', 'flight_saved', 'flight_removed', 'flight_official_link_click',
    'flight_calendar_download', 'flight_route_open',
  ]) {
    assert.equal(validateAnalyticsPayload({ hotelSlug: HOTEL_SLUG, eventType, language: 'pt' }).ok, true);
  }
  for (const action of ['transfer', 'wake_up', 'breakfast_box', 'reception']) {
    assert.equal(validateAnalyticsPayload({
      hotelSlug: HOTEL_SLUG,
      eventType: 'flight_service_action',
      language: 'en',
      action,
    }).ok, true);
  }
  assert.equal(validateAnalyticsPayload({
    hotelSlug: HOTEL_SLUG,
    eventType: 'flight_service_action',
    language: 'pt',
  }).ok, false);
  assert.equal(validateAnalyticsPayload({
    hotelSlug: HOTEL_SLUG,
    eventType: 'flight_service_action',
    language: 'pt',
    action: 'other',
  }).ok, false);
  assert.equal(validateAnalyticsPayload({
    hotelSlug: HOTEL_SLUG,
    eventType: 'flight_saved',
    language: 'pt',
    action: 'transfer',
  }).ok, false);
});

test('rejects every itinerary, guest and room field from the real payload shape', () => {
  const sensitiveFields = {
    flightNumber: '3910', airlineCode: 'LA', airlineName: 'Airline',
    departureAirport: 'GIG', arrivalAirport: 'REC', departureDate: '2026-08-27',
    scheduledDepartureTime: '19:40', roomToken: 'secret', room: '101', guest: 'Guest',
    confirmation: 'ABC123',
  };
  for (const [key, value] of Object.entries(sensitiveFields)) {
    const result = validateAnalyticsPayload({
      hotelSlug: HOTEL_SLUG,
      eventType: 'flight_saved',
      language: 'pt',
      [key]: value,
    });
    assert.equal(result.ok, false, `sensitive analytics key accepted: ${key}`);
  }
  const valid = validateAnalyticsPayload({ hotelSlug: HOTEL_SLUG, eventType: 'flight_saved', language: 'es' });
  assert.equal(valid.ok, true);
  if (valid.ok) assert.deepEqual(Object.keys(valid.value).sort(), [
    'action', 'departmentId', 'eventType', 'hotelSlug', 'language', 'serviceId',
  ]);
});

test('rejects legacy events and unknown hotelId fields', () => {
  assert.equal(
    validateAnalyticsPayload({ hotelSlug: HOTEL_SLUG, eventType: 'banner_click', language: 'pt' }).ok,
    false
  );
  assert.equal(
    validateAnalyticsPayload({
      hotelId: '10000000-0000-4000-8000-000000000001',
      hotelSlug: HOTEL_SLUG,
      eventType: 'page_view',
      language: 'pt',
    }).ok,
    false
  );
});

test('rejects deep metadata, unexpected fields and inconsistent department usage', () => {
  const base = { hotelSlug: HOTEL_SLUG, eventType: 'page_view', language: 'pt' };
  assert.equal(validateAnalyticsPayload({ ...base, metadata: { label: { nested: true } } }).ok, false);
  assert.equal(validateAnalyticsPayload({ ...base, targetUrl: 'https://example.test/?reservation=secret' }).ok, false);
  assert.equal(validateAnalyticsPayload({ ...base, sessionId: 'visitor-identifier' }).ok, false);
  assert.equal(validateAnalyticsPayload({ ...base, unexpected: true }).ok, false);
  assert.equal(validateAnalyticsPayload({ ...base, departmentId: DEPARTMENT_ID }).ok, false);
  assert.equal(
    validateAnalyticsPayload({
      hotelSlug: HOTEL_SLUG,
      eventType: 'department_click',
      language: 'pt',
    }).ok,
    false
  );
});

test('accepts a service view only with one validated service id', () => {
  assert.equal(validateAnalyticsPayload({
    hotelSlug: HOTEL_SLUG,
    eventType: 'service_view',
    language: 'en',
    serviceId: DEPARTMENT_ID,
  }).ok, true);
  assert.equal(validateAnalyticsPayload({ hotelSlug: HOTEL_SLUG, eventType: 'service_view', language: 'en' }).ok, false);
  assert.equal(validateAnalyticsPayload({ ...({ hotelSlug: HOTEL_SLUG, eventType: 'page_view', language: 'pt' }), serviceId: DEPARTMENT_ID }).ok, false);
});

test('rejects oversized bodies before JSON parsing', async () => {
  const request = new Request('https://example.test/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(ANALYTICS_LIMITS.bodyBytes + 1),
  });
  const result = await readUtf8BodyWithLimit(request, ANALYTICS_LIMITS.bodyBytes);
  assert.deepEqual(result, { ok: false, reason: 'too_large' });
});

test('recognizes only JSON content types', () => {
  assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
  assert.equal(isJsonContentType('text/plain'), false);
  assert.equal(isJsonContentType(null), false);
});
