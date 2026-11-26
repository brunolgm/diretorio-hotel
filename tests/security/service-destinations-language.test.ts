import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { getServiceDestination } = await import('../../lib/service-destinations.ts');

const service = {id: 'room-service', content: 'Room Service description. '.repeat(5), url: '', service_action_type: 'external_url' as const};

for (const language of ['pt', 'en', 'es'] as const) {
  test(`Bugan SmartMenu CTA carries ${language} without losing query, hash or link behavior`, () => {
    for (const url of [
      'https://buganrecife.libguest.digital/room-service',
      'https://buganrecife.guestdesk.digital/room-service/?lang=pt&lang=es&source=services#menu',
      'https://libguest.digital/hotel/bugan-recife/room-service?source=services#menu',
      'https://guestdesk.digital/hotel/bugan-recife/room-service/',
    ]) for (const service_action_type of ['external_url', 'standard'] as const) {
      const section = {...service, url, service_action_type};
      const before = JSON.stringify(section);
      const destination = getServiceDestination(section, 'bugan-recife', language)!;
      const original = new URL(url), result = new URL(destination.href);
      assert.equal(result.origin + result.pathname, original.origin + original.pathname);
      assert.deepEqual(result.searchParams.getAll('lang'), [language]);
      assert.equal(result.searchParams.get('source'), original.searchParams.get('source'));
      assert.equal(result.hash, original.hash);
      assert.equal(destination.isExternal, true);
      assert.equal(JSON.stringify(section), before);
    }
  });

  test(`other hotels, Filipe and external destinations are unchanged in ${language}`, () => {
    for (const url of [
      'https://hotel-bugan.goomer.app/menu',
      'https://buganrecife.libguest.digital/explorar/cardapio',
      'https://buganrecife.libguest.digital/servicos/filipe',
      'https://grandmercureriocopacabana.libguest.digital/room-service',
      'https://libguest.digital/hotel/another-hotel/room-service',
      'https://buganrecife.libguest.digital.evil.test/room-service',
      'https://other.test/room-service', '/room-service', 'invalid',
    ]) assert.equal(getServiceDestination({...service, url}, 'bugan-recife', language)?.href, url);
    const url = 'https://buganrecife.libguest.digital/room-service';
    for (const slug of ['grandmercureriocopacabana', 'novotelrioleme', 'novotelrv', 'mercurerioboutiquecopacabana']) {
      assert.equal(getServiceDestination({...service, url}, slug, language)?.href, url);
    }
    const roomMenu = getServiceDestination({...service, url: null, service_action_type: 'room_restaurant_menu'}, 'bugan-recife', language)!;
    assert.equal(roomMenu.href, '/hotel/bugan-recife/servicos/room-service' + (language === 'pt' ? '' : `?lang=${language}`));
    assert.equal(roomMenu.isExternal, false);
  });
}
