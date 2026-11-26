import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuestServiceCatalog, guestServiceArea } from '../../lib/guest-service-catalog.ts';
import { guestServiceGroup, guestServicePresentationFits, guestServiceInteraction, parseGuestServicePresentation, readGuestServicePresentation } from '../../lib/guest-service-presentation.ts';
import { guestServicesFixture } from '../fixtures/guest-services.ts';
import { roomServiceAccess } from '../../lib/fb/room-service-access.ts';
import type { DomainContext } from '../../lib/domain-context';

const domain = { kind: 'localhost', hostname: 'localhost', productRootDomain: 'libguest.digital', shouldUseSlugFallback: true } as DomainContext;
test('existing stay and parking groups localize consistently without swallowing neighborhood categories or explicit configuration', () => {
  assert.equal(guestServiceGroup({category:'Transporte e estacionamento',icon:null},'en'),'Getting around');
  assert.equal(guestServiceGroup({category:'Serviços da estadia',icon:null},'en'),'Comfort and convenience');
  assert.equal(guestServiceGroup({category:'Lazer e bem-estar',icon:null},'es'),'Ocio y bienestar');
  assert.equal(guestServiceGroup({category:'Serviços do bairro',icon:null},'pt'),'Serviços do bairro');
  assert.equal(guestServiceGroup({category:'No apartamento',icon:null,guest_presentation:{group:'original'}},'pt'),'No apartamento');
  assert.equal(guestServiceGroup({title:'Estacionamento',category:'Estrutura',icon:'Hotel'},'pt'),'Mobilidade');
  assert.equal(guestServiceGroup({title:'Programa de Fidelidade - All',category:'Utilidades',icon:'Package'},'pt'),'Conforto e conveniência');
  assert.equal(guestServiceArea({title:'Siga-nos no Instagram!',icon:'Globe',guest_presentation:null}),'contact');
  assert.equal(guestServiceArea({title:'Conheça o hotel',icon:'Hotel',guest_presentation:null}),'hotel');
});
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
  const data = guestServicesFixture(); data.fb = null; data.sections.pop(); data.sections[3].url = 'https://hotel-bugan.goomer.app/menu';
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


test('provider alternatives are distinct; exact destinations combine without losing source IDs or editorial text', () => {
  const data = guestServicesFixture();
  const legacy = { ...data.sections[3], id: 'goomer', url: 'https://hotel-bugan.goomer.app/menu', content: 'Goomer legacy instructions' };
  const twin = { ...legacy, id: 'goomer-copy', content: 'Additional operating conditions' };
  const thex = { ...legacy, id: 'thex', url: 'https://example.invalid/thex?outlet=2' };
  data.sections.push(legacy, twin, thex);
  const items = getGuestServiceCatalog(data, 'pt', domain, false).filter(i => i.icon === 'ConciergeBell');
  assert.equal(items.length, 3);
  const goomer = items.find(i => i.href === legacy.url)!;
  assert.deepEqual(goomer.sourceIds, ['goomer', 'goomer-copy']);
  assert.ok(goomer.relatedContent?.some(c => c.content === twin.content));
  assert.equal(items.find(i => i.sourceIds?.includes('thex'))?.href, thex.url);
});

test('text similarity alone never reroutes a provider or an unrelated informative service', () => {
  const data = guestServicesFixture(); data.fb!.service_links = [];
  data.sections[3].url = 'https://external.invalid/room-service';
  data.sections.pop();
  const items = getGuestServiceCatalog(data, 'en', domain, false);
  assert.ok(items.some(i => i.href === data.sections[3].url && i.isExternal));
  assert.ok(items.some(i => i.id === 'native-room-service'));
  data.sections[3].url = 'https://other.libguest.digital/room-service';
  assert.ok(getGuestServiceCatalog(data, 'pt', domain, false).some(i => i.href === data.sections[3].url));
});

test('all dining editorial remains represented even when no F&B link exists', () => {
  const data = guestServicesFixture(); data.fb!.service_links = [];
  const dining = getGuestServiceCatalog(data, 'pt', domain, false).filter(i => i.area === 'dining');
  assert.ok(dining.some(i => i.id === data.sections[2].id && i.content === data.sections[2].content));
});


test('presentation contract covers all Admin modes without changing operational admission', () => {
  const section={content:'Full service instructions',service_action_type:'standard'};
  const destination={href:'https://example.invalid/channel',isExternal:true};
  for(const mode of ['inline','detail','page','external','guide','assistance'] as const){
    const expected=mode==='inline'?'inline':mode==='detail'||mode==='assistance'?'detail':'page';
    assert.equal(guestServiceInteraction({interaction:mode},section,destination,false,null),expected);
    assert.equal(guestServiceInteraction({interaction:mode},section,{href:'/dedicated-guide',isExternal:false},true,null),'page');
  }
  assert.equal(guestServiceInteraction({interaction:'page'},section,null,false,null),'inline');
});

test('combined metadata byte limit is checked before administrative writes, including multibyte texts', () => {
  assert.ok(guestServicePresentationFits({summary:{pt:'Resumo'}}));
  assert.equal(guestServicePresentationFits({conditions:{pt:'😀'.repeat(4000),en:'😀'.repeat(4000)}}),false);
});

test('synthetic room admission changes only the existing CTA, preserving canonical route and language', () => {
  const data=guestServicesFixture(), outlet=data.fb!.outlets.find(o=>o.type==='room_service')!;
  data.ordering={outlets:[{id:outlet.id,available:true,hidden:false,pickup:false,room_delivery:true,products:[{available:true}]}],has_room_context:false} as unknown as NonNullable<typeof data.ordering>;
  const without=roomServiceAccess(data,'es',domain,false)!;
  data.ordering.has_room_context=true;
  const withRoom=roomServiceAccess(data,'es',domain,false)!;
  assert.equal(withRoom.href,without.href);assert.match(withRoom.href,/room-service.*lang=es/);
  assert.equal(without.cta,'Consultar menú');assert.equal(withRoom.cta,'Hacer pedido');
});


test('an explicit F&B relationship does not consume a provider URL or a room-specific integration', () => {
  const data=guestServicesFixture();data.sections.pop();data.sections[3].url='https://hotel-bugan.goomer.app/menu';
  let items=getGuestServiceCatalog(data,'pt',domain,false);
  assert.ok(items.some(i=>i.href===data.sections[3].url&&i.isExternal));
  assert.ok(items.some(i=>i.id==='native-room-service'));
  data.sections[3].url=null;data.sections[3].service_action_type='room_restaurant_menu';
  items=getGuestServiceCatalog(data,'pt',domain,false);
  assert.ok(items.some(i=>i.id===data.sections[3].id&&i.href?.includes('/servicos/')));
  assert.ok(items.some(i=>i.id==='native-room-service'));
});


test('explicit editorial areas are respected while keeping a single main native access in Services', () => {
  const data=guestServicesFixture();data.sections.pop();data.sections[3].guest_presentation={area:'information',interaction:'inline'};
  const items=getGuestServiceCatalog(data,'pt',domain,false);
  assert.ok(items.some(i=>i.id===data.sections[3].id&&i.area==='information'&&i.interaction==='page'));
  assert.equal(items.filter(i=>i.icon==='ConciergeBell'&&i.area==='services').length,1);
});


test('absolute placeholder origins and custom ports remain distinct configured channels', () => {
  const data=guestServicesFixture();data.sections.pop();data.fb!.service_links=[];
  for(const url of ['https://guest.invalid/room-service',`https://${data.hotel.subdomain}.libguest.digital:8443/room-service`]){
    data.sections[3].url=url;
    const items=getGuestServiceCatalog(data,'pt',domain,false);
    assert.ok(items.some(i=>i.id===data.sections[3].id&&i.href===url&&i.isExternal));
    assert.ok(items.some(i=>i.id==='native-room-service'));
  }
});
