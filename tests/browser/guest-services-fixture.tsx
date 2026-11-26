import reconciliation from '../../docs/bootstrap/guest-service-editorial-reconciliation-20261126.json';
import { roomServiceAccess } from '../../lib/fb/room-service-access';
import { createRoot } from 'react-dom/client';
import { HotelPublicAreaContent } from '../../components/public/hotel-public-area-content';
import { GuestServiceFields } from '../../components/admin/guest-service-fields';
import { guestServicesFixture } from '../fixtures/guest-services';
import type { DomainContext } from '../../lib/domain-context';

const params = new URLSearchParams(location.search);
const language = (params.get('lang') || 'pt') as 'pt' | 'en' | 'es';
const data = guestServicesFixture(Number(params.get('hotel') || 4), language, params.has('volume'));
if (params.has('metadata')) {
  const names = ['Grand Mercure Rio de Janeiro Copacabana', 'Novotel Rio de Janeiro Leme', 'Novotel Salvador', 'Mercure Rio Boutique Copacabana', 'Bugan Recife'];
  const index = Number(params.get('hotel') || 4);
  data.hotel.name = names[index];
  if (index === 1) data.hotel.theme_preset = 'deep-ocean';
  data.fb = null;
  data.sections = reconciliation.records.filter(r => r.hotel === names[index]).map((r, i) => ({ id: 'metadata-'+index+'-'+i, hotel_id: data.hotel.id, title: r.title, category: r.category, icon: r.icon, content: (r.content_length ?? 0) > 110 ? ('Descrição sintética para validação local. ' + 'Conteúdo de teste. '.repeat(Math.ceil((r.content_length ?? 0)/18))).slice(0,r.content_length ?? 0) : 'Descrição sintética para validação local.', enabled: true, service_action_type: 'standard' as const, url: null, cta: null, sort_order: i, created_at: null, updated_at: null }));
}
const domain = { kind: 'localhost', isPotentialHotelSubdomain: false, shouldUseSlugFallback: true, productRootDomain: 'libguest.digital', hostname: '127.0.0.1' } as DomainContext;
Object.assign(window, { fixtureRoomServiceHref: roomServiceAccess(data, language, domain, false)?.href });
if (!params.has('metadata')) data.sections.push({ ...data.sections[4], id: 'foreign', hotel_id: 'other', title: 'FOREIGN MUST NOT SHOW' });
const area = (params.get('area') || 'servicos') as 'servicos' | 'informacoes' | 'cardapio';
if(params.has('supplement')) data.fb!.service_links = [];
createRoot(document.getElementById('root')!).render(params.has('admin') ? <main className="admin-theme mx-auto max-w-5xl p-6"><h1 className="mb-6 text-2xl">Apresentação dos serviços · fixture local</h1><form><label>Título<input name="title" defaultValue={data.sections[4].title} /></label><input type="hidden" name="content" value={data.sections[4].content || ''} /><input type="hidden" name="icon" value={data.sections[4].icon || ''} /><input type="hidden" name="url" value="https://example.invalid/configured-channel" /><input type="hidden" name="service_action_type" value="standard" /><GuestServiceFields initial={data.sections[4].guest_presentation} title={data.sections[4].title} content={data.sections[4].content} icon={data.sections[4].icon} themePreset={data.hotel.theme_preset} hasGuide={params.has('guidePreview')} internalHref={'/hotel/'+data.hotel.slug+'/servicos/'+data.sections[4].id} /></form></main> : <>{params.has('metadata') ? <p className="bg-slate-100 p-3 text-center text-sm">Prévia V4 local: títulos e categorias reais; descrições sintéticas.</p> : null}<HotelPublicAreaContent pageData={data} area={area} language={language} domainContext={domain} preferSubdomainRoot={false} /></>);
