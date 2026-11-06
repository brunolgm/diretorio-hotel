import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fbFixture } from '../fixtures/fb';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider';
import { resolveAdminTheme, getAdminThemeStyle } from '@/lib/admin-theme';
import { getAdminNavigationForRole } from '@/lib/admin-navigation';
import { fbWorkspaceLinks } from '@/lib/fb/admin-workspace';
import { FbCatalogueWorkspace } from '@/components/admin/fb-workspace';
import { HotelPublicAreaContent } from '@/components/public/hotel-public-area-content';
import type { FbKind } from '@/lib/fb/types';
import { resolveDomainContext } from '@/lib/domain-context';

const params = new URLSearchParams(location.search);
const index = Math.max(0, Math.min(5, Number(params.get('hotel') || 4)));
const data = fbFixture(index);
if (data.presentation) data.presentation.experienceVersion = index === 4 ? 'v4' : 'v3';
const graph = data.fb!;
const photoId = '53300000-0000-4000-8000-000000000001.png';
graph.outlets.forEach(outlet => { outlet.main_image_path = outlet.hotel_id + '/fb/outlet/' + outlet.id + '/' + photoId; });
graph.items[0].main_image_path = graph.items[0].hotel_id + '/fb/item/' + graph.items[0].id + '/' + photoId;
graph.outlets[0].location_info = 'Localização de fixture';
graph.outlets[1].is_published = false;
if (params.get('empty') === '1') { graph.outlets = []; graph.menus = []; graph.categories = []; graph.items = []; }
if (params.get('large') === '1' && graph.items[0]) graph.items = Array.from({ length: 5000 }, (_, i) => ({ ...graph.items[0], id: graph.items[0].id.slice(0, -4) + String(i).padStart(4, '0'), name: 'Item de fixture ' + i }));
const kind = (['outlet', 'menu', 'category', 'item'].includes(params.get('kind') || '') ? params.get('kind') : 'outlet') as FbKind;
const rows = { outlet: graph.outlets, menu: graph.menus, category: graph.categories, item: graph.items }[kind];
const row = params.get('id') === 'first' ? rows[0] : rows.find(candidate => candidate.id === params.get('id'));
const role = params.get('viewer') === '1' ? 'visualizador' : 'administrador';
const operational = role !== 'visualizador';
const access = { editorial: params.get('enabled') !== '0', orders: operational && params.get('orders') !== '0', printing: operational && params.get('printing') !== '0' };
const links = fbWorkspaceLinks(access);
const theme = resolveAdminTheme(data.hotel.brand_code, data.hotel.theme_preset);
const groups = getAdminNavigationForRole(role, params.get('enabled') === '0' ? new Set() : undefined, access);
const sidebar = { hotelName: data.hotel.name, hotelCity: 'Fixture local', hotelLogoUrl: null, themeLabel: null, navGroups: groups, userName: 'Administrador de fixture', userRole: role, signOutAction: async () => {} };
function Fixture() {
  const [mode] = useState<'catalog_only' | 'ordering'>(params.get('mode') === 'ordering' ? 'ordering' : 'catalog_only');
  if (location.pathname.startsWith('/hotel/')) return <HotelPublicAreaContent pageData={data} area="cardapio" language="pt" domainContext={resolveDomainContext(location.host)} preferSubdomainRoot={false}/>;
  return <AdminThemeProvider theme={theme}><aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 border-r border-[var(--admin-sidebar-border)] lg:block"><AdminSidebar {...sidebar}/></aside><div className="min-w-0 lg:pl-64"><header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 lg:hidden"><MobileMenu {...sidebar} themeCode={theme.code} themePreset={theme.themePreset} logoTreatment={theme.logoTreatment} themeStyle={getAdminThemeStyle(theme)}/></header><main className="p-4 sm:p-6 xl:px-7">{access.editorial ? <FbCatalogueWorkspace graph={graph} services={data.sections} kind={kind} overview={!params.has('kind')} row={row} creating={params.get('new') === '1'} filters={Object.fromEntries(['q','status','outlet','menu','category','availability','parent','page'].filter(key=>params.has(key)).map(key=>[key,params.get(key)!]))} canManage={operational} languages={Object.fromEntries(rows.map(candidate => [candidate.id, { en: 'Completo', es: 'Ausente' }]))} links={links} mode={{ mode, unavailable: null }} hotel={data.hotel}/> : <h1>Módulo indisponível</h1>}</main></div></AdminThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
