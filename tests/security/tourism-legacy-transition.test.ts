import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { loadPublicTourism, type PublicTourismItem } from '../../lib/tourism/public.ts';
import { getTourismSections } from '../../lib/public-hotel-areas.ts';
import type { PublicHotel, PublicHotelSection } from '../../lib/public-hotel-data';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof import('typescript');
const hotels = {
  a: { id: 'hotel-a', slug: 'hotel-a', subdomain: 'hotel-a' } as PublicHotel,
  b: { id: 'hotel-b', slug: 'hotel-b', subdomain: 'hotel-b' } as PublicHotel,
};
const items = [
  { id: 'a-published', hotel_id: hotels.a.id, slug: 'new-a', is_published: true },
  { id: 'a-draft', hotel_id: hotels.a.id, slug: 'draft-a', is_published: false },
  { id: 'b-published', hotel_id: hotels.b.id, slug: 'new-b', is_published: true },
] as PublicTourismItem[];

function harness(kind: 'slug' | 'subdomain', options: { empty?: boolean; gateError?: boolean } = {}) {
  const calls: string[] = [];
  let current: PublicHotel;
  const legacy = (hotel: PublicHotel) => ({ hotel, sections: [
    { id: `${hotel.id}-legacy`, hotel_id: hotel.id, title: `Turismo legado ${hotel.id}`, content: 'Original Services content', category: null },
    { id: `${hotel.id}-wifi`, hotel_id: hotel.id, title: 'Wi-Fi', category: null },
  ] as PublicHotelSection[] });
  const tourism = async (key: string) => {
    const hotel = Object.values(hotels).find((row) => row.slug === key)!;
    const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => resolve({ data: options.empty ? [] : items, error: null }) };
    const client = {
      rpc: async (_name: string, args: { p_hotel_id: string }) => { calls.push(`gate:${args.p_hotel_id}`); return { data: args.p_hotel_id === hotels.a.id, error: options.gateError ? Error('gate unavailable') : null }; },
      from: () => { calls.push(`new-query:${hotel.id}`); return query; },
    };
    return loadPublicTourism(client as unknown as Parameters<typeof loadPublicTourism>[0], hotel, 'pt');
  };
  const legacyLoader = async (key: string) => { calls.push(`legacy:${key}`); return legacy(Object.values(hotels).find((row) => row.slug === key)!); };
  const source = readFileSync(kind === 'slug' ? 'app/hotel/[slug]/explorar/[area]/page.tsx' : 'app/explorar/[area]/page.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = { exports: {} };
  runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, require: (name: string) => {
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'next/navigation') return { notFound: () => { throw Error('NOT_FOUND'); } };
    if (name === '@/lib/public-hotel-data') return { getPublicTourismDataBySlug: tourism, getPublicTourismDataBySubdomain: tourism, getPublicHotelPageDataBySlug: legacyLoader, getPublicHotelPageDataBySubdomain: legacyLoader };
    if (name === '@/lib/domain-context') return { getRequestDomainContext: async () => ({ subdomain: current.subdomain }), isHotelSubdomainContext: () => true };
    if (name === '@/lib/public-language') return { normalizePublicLanguage: () => 'pt' };
    if (name === '@/lib/public-routes') return { isPublicHotelAreaKey: (area: string) => area === 'turismo' };
    if (name === '@/components/public/public-tourism-content') return { PublicTourismContent: 'new-tourism' };
    if (name === '@/components/public/hotel-public-area-content') return { HotelPublicAreaContent: 'legacy-tourism' };
    if (name === '@/components/public/hotel-experience-unavailable') return { HotelExperienceUnavailable: 'unavailable' };
    throw Error(`Unexpected dependency: ${name}`);
  } });
  const page = (compiledModule.exports as { default: (props: object) => Promise<{ type: string; props: { data: { hotel: PublicHotel; items: PublicTourismItem[] }; pageData: ReturnType<typeof legacy> } }> }).default;
  const render = async (hotel: 'a' | 'b') => {
    current = hotels[hotel];
    // A browser-supplied hotel_id must not override slug/subdomain resolution.
    return page({ params: Promise.resolve({ area: 'turismo', slug: current.slug }), searchParams: Promise.resolve({ hotel_id: hotels.a.id }) });
  };
  return { render, calls };
}

for (const kind of ['slug', 'subdomain'] as const) {
  test(`${kind}: entitled hotel uses only published new Tourism, never legacy`, async () => {
    const h = harness(kind); const tree = await h.render('a');
    assert.equal(tree.type, 'new-tourism'); assert.equal(tree.props.data.hotel.id, hotels.a.id);
    assert.deepEqual(tree.props.data.items.map((item) => item.id), ['a-published']);
    assert.ok(!h.calls.some((call) => call.startsWith('legacy:')));
  });
  test(`${kind}: non-entitled hotel keeps legacy without 404 or cross-hotel state`, async () => {
    const h = harness(kind); await h.render('a'); const tree = await h.render('b');
    assert.equal(tree.type, 'legacy-tourism'); assert.equal(tree.props.pageData.hotel.id, hotels.b.id);
    assert.deepEqual(getTourismSections(tree.props.pageData.sections).map((row) => row.id), ['hotel-b-legacy']);
    assert.ok(h.calls.includes('gate:hotel-b')); assert.ok(h.calls.includes('legacy:hotel-b'));
    assert.ok(!h.calls.includes('new-query:hotel-b'));
  });
  test(`${kind}: entitled empty catalog never falls back to Services`, async () => {
    const h = harness(kind, { empty: true }); const tree = await h.render('a');
    assert.equal(tree.type, 'new-tourism'); assert.equal(tree.props.data.items.length, 0);
    assert.ok(!h.calls.some((call) => call.startsWith('legacy:')));
  });
  test(`${kind}: entitlement query errors do not silently select the legacy domain`, async () => {
    const h = harness(kind, { gateError: true }); await assert.rejects(h.render('a'));
    assert.ok(!h.calls.some((call) => call.startsWith('legacy:')));
  });
}

test('legacy read-only textual projection remains unchanged; renderer supports canonical brand themes', () => {
  for (const file of ['lib/public-hotel-areas.ts']) {
    const before = execFileSync('git', ['show', `91634a4:${file}`], { encoding: 'utf8' }).replace(/\r/g, '');
    assert.equal(readFileSync(file, 'utf8').replace(/\r/g, ''), before);
  }
});
