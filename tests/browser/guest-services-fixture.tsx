import { roomServiceAccess } from '../../lib/fb/room-service-access';
import { createRoot } from 'react-dom/client';
import { HotelPublicAreaContent } from '../../components/public/hotel-public-area-content';
import { GuestServiceFields } from '../../components/admin/guest-service-fields';
import { guestServicesFixture } from '../fixtures/guest-services';
import type { DomainContext } from '../../lib/domain-context';

const params = new URLSearchParams(location.search);
const language = (params.get('lang') || 'pt') as 'pt' | 'en' | 'es';
const data = guestServicesFixture(Number(params.get('hotel') || 4), language, params.has('volume'));
const domain = { kind: 'localhost', isPotentialHotelSubdomain: false, shouldUseSlugFallback: true, productRootDomain: 'libguest.digital', hostname: '127.0.0.1' } as DomainContext;
Object.assign(window, { fixtureRoomServiceHref: roomServiceAccess(data, language, domain, false)?.href });
data.sections.push({ ...data.sections[4], id: 'foreign', hotel_id: 'other', title: 'FOREIGN MUST NOT SHOW' });
const area = (params.get('area') || 'servicos') as 'servicos' | 'informacoes';
createRoot(document.getElementById('root')!).render(params.has('admin') ? <main className="admin-theme mx-auto max-w-5xl p-6"><h1 className="mb-6 text-2xl">Apresentação dos serviços · fixture local</h1><form><GuestServiceFields initial={data.sections[4].guest_presentation} title={data.sections[4].title} content={data.sections[4].content} icon={data.sections[4].icon} themePreset={data.hotel.theme_preset} /></form></main> : <HotelPublicAreaContent pageData={data} area={area} language={language} domainContext={domain} preferSubdomainRoot={false} />);
