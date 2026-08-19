import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  EXPERIENCE_BLOCK_CATALOG,
  EXPERIENCE_BLOCK_KEYS,
  getComposedExperienceBlockKeys,
  getDefaultExperienceLayout,
  getRenderableExperienceLayout,
  normalizeExperienceLayout,
} from '../../lib/experience-layout.ts';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG } from '../../lib/modules/catalog.ts';
import { getGrandMercurePropertyLabel, isGrandMercureRioCopacabanaProperty } from '../../lib/grand-mercure-property.ts';
import { resolveHotelTheme } from '../../lib/hotel-theme.ts';
import { getThemedCardGridLayout } from '../../lib/themed-card-grid.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root,...parts),'utf8');

test('defines one closed eight-block catalog with an immutable hero', () => {
  assert.equal(EXPERIENCE_BLOCK_KEYS.length,8);
  assert.equal(new Set(EXPERIENCE_BLOCK_KEYS).size,8);
  assert.deepEqual(EXPERIENCE_BLOCK_CATALOG.map((block) => block.key),EXPERIENCE_BLOCK_KEYS);
  assert.equal(EXPERIENCE_BLOCK_CATALOG.find((block) => block.key==='hero')?.required,true);
  assert.deepEqual(getDefaultExperienceLayout().map((block) => block.position),[1,2,3,4,5,6,7,8]);
  assert.doesNotMatch(
    read('lib','experience-layout.ts'),
    /\b(?:html|css|script|variant)\s*:|custom(?:Html|Css)|scriptUrl/i,
  );
});

test('normalizes missing layout safely and composes visibility with entitlements', () => {
  const fallback = normalizeExperienceLayout(null);
  assert.deepEqual(fallback,getDefaultExperienceLayout());
  const hiddenHero = normalizeExperienceLayout([{ block_key:'hero',is_enabled:false,block_position:8 }]);
  assert.equal(hiddenHero.find((block) => block.blockKey==='hero')?.isEnabled,true);
  const renderable = getRenderableExperienceLayout(getDefaultExperienceLayout(),new Set(['core.directory','content.banners']));
  assert.deepEqual(renderable.map((block) => block.blockKey),['hero','banners','quick_info','contact']);
});

test('composes public blocks in configured order and excludes hidden or unavailable content', () => {
  const layout = normalizeExperienceLayout([
    { block_key:'contact',is_enabled:true,block_position:1 },
    { block_key:'hero',is_enabled:true,block_position:8 },
    { block_key:'quick_info',is_enabled:false,block_position:3 },
    { block_key:'banners',is_enabled:true,block_position:4 },
    { block_key:'announcements',is_enabled:true,block_position:5 },
    { block_key:'services',is_enabled:false,block_position:6 },
    { block_key:'departments',is_enabled:true,block_position:7 },
    { block_key:'policies',is_enabled:true,block_position:2 },
  ]);
  assert.deepEqual(
    getComposedExperienceBlockKeys(layout,new Set(['hero','contact','quick_info','banners','services'])),
    ['hero','contact','banners'],
  );
});

test('promotes navigation to available and the canonical twelve-module baseline', () => {
  assert.equal(MODULE_CATALOG.find((module) => module.key==='experience.navigation')?.availability,'available');
  assert.equal(BASELINE_MODULE_KEYS.length,12);
  assert.ok(BASELINE_MODULE_KEYS.includes('experience.navigation'));
});

test('creates closed RPC-only persistence with atomic reorder and controlled audit', () => {
  const migration = read('supabase','migrations','202608180001_50_public_experience_composition.sql');
  assert.match(migration,/create table public\.hotel_experience_layout/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on table public\.hotel_experience_layout from public,anon,authenticated,service_role/);
  assert.doesNotMatch(migration,/create policy[\s\S]*hotel_experience_layout/i);
  assert.match(migration,/create function public\.get_current_hotel_experience_layout/);
  assert.match(migration,/create function public\.get_public_hotel_experience_layout/);
  assert.match(migration,/create function public\.update_current_hotel_experience_block/);
  assert.match(migration,/create function public\.reorder_current_hotel_experience_blocks/);
  assert.equal((migration.match(/returns table\(block_key text,is_enabled boolean,block_position smallint\)/g) ?? []).length,4);
  assert.doesNotMatch(migration,/returns table\(block_key text,is_enabled boolean,position smallint\)/);
  assert.match(migration,/set constraints public\.hotel_experience_layout_position_key deferred/);
  assert.match(migration,/record_admin_audit_event/);
  assert.doesNotMatch(migration,/insert into public\.admin_audit_log/i);
});

test('keeps mutations hotel-scoped, role-guarded and free of browser hotel ids', () => {
  const actions = read('app','admin','experiencia','actions.ts');
  const migration = read('supabase','migrations','202608180001_50_public_experience_composition.sql');
  assert.match(actions,/requireAdminAccess\('editor'\)/);
  assert.match(actions,/isExperienceBlockKey/);
  assert.doesNotMatch(actions,/hotel_id|p_hotel_id/);
  assert.match(migration,/has_active_hotel_role\(current_hotel_id,'editor'\)/);
  assert.match(migration,/experience_block_entitlement_required/);
  assert.match(migration,/experience_hero_required/);
});

test('renders functional mobile-safe composition tabs and refreshable preview', () => {
  const page = read('app','admin','experiencia','page.tsx');
  const tabs = read('components','admin','experience','experience-tabs.tsx');
  const card = read('components','admin','experience','home-composition-card.tsx');
  const preview = read('components','admin','experience','public-experience-preview.tsx');
  for (const label of ['Composição','Aparência','Pré-visualização']) assert.match(tabs,new RegExp(label));
  assert.match(page,/HomeCompositionCard/);
  assert.match(card,/Mover .* para cima/);
  assert.match(card,/Mover .* para baixo/);
  assert.match(card,/Ocultar bloco|Mostrar bloco/);
  assert.match(card,/grid-cols-2[\s\S]*sm:grid-cols-1/);
  assert.match(preview,/previewVersion/);
});

test('public resolution uses one narrow layout RPC and never reads the table directly', () => {
  const data = read('lib','public-hotel-data.ts');
  const generic = read('components','public','hotel-public-page-content.tsx');
  const branded = ['grand-mercure/grand-mercure-public-home.tsx','mercure/mercure-public-home.tsx','novotel/novotel-public-home.tsx']
    .map((path) => read('components','public',...path.split('/'))).join('\n');
  assert.match(data,/rpc\('get_public_hotel_experience_layout'/);
  assert.doesNotMatch(data,/from\('hotel_experience_layout'\)/);
  assert.match(generic,/layoutByKey/);
  assert.match(generic,/isBlockVisible/);
  assert.match(branded,/ExperienceBlockComposer/);
  assert.doesNotMatch(branded,/style=\{\{ order:/);
});

test('all branded homes render only through the canonical compositor', () => {
  const homes = ['grand-mercure/grand-mercure-public-home.tsx','mercure/mercure-public-home.tsx','novotel/novotel-public-home.tsx'];
  for (const path of homes) {
    const source = read('components','public',...path.split('/'));
    assert.match(source,/ExperienceBlockComposer/);
    for (const key of EXPERIENCE_BLOCK_KEYS) assert.match(source,new RegExp(`${key}:`));
    assert.doesNotMatch(source,/style=\{\{ order:|order\('banners'\) \+ 0\.5/);
    assert.doesNotMatch(source,/editorialMenuTitle|editorialTourismTitle|areaHref\('cardapio'\)|areaHref\('turismo'\)/);
  }
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const composerIndex = grandMercure.indexOf('<ExperienceBlockComposer');
  const editorialIndex = grandMercure.indexOf('<GrandMercureBrazilianPillars');
  const supportIndex = grandMercure.indexOf('{supportStrip}');
  const footerIndex = grandMercure.indexOf('<footer');
  assert.ok(composerIndex < editorialIndex);
  assert.ok(editorialIndex < supportIndex);
  assert.ok(supportIndex < footerIndex);
  assert.match(grandMercure,/showRioCopacabanaEditorial \? <GrandMercureBrazilianPillars/);
  assert.doesNotMatch(grandMercure.match(/banners:[\s\S]*?announcements:/)?.[0] || '',/GrandMercureBrazilianPillars|showRioCopacabanaEditorial/);
  assert.match(read('components','public','hotel-public-page-content.tsx'),/isBlockVisible\('contact'\) && whatsappHref/);
});

test('preserves each approved brand presentation while composition remains shared', () => {
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');

  assert.match(grandMercure,/grand-mercure-access-grid grid gap-2/);
  assert.match(grandMercure,/min-h-\[158px\][\s\S]*md:min-h-\[240px\]/);
  assert.match(grandMercure,/ChevronDown/);
  assert.match(grandMercure,/grand-mercure-banner-zone[\s\S]*PromotionalBannerCarousel/);
  assert.match(grandMercure,/showEmptyFallback/);

  assert.match(mercure,/mercure-access-grid[\s\S]*cardGrid\.containerClassName/);
  assert.match(mercure,/mercure-access-card[\s\S]*md:min-h-\[224px\]/);
  assert.match(novotel,/cardGrid\.containerClassName/);
  assert.match(novotel,/ChevronRight/);

  const branded = `${grandMercure}\n${mercure}\n${novotel}`;
  assert.doesNotMatch(branded,/BrandHomeAccessBlock|brand-home-access-block/);
  assert.doesNotMatch(branded,/editorialMenuTitle|editorialTourismTitle|areaHref\('cardapio'\)|areaHref\('turismo'\)/);
});

test('builds compact filler-free themed grids for every supported cardinality', () => {
  const expectedDesktopRows = [[1],[2],[3],[2,2],[3,2],[3,3]];
  for (let cardCount = 1; cardCount <= 6; cardCount += 1) {
    const grandMercureGrid = getThemedCardGridLayout(cardCount,3);
    const twoColumnMobileGrid = getThemedCardGridLayout(cardCount,2);
    assert.deepEqual(grandMercureGrid.desktopRows,expectedDesktopRows[cardCount - 1]);
    assert.deepEqual(twoColumnMobileGrid.desktopRows,expectedDesktopRows[cardCount - 1]);
    assert.equal(grandMercureGrid.singleCard,cardCount === 1);
    assert.equal(twoColumnMobileGrid.singleCard,cardCount === 1);
  }

  assert.match(getThemedCardGridLayout(2,3).containerClassName,/md:grid-cols-2/);
  assert.match(getThemedCardGridLayout(3,3).containerClassName,/md:grid-cols-3/);
  assert.match(getThemedCardGridLayout(4,3).containerClassName,/md:grid-cols-2/);
  assert.match(getThemedCardGridLayout(5,3).containerClassName,/md:grid-cols-6/);
  assert.match(getThemedCardGridLayout(5,3).itemClassName(3),/md:col-start-2/);
  assert.match(getThemedCardGridLayout(5,3).itemClassName(4),/md:col-start-4/);
  assert.match(getThemedCardGridLayout(6,3).containerClassName,/md:grid-cols-3/);

  assert.match(getThemedCardGridLayout(6,3).containerClassName,/grid-cols-3/);
  assert.match(getThemedCardGridLayout(6,2).containerClassName,/^grid-cols-2/);
  assert.match(getThemedCardGridLayout(3,2).itemClassName(2),/col-start-2/);
  assert.doesNotMatch(read('lib','themed-card-grid.ts'),/placeholder|filler|visibility:\s*hidden|opacity-0/);
});

test('keeps the Grand Mercure theme reusable and scopes the Rio editorial extension to one property', () => {
  const rioProperty = { brand_code:'grand-mercure',slug:'grandmercureriocopacabana' };
  const futureGrandMercure = { brand_code:'grand-mercure',slug:'grandmercurefuturehotel' };
  assert.equal(resolveHotelTheme(rioProperty.brand_code,null).preset,'grand-mercure');
  assert.equal(resolveHotelTheme(futureGrandMercure.brand_code,null).preset,'grand-mercure');
  assert.equal(isGrandMercureRioCopacabanaProperty(rioProperty),true);
  assert.equal(isGrandMercureRioCopacabanaProperty(futureGrandMercure),false);

  const hiddenBanners = normalizeExperienceLayout([
    { block_key:'hero',is_enabled:true,block_position:1 },
    { block_key:'banners',is_enabled:false,block_position:2 },
  ]);
  const reorderedBanners = normalizeExperienceLayout([
    { block_key:'hero',is_enabled:true,block_position:1 },
    { block_key:'quick_info',is_enabled:true,block_position:2 },
    { block_key:'announcements',is_enabled:true,block_position:3 },
    { block_key:'services',is_enabled:true,block_position:4 },
    { block_key:'departments',is_enabled:true,block_position:5 },
    { block_key:'policies',is_enabled:true,block_position:6 },
    { block_key:'contact',is_enabled:true,block_position:7 },
    { block_key:'banners',is_enabled:true,block_position:8 },
  ]);
  assert.doesNotMatch(getComposedExperienceBlockKeys(hiddenBanners).join(','),/banners/);
  assert.equal(isGrandMercureRioCopacabanaProperty(rioProperty),true);
  assert.equal(getComposedExperienceBlockKeys(reorderedBanners).at(-1),'banners');
  assert.equal(isGrandMercureRioCopacabanaProperty(rioProperty),true);

  assert.equal(getGrandMercurePropertyLabel('Grand Mercure Rio de Janeiro Copacabana'),'RIO DE JANEIRO COPACABANA');
  assert.equal(getGrandMercurePropertyLabel('Grand Mercure São Paulo Ibirapuera'),'SÃO PAULO IBIRAPUERA');
  assert.doesNotMatch(read('components','public','grand-mercure','grand-mercure-brand-signature.tsx'),/RIO DE JANEIRO COPACABANA/);
  for (const path of ['mercure/mercure-public-home.tsx','novotel/novotel-public-home.tsx']) {
    assert.doesNotMatch(read('components','public',...path.split('/')),/GrandMercureBrazilianPillars|showRioCopacabanaEditorial/);
  }
});

test('centralizes new-hotel defaults without changing readiness or analytics', () => {
  const migration = read('supabase','migrations','202608180001_50_public_experience_composition.sql');
  const analytics = read('lib','analytics.ts');
  assert.match(migration,/50_initialize_hotel_experience_layout/);
  assert.match(migration,/create or replace function public\.create_platform_hotel_onboarding/);
  assert.match(migration,/experience\.appearance'\),\('experience\.navigation'\),\('experience\.preview/);
  assert.match(migration,/baseline_modules',12/);
  assert.doesNotMatch(migration,/create or replace function public\.record_platform_audit_event/);
  assert.doesNotMatch(migration,/effective_metadata\s*:=/);
  assert.match(migration,/reviewed hotel audit validation\/grants drifted/);
  assert.doesNotMatch(migration.match(/create table public\.hotel_experience_layout[\s\S]*?\);/)?.[0] || '',/jsonb|html|css|variant/i);
  assert.doesNotMatch(analytics,/layout_view|experience_layout/);
  assert.doesNotMatch(read('lib','hotel-readiness.ts'),/experience\.navigation|hotel_experience_layout/);
});
