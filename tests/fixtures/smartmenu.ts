import {fbFixture} from './fb.ts';
import {premiumReviewGraph, premiumSimulatedOffer} from './bugan-premium-catalog.mjs';
import {previewId} from './bugan-menu-homologation.mjs';
import source from '../../docs/bootstrap/bugan-cardapio-v2/lote-rascunho.json' with {type: 'json'};
import type {FbGraph} from '../../lib/fb/types.ts';
import type {Language, NativeOffer, Product} from '../../lib/fb/orders/journey.ts';

/** Synthetic tenants and simulated offers. Extra/combo examples exist only in this fixture. */
export function smartMenuFixture(index = 4, language: Language = 'pt', instant = '2026-11-10T11:00:00-03:00') {
  const pageData = fbFixture(index, language);
  const graph = premiumReviewGraph(source) as unknown as FbGraph;
  for (const rows of Object.values(graph)) for (const row of rows) row.hotel_id = pageData.hotel.id;
  pageData.fb = graph;
  const offer = premiumSimulatedOffer(source, instant) as NativeOffer;
  const outlet = offer.outlets[0];
  const first = outlet.products[0];
  first.groups = [{id: previewId(8), name: 'Adicionais · teste local', min: 0, max: 1, selection: 'single', options: [{id: previewId(9), name: 'Opção de teste', amount_minor: 200}]}];
  const second = outlet.products.find(product => product.id !== first.id && product.currency === first.currency)!;
  const combo: Product = {
    id: previewId(7), menu_id: first.menu_id, category_id: first.category_id, kind: 'combo',
    name: 'Combo · fixture local', description: 'Combinação sintética exclusiva dos testes locais.',
    currency: first.currency, amount_minor: first.amount_minor! + second.amount_minor!, available: true, groups: [],
    slots: [first, second].map((item, index) => ({id: previewId(10, String(index + 1)), name: 'Escolha ' + (index + 1), min: 1, max: 1, multiplicity: 1, choices: [{id: previewId(11, String(index + 1)), extra_minor: 0, item: {...item, groups: []}}]})),
  };
  outlet.products.push(combo);
  pageData.ordering = offer;
  return {pageData, offer, first, second, combo};
}
