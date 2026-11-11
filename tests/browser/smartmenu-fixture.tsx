import {createRoot} from 'react-dom/client';
import {SmartMenuView} from '../../components/public/smartmenu-view';
import {SmartMenuTracking} from '../../components/public/smartmenu-tracking';
import {smartMenuFixture} from '../fixtures/smartmenu';
import {roomServiceProjection} from '../../lib/fb/smartmenu-projection';
import {smartLineEstimate} from '../../lib/fb/smartmenu';
import {resolveDomainContext} from '../../lib/domain-context';
import {previewId} from '../fixtures/bugan-menu-homologation.mjs';
import type {Language, OrderIntent, PublicOrder, Quote} from '../../lib/fb/orders/journey';
import source from '../../docs/bootstrap/bugan-cardapio-v2/lote-rascunho.json';

const args = new URLSearchParams(location.search);
const language = (args.get('lang') ?? 'pt') as Language;
const {pageData, offer, first, second, combo} = smartMenuFixture(Number(args.get('hotel') ?? 4), language, args.get('instant') ?? undefined);
if (args.get('multiple') === '1') {
  const graph = pageData.fb!;
  const original = graph.outlets.find(outlet => outlet.type === 'room_service')!;
  const secondOutlet = {...original, id: previewId(15), name: 'Segundo Room Service · fixture'};
  const menu = {...graph.menus[0], id: previewId(16), name: 'Menu do segundo outlet · fixture'};
  const category = {...graph.categories[0], id: previewId(17), menu_id: menu.id};
  const item = {...graph.items[0], id: previewId(18), category_id: category.id, name: 'Produto exclusivo do segundo outlet · fixture'};
  graph.outlets.unshift(secondOutlet, {...original, id: previewId(19), hotel_id: previewId(99), sort_order: -100});
  graph.menus.push(menu); graph.categories.push(category); graph.items.push(item);
  graph.outlet_menus.push({hotel_id: pageData.hotel.id, outlet_id: secondOutlet.id, menu_id: menu.id, sort_order: 0});
  offer.outlets.unshift({...offer.outlets.find(outlet => outlet.id === previewId(2))!, id: secondOutlet.id, name: secondOutlet.name, menus: [{id: menu.id, name: menu.name, categories: [category]}], products: [{...first, id: item.id, menu_id: menu.id, category_id: category.id, name: item.name}]});
  if (args.get('reverse') === '1') graph.outlets.reverse();
}
offer.has_room_context = args.get('room') !== '0';
if (args.get('closed') === '1') offer.outlets.find(outlet => outlet.id === previewId(2))!.available = false;
if (args.get('unavailable') === '1') first.available = false;
if (args.get('large') === '1') {
  const outlet = offer.outlets.find(outlet => outlet.id === previewId(2))!;
  for (let index = 0; index < 1000; index++) outlet.products.push({...first, id: previewId(12, String(index + 1)), name: 'Produto de teste ' + index});
}
pageData.hotel.slug = 'hotel-sintetico';
if (pageData.hotel.theme_preset === 'bugan') pageData.hotel.logo_url = '/__review/logo.png';
const photos = await (await fetch('/__review/photos')).json() as string[];
const photoByItem = new Map(source.itens.filter(item => photos.includes(item.goomer_id)).map(item => [previewId(5, item.goomer_id), item.goomer_id]));
for (const product of offer.outlets.find(outlet => outlet.id === previewId(2))!.products) product.image_url = photoByItem.has(product.id) ? '/__review/photo/' + photoByItem.get(product.id) : null;
// No editorial outlet image is configured in this fixture. Exercise the typographic fallback.
const image = null;
const projection = roomServiceProjection(pageData.fb, pageData.hotel.id, offer)!;
declare global {
  interface Window {smartmenuRequests: {operation: string; body: Record<string, unknown>}[]; smartmenuFixtureIds: {first: string; second: string; combo: string}}
}
window.smartmenuRequests = [];
window.smartmenuFixtureIds = {first: first.id, second: second.id, combo: combo.id};
let confirmAttempts = 0;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.href);
  if (url.pathname.endsWith('/offer')) return Response.json(offer);
  if (url.pathname.startsWith('/api/fb/orders/')) {
    if (args.get('expired') === '1') return Response.json({error: 'forbidden'}, {status: 403});
    const order: PublicOrder = {order_id: previewId(14), reference: 'TESTE LOCAL', status: args.get('status') ?? 'registered', revision: 1, created_at: '2026-11-11T10:00:00Z', currency: first.currency, total_minor: first.amount_minor!, fulfilment: 'room_delivery', groups: [{label: 'Setor de teste', status: 'registered'}], lines: [{name: first.name, quantity: 1, total_minor: first.amount_minor!, kind: 'item', options: []}], history: [{action: 'orders.registered', status: 'registered', at: '2026-11-11T10:00:00Z'}], cancellation: {automatic: false, minutes: 0, request_status: null, contact: null}};
    return Response.json(order);
  }
  if (options?.method === 'POST') {
    const operation = url.pathname.split('/').pop()!;
    const body = JSON.parse(String(options.body));
    window.smartmenuRequests.push({operation, body});
    const intent = body.intent as OrderIntent;
    if (operation === 'quote') {
      if (!offer.has_room_context || !offer.outlets.find(outlet => outlet.id === previewId(2))!.available) return Response.json({error: 'forbidden'}, {status: 403});
      const quote: Quote = {quote_id: previewId(13), quote_reference: 'synthetic-reference', expires_at: '2099-01-01T00:00:00Z', currency: first.currency, available: true, total_minor: 0, lines: intent.lines.map(line => {
        const product = offer.outlets.find(outlet => outlet.id === previewId(2))!.products.find(product => product.id === line.id)!;
        return {id: line.id, kind: line.kind, name: product.name, quantity: line.quantity, unit_minor: product.amount_minor!, total_minor: smartLineEstimate(product, line)!, currency: product.currency, options: [], components: [], extra_minor: 0};
      })};
      quote.total_minor = quote.lines.reduce((sum, line) => sum + line.total_minor, 0);
      return Response.json(quote);
    }
    if (operation === 'confirm') {
      if (args.get('uncertain') === '1' && confirmAttempts++ === 0) throw new TypeError('Synthetic lost response');
      return Response.json({order_id: previewId(14), tracking_href: '/hotel/hotel-sintetico/pedidos/' + previewId(14), status: 'registered', replayed: confirmAttempts > 1});
    }
    return Response.json({error: 'forbidden'}, {status: 403});
  }
  return nativeFetch(input, options);
};
createRoot(document.getElementById('root')!).render(<>
  <div className="fixture-label">FIXTURE LOCAL · {pageData.hotel.name} · pedidos simulados{args.get('multiple') === '1' ? ' · múltiplos Room Service' : ''}</div>
  {args.get('tracking') === '1' ? <SmartMenuTracking hotel={pageData.hotel} id={previewId(14)} language={language} menuHref="/"/> : <SmartMenuView pageData={pageData} language={language} domainContext={resolveDomainContext('localhost')} initial={projection.native} hasRoomContext={projection.hasRoomContext} image={image} description={null} openingHours={null}/>}
</>);
