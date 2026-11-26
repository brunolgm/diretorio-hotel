import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuestServiceCatalog } from '../../lib/guest-service-catalog.ts';
import { parseGuestServicePresentation, readGuestServicePresentation } from '../../lib/guest-service-presentation.ts';
import { guestServicesFixture } from '../fixtures/guest-services.ts';
import { roomServiceAccess } from '../../lib/fb/room-service-access.ts';
import type { DomainContext } from '../../lib/domain-context';

const domain = { kind: 'localhost', hostname: 'localhost', productRootDomain: 'libguest.digital', shouldUseSlugFallback: true } as DomainContext;
test('five tenant identities, three languages: eight service entries, preserved records and native canonical destination', () => {
  for (let i = 0; i < 5; i++) for (const lang of ['pt', 'en', 'es'] as const) {
    const data = guestServicesFixture(i, lang), before = JSON.stringify(data);
    const catalog = getGuestServiceCatalog(data, lang, domain, false), services = catalog.filter(s => s.area === 'services');
    assert.equal(services.length, 8, `${i}/${lang}`);
    assert.equal(services.filter(s => s.title === 'Room Service').length, 1);
    assert.equal(services.find(s => s.title === 'Room Service')?.href, roomServiceAccess(data, lang, domain, false)?.href);
    assert.equal(catalog.filter(s => s.area === 'dining').length, 1);
    assert.equal(JSON.stringify(data), before);
  }
});
test('foreign/disabled rows excluded and high-volume tenant retains every additional category', () => {
  const data = guestServicesFixture(0, 'pt', true);
  data.sections.push({ ...data.sections[4], hotel_id: 'foreign', id: 'foreign' }, { ...data.sections[4], id: 'disabled', enabled: false });
  const catalog = getGuestServiceCatalog(data, 'pt', domain, false);
  assert.equal(catalog.filter(s => s.area === 'services').length, 48);
  assert.ok(!catalog.some(s => ['foreign', 'disabled'].includes(s.id)));
});
test('external-only hotel preserves Goomer and QR-specific actions remain dedicated', () => {
  const data = guestServicesFixture(); data.fb = null; data.sections.pop();
  let catalog = getGuestServiceCatalog(data, 'es', domain, false);
  assert.equal(catalog.find(s => s.icon === 'ConciergeBell')?.href, 'https://hotel-bugan.goomer.app/menu');
  data.sections[3].service_action_type = 'room_restaurant_menu';
  data.sections[3].url = null;
  catalog = getGuestServiceCatalog(data, 'es', domain, false);
  assert.equal(catalog.find(s => s.id === data.sections[3].id)?.interaction, 'page');
  assert.match(catalog.find(s => s.id === data.sections[3].id)?.href || '', /lang=es/);
});
test('short factual content is inline; guides retain their deep links; configured detail keeps full text', () => {
  const data = guestServicesFixture();
  data.serviceGuides = [{ serviceId: data.sections[5].id, category: 'tv' }];
  const catalog = getGuestServiceCatalog(data, 'pt', domain, false);
  assert.equal(catalog.find(s => s.id === data.sections[5].id)?.interaction, 'page');
  assert.equal(catalog.find(s => s.id === data.sections[7].id)?.interaction, 'inline');
  assert.equal(catalog.find(s => s.id === data.sections[4].id)?.content, data.sections[4].content);
});
test('presentation input is bounded and cannot supply operational URLs, authorization or another tenant', () => {
  assert.deepEqual(parseGuestServicePresentation({ area: 'invalid', interaction: 'order', url: 'https://evil.invalid', hotel_id: 'other' }), {});
  const form = new FormData(); form.set('guest_area', 'information'); form.set('guest_summary_pt', 'Resumo');
  assert.deepEqual(readGuestServicePresentation(form), { area: 'information', summary: { pt: 'Resumo' }, hours: {}, location: {}, conditions: {} });
});
