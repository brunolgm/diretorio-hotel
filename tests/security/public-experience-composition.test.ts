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
import { getPublicHighlightsState } from '../../lib/public-highlights.ts';
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
  const composer = read('components','public','experience-block-composer.tsx');
  const branded = ['grand-mercure/grand-mercure-public-home.tsx','mercure/mercure-public-home.tsx','novotel/novotel-public-home.tsx']
    .map((path) => read('components','public',...path.split('/'))).join('\n');
  assert.match(data,/rpc\('get_public_hotel_experience_layout'/);
  assert.doesNotMatch(data,/from\('hotel_experience_layout'\)/);
  assert.match(generic,/layoutByKey/);
  assert.match(generic,/isBlockVisible/);
  assert.match(branded,/layout\.some\(\(block\) => block\.blockKey === key && block\.isEnabled\)/);
  assert.doesNotMatch(branded,/style=\{\{ order:/);
  assert.match(composer,/getComposedExperienceBlockKeys/);
  assert.doesNotMatch(composer,/blockGroup|Segment|grid|margin|grand-mercure|mercure|novotel/i);
});

test('keeps theme presentation local while canonical layout governs visibility', () => {
  const homes = ['grand-mercure/grand-mercure-public-home.tsx','mercure/mercure-public-home.tsx','novotel/novotel-public-home.tsx'];
  for (const path of homes) {
    const source = read('components','public',...path.split('/'));
    assert.doesNotMatch(source,/ExperienceBlockComposer|blockGroup|getComposedExperienceBlockSegments/);
    assert.match(source,/getPublicHighlightsState\(enabled\('banners'\), banners\.length\)/);
    assert.match(source,/enabled\('contact'\)/);
    assert.doesNotMatch(source,/style=\{\{ order:|order\('banners'\) \+ 0\.5/);
    assert.doesNotMatch(source,/editorialMenuTitle|editorialTourismTitle|areaHref\('cardapio'\)|areaHref\('turismo'\)/);
  }

  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const heroIndex = grandMercure.indexOf('{hero}');
  const gridIndex = grandMercure.indexOf('{cardGridSection}');
  const highlightsIndex = grandMercure.indexOf('{highlights}');
  const editorialIndex = grandMercure.indexOf('<GrandMercureBrazilianPillars');
  const supportIndex = grandMercure.indexOf('{supportStrip}');
  const footerIndex = grandMercure.indexOf('<footer');
  assert.ok(heroIndex < gridIndex);
  assert.ok(gridIndex < highlightsIndex);
  assert.ok(highlightsIndex < editorialIndex);
  assert.ok(editorialIndex < supportIndex);
  assert.ok(supportIndex < footerIndex);
  assert.match(grandMercure,/grand-mercure-scroll-region mx-auto max-w-\[1280px\]/);
  assert.doesNotMatch(grandMercure,/grand-mercure-scroll-region[^"\n]*\bflex\b|grand-mercure-scroll-region[^"\n]*flex-col/);
  assert.equal((grandMercure.match(/grand-mercure-access-grid/g) ?? []).length,1);
  assert.match(grandMercure,/const hero = <section[\s\S]*?LanguageSwitcher[\s\S]*?<\/section>;/);
  assert.match(grandMercure,/showHighlights \? <section[\s\S]*?PromotionalBannerCarousel/);
  assert.match(grandMercure,/showRioCopacabanaEditorial \? <GrandMercureBrazilianPillars/);
  assert.doesNotMatch(grandMercure.match(/const highlights[\s\S]*?const supportStrip/)?.[0] || '',/GrandMercureBrazilianPillars/);
  assert.match(read('components','public','hotel-public-page-content.tsx'),/isBlockVisible\('contact'\) && whatsappHref/);
});

test('preserves each approved brand presentation while composition remains shared', () => {
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');

  assert.match(grandMercure,/grand-mercure-access-grid grid gap-2/);
  assert.match(grandMercure,/min-h-\[178px\][\s\S]*min-\[360px\]:min-h-\[190px\][\s\S]*md:min-h-\[240px\]/);
  assert.match(grandMercure,/ChevronDown/);
  assert.match(grandMercure,/grand-mercure-carioca-featured-banner[\s\S]*PromotionalBannerCarousel/);
  assert.match(grandMercure,/PromotionalBannerCarousel banners=\{banners\} language=\{language\} showEmptyFallback/);
  assert.doesNotMatch(grandMercure,/ctaHref|areaHref\('turismo'\)/);

  assert.match(mercure,/getThemedCardGridLayout\(cards\.length, 2, 'md'\)/);
  assert.match(mercure,/mercure-access-grid[\s\S]*cardGrid\.containerClassName/);
  assert.match(mercure,/cardGrid\.itemClassName\(index\)/);
  assert.match(mercure,/mercure-access-card[\s\S]*md:min-h-\[224px\]/);
  assert.equal((mercure.match(/mercure-access-grid/g) ?? []).length,1);
  assert.equal((mercure.match(/-mt-6/g) ?? []).length,1);
  assert.match(novotel,/getThemedCardGridLayout\(cards\.length, 2, 'xl'\)/);
  assert.match(novotel,/cardGrid\.containerClassName/);
  assert.match(novotel,/cardGrid\.itemClassName\(index\)/);
  assert.doesNotMatch(novotel,/md:grid-cols-3/);
  assert.equal((novotel.match(/-mt-6/g) ?? []).length,1);
  assert.equal((novotel.match(/md:-mt-10/g) ?? []).length,1);
  assert.match(novotel,/ChevronRight/);

  const branded = `${grandMercure}\n${mercure}\n${novotel}`;
  assert.doesNotMatch(branded,/BrandHomeAccessBlock|brand-home-access-block/);
  assert.doesNotMatch(branded,/editorialMenuTitle|editorialTourismTitle|areaHref\('cardapio'\)|areaHref\('turismo'\)/);
});

test('centers incomplete Novotel and Mercure rows from one to six renderable cards', () => {
  const expectedDesktopRows = [[1],[2],[3],[2,2],[3,2],[3,3]];
  const expectedMobileContainers = [
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-4',
    'grid-cols-2',
    'grid-cols-4',
    'grid-cols-2',
  ];
  const expectedDesktopContainers = [
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-2',
    'grid-cols-6',
    'grid-cols-3',
  ];

  for (let cardCount = 1; cardCount <= 6; cardCount += 1) {
    const mercureGrid = getThemedCardGridLayout(cardCount,2,'md');
    const novotelGrid = getThemedCardGridLayout(cardCount,2,'xl');

    for (const grid of [mercureGrid,novotelGrid]) {
      assert.deepEqual(grid.desktopRows,expectedDesktopRows[cardCount - 1]);
      assert.equal(grid.singleCard,cardCount === 1);
      assert.match(grid.containerClassName,new RegExp(`^${expectedMobileContainers[cardCount - 1]}\\b`));
    }
    assert.match(mercureGrid.containerClassName,new RegExp(`md:${expectedDesktopContainers[cardCount - 1]}\\b`));
    assert.match(novotelGrid.containerClassName,new RegExp(`xl:${expectedDesktopContainers[cardCount - 1]}\\b`));
    assert.doesNotMatch(novotelGrid.containerClassName,/md:grid-cols-3/);

    const mercurePlacements = Array.from({ length: cardCount },(_,index) => mercureGrid.itemClassName(index));
    const novotelPlacements = Array.from({ length: cardCount },(_,index) => novotelGrid.itemClassName(index));
    assert.equal(mercurePlacements.length,cardCount);
    assert.equal(novotelPlacements.length,cardCount);
    assert.doesNotMatch(mercurePlacements.join(' '),/(?:^|:)order-/);
    assert.doesNotMatch(novotelPlacements.join(' '),/(?:^|:)order-/);
  }

  for (const breakpoint of ['md','xl'] as const) {
    const threeCards = getThemedCardGridLayout(3,2,breakpoint);
    assert.match(threeCards.itemClassName(0),/^col-span-2/);
    assert.match(threeCards.itemClassName(1),/^col-span-2/);
    assert.match(threeCards.itemClassName(2),/col-span-2 col-start-2/);
    assert.doesNotMatch(threeCards.itemClassName(2),/col-span-4/);
    assert.match(threeCards.itemClassName(2),new RegExp(`${breakpoint}:col-span-1 ${breakpoint}:col-start-auto`));

    const fiveCards = getThemedCardGridLayout(5,2,breakpoint);
    assert.match(fiveCards.itemClassName(4),/col-span-2 col-start-2/);
    assert.match(fiveCards.itemClassName(3),new RegExp(`${breakpoint}:col-span-2 ${breakpoint}:col-start-2`));
    assert.match(fiveCards.itemClassName(4),new RegExp(`${breakpoint}:col-span-2 ${breakpoint}:col-start-4`));
  }

  assert.throws(() => getThemedCardGridLayout(0,2),/themed_card_grid_count_invalid/);
  assert.throws(() => getThemedCardGridLayout(7,2),/themed_card_grid_count_invalid/);
  assert.doesNotMatch(read('lib','themed-card-grid.ts'),/placeholder|filler|visibility:\s*hidden|opacity-0/);
});

test('renders grids only from filtered cards and keeps theme boundaries isolated', () => {
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const styles = read('app','globals.css');

  for (const source of [mercure,novotel]) {
    assert.match(source,/\.filter\(\(card\) => enabled\(card\.blockKey\)\)\.sort/);
    assert.match(source,/const cardGrid = cards\.length \? getThemedCardGridLayout/);
    assert.match(source,/const cardGridSection = cardGrid \?/);
    assert.match(source,/cards\.map\(\(card, index\)/);
    assert.doesNotMatch(source,/placeholder|filler|opacity-0|invisible/);
    assert.doesNotMatch(source,/(?:^|:)order-/);
    assert.doesNotMatch(source,/editorialMenuTitle|editorialTourismTitle|areaHref\('cardapio'\)|areaHref\('turismo'\)/);
  }

  assert.match(mercure,/getThemedCardGridLayout\(cards\.length, 2, 'md'\)/);
  assert.match(novotel,/getThemedCardGridLayout\(cards\.length, 2, 'xl'\)/);
  assert.doesNotMatch(mercure,/xl:grid-cols|#0052B4|#002F6C/);
  assert.doesNotMatch(novotel,/mercure-access-grid|mercure-access-card|#71386e/);
  assert.doesNotMatch(styles,/themed-card-grid|novotel-card-grid|mercure-card-grid/);

  assert.match(grandMercure,/getThemedCardGridLayout\(cards\.length, 2\)/);
  assert.match(grandMercure,/grand-mercure-access-grid grid gap-2/);
});

test('keeps Novotel and Mercure content surrounding the grid unchanged and in place', () => {
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');

  assert.match(novotel,/const hero = <section[\s\S]*NovotelHeroBackdrop[\s\S]*NovotelBrandSignature[\s\S]*copy\.novotelHeroDescription/);
  assert.match(novotel,/showHighlights \? <section[\s\S]*PromotionalBannerCarousel banners=\{banners\}/);
  assert.match(novotel,/const supportCard = enabled\('contact'\) \? <section[\s\S]*CircleHelp[\s\S]*Novotel help card/);
  assert.match(novotel,/NovotelMobileNavigation items=\{navigationItems\}/);
  assert.ok(novotel.indexOf('{hero}') < novotel.indexOf('{cardGridSection}'));
  assert.ok(novotel.indexOf('{cardGridSection}') < novotel.indexOf('{highlights}'));
  assert.ok(novotel.indexOf('{highlights}') < novotel.indexOf('{supportCard}'));
  assert.ok(novotel.indexOf('{supportCard}') < novotel.indexOf('<footer'));

  assert.match(mercure,/const hero = <section[\s\S]*MercureBrandSignature[\s\S]*copy\.mercureHeroDescription/);
  assert.match(mercure,/showHighlights \? <div[\s\S]*MercurePromotionalBanner banners=\{banners\}/);
  assert.match(mercure,/const supportCard = enabled\('contact'\) \? <section[\s\S]*Headphones[\s\S]*Mercure help card/);
  assert.match(mercure,/MercureBottomDock items=\{navigationItems\}/);
  assert.ok(mercure.indexOf('{hero}') < mercure.indexOf('{cardGridSection}'));
  assert.ok(mercure.indexOf('{cardGridSection}') < mercure.indexOf('{highlights}'));
  assert.ok(mercure.indexOf('{highlights}') < mercure.indexOf('{supportCard}'));
  assert.ok(mercure.indexOf('{supportCard}') < mercure.indexOf('<footer'));
});

test('renders image-free public banners as intentional themed editorial content', () => {
  const carousel = read('components','public','promotional-banner-carousel.tsx');
  const styles = read('app','globals.css');
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const fallbackStart = carousel.indexOf('<article className="hotel-theme-banner hotel-theme-banner-fallback overflow-hidden');
  const fallbackEnd = carousel.indexOf('export function PromotionalBannerCarousel');
  const fallback = carousel.slice(fallbackStart,fallbackEnd);

  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
  assert.doesNotMatch(carousel,/Imagem opcional não configurada|ImageIcon/);
  assert.doesNotMatch(fallback,/periodLabel|activeUntil|activeDuringPeriod|hotel-theme-banner-missing-image/);
  assert.match(fallback,/hotel-theme-banner-eyebrow/);
  assert.match(fallback,/<h2 className="mt-3 text-2xl font-semibold tracking-\[-0\.02em\] md:text-\[2rem\]">/);
  assert.doesNotMatch(fallback,/<h2[^>]*text-white|<p[^>]*text-slate/);
  assert.match(fallback,/banner\.subtitle \|\| copy\.fallback/);

  assert.match(fallback,/banner\.cta_url \? \([\s\S]*href=\{banner\.cta_url\}[\s\S]*target="_blank"[\s\S]*rel="noreferrer"/);
  assert.match(fallback,/hotel-theme-banner-cta[\s\S]*focus-visible:ring-2[\s\S]*\{ctaLabel\}[\s\S]*ExternalLink/);
  assert.match(carousel,/const periodLabel = getPeriodLabel\(banner, language, copy\);[\s\S]*if \(banner\.image_url\)[\s\S]*\{periodLabel\}/);

  assert.match(styles,/\.hotel-theme-page\[data-hotel-theme="grand-mercure"\] \.hotel-theme-banner-fallback > div \{[\s\S]*?background: linear-gradient\(120deg, #fffdf9[\s\S]*?color: #39342e !important/);
  assert.match(styles,/\.hotel-theme-page\[data-hotel-theme="grand-mercure"\] \.hotel-theme-banner-fallback h2,[\s\S]*?color: #51483e !important/);
  assert.match(grandMercure,/PromotionalBannerCarousel banners=\{banners\} language=\{language\}/);
  assert.match(mercure,/MercurePromotionalBanner banners=\{banners\} language=\{language\}/);
  assert.match(novotel,/PromotionalBannerCarousel banners=\{banners\} language=\{language\}/);
});

test('keeps Highlights visible while enabled and delegates empty presentation to the themed fallback', () => {
  const carousel = read('components','public','promotional-banner-carousel.tsx');
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const generic = read('components','public','hotel-public-page-content.tsx');
  const emptyStart = carousel.indexOf('if (!banners.length)');
  const emptyEnd = carousel.indexOf('if (banners.length === 1)');
  const emptyFallback = carousel.slice(emptyStart,emptyEnd);

  assert.equal(getPublicHighlightsState(true,1),'content');
  assert.equal(getPublicHighlightsState(true,0),'empty');
  assert.equal(getPublicHighlightsState(false,0),'hidden');
  assert.equal(getPublicHighlightsState(false,1),'hidden');

  for (const source of [grandMercure,mercure,novotel]) {
    assert.match(source,/getPublicHighlightsState\(enabled\('banners'\), banners\.length\)/);
    assert.match(source,/const showHighlights = highlightsState !== 'hidden'/);
    assert.doesNotMatch(source,/enabled\('banners'\) && banners\.length/);
  }
  assert.match(grandMercure,/showHighlights \? <section[\s\S]*showEmptyFallback/);
  assert.match(novotel,/showHighlights \? <section[\s\S]*showEmptyFallback/);
  assert.match(mercure,/highlightsState === 'content' \? <MercurePromotionalBanner[\s\S]*PromotionalBannerCarousel[\s\S]*showEmptyFallback/);
  assert.match(generic,/getPublicHighlightsState\(isBlockVisible\('banners'\), banners\.length\)/);
  assert.match(generic,/highlightsState !== 'hidden' \? \([\s\S]*PromotionalBannerCarousel banners=\{banners\} language=\{language\} showEmptyFallback/);

  assert.ok(emptyStart >= 0 && emptyEnd > emptyStart);
  assert.match(emptyFallback,/if \(!showEmptyFallback\) return null/);
  assert.match(emptyFallback,/copy\.emptyTitle/);
  assert.match(emptyFallback,/copy\.emptyDescription/);
  assert.match(carousel,/emptyTitle: 'Hotel highlights'[\s\S]*emptyTitle: 'Destacados del hotel'[\s\S]*emptyTitle: 'Destaques do hotel'/);
  assert.match(carousel,/emptyDescription: 'New experiences will be shared here soon\.'[\s\S]*emptyDescription: 'Pronto se publicar[\s\S]*emptyDescription: 'Novas experi/);
  assert.doesNotMatch(emptyFallback,/Imagem opcional|periodLabel|activeUntil|activeDuringPeriod|cta_url|hotel-theme-banner-cta/);
  assert.doesNotMatch(emptyFallback,/#003B7A|#005DA8|#0877BE|text-blue|text-white/);
  assert.match(emptyFallback,/var\(--hotel-surface-muted\)/);
  assert.match(emptyFallback,/var\(--hotel-text\)/);
  assert.match(emptyFallback,/hotel-theme-muted/);
  assert.match(emptyFallback,/var\(--hotel-accent\)/);
  assert.match(emptyFallback,/var\(--hotel-border\)/);
});

test('removes the temporary Grand Mercure diagnostics', () => {
  const loader = read('lib','public-hotel-data.ts');
  const home = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  assert.doesNotMatch(`${loader}\n${home}`,/\[GM DEBUG\]|\[GM HOME DEBUG\]/);
});

test('keeps Mercure mobile card copy readable and removes help-card compositing at the source', () => {
  const mercure = read('components','public','mercure','mercure-public-home.tsx');
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const styles = read('app','globals.css');
  const descriptionClassName = mercure.match(/<p className="([^"]+)">\{card\.description\}<\/p>/)?.[1] ?? '';
  const helpCardClassName = mercure.match(/const supportCard = enabled\('contact'\) \? <section className="([^"]+)"/)?.[1] ?? '';
  const helpCardSource = mercure.match(/const supportCard =[\s\S]*?<\/section> : null;/)?.[0] ?? '';

  assert.match(descriptionClassName,/\bmax-md:w-full\b/);
  assert.match(descriptionClassName,/\bmax-md:min-w-0\b/);
  assert.doesNotMatch(descriptionClassName,/(?:^|\s)(?:md:)?w-full(?:\s|$)/);
  assert.match(descriptionClassName,/(?:^|\s)max-w-\[180px\](?:\s|$)/);
  assert.match(descriptionClassName,/\bbreak-words\b/);
  assert.match(descriptionClassName,/\bwhitespace-normal\b/);
  assert.doesNotMatch(descriptionClassName,/whitespace-nowrap|truncate|line-clamp|overflow-hidden/);

  assert.match(helpCardClassName,/\boverflow-visible\b/);
  assert.doesNotMatch(helpCardClassName,/mercure-help-card|backdrop-filter/);
  assert.doesNotMatch(helpCardClassName,/(?:^|\s)-(?:mt|translate-y)-|absolute|(?:^|\s)h-\[/);
  assert.match(helpCardClassName,/max-md:relative max-md:z-10 max-md:isolate/);
  assert.doesNotMatch(helpCardClassName,/(?:^|\s)(?:relative|z-10|isolate|md:relative|md:z-10|md:isolate)(?:\s|$)/);
  assert.doesNotMatch(helpCardSource,/::before|::after|before:|after:|absolute|overflow-hidden|backdrop-filter/);
  assert.equal((helpCardSource.match(/shrink-0/g) ?? []).length,2);

  assert.match(mercure,/getThemedCardGridLayout\(cards\.length, 2, 'md'\)/);
  assert.equal(getThemedCardGridLayout(2,2,'md').containerClassName,'grid-cols-2 md:grid-cols-2');
  assert.match(helpCardClassName,/md:mx-10 md:mt-6 md:min-h-\[104px\] md:gap-5 md:rounded-\[26px\] md:p-5/);
  assert.match(styles,/\.mercure-public-home\[data-hotel-theme="mercure"\] \.mercure-access-card,[\s\S]*?\.mercure-help-card \{[\s\S]*?backdrop-filter: blur\(2px\)/);
  assert.match(mercure,/mercure-access-card group/);

  assert.match(grandMercure,/grand-mercure-access-grid grid gap-2/);
  assert.match(novotel,/getThemedCardGridLayout\(cards\.length, 2, 'xl'\)/);
  assert.doesNotMatch(`${grandMercure}\n${novotel}`,/mercure-help-card|whitespace-normal text-\[11px\]/);
});

test('keeps Novotel final content clear of the fixed mobile dock', () => {
  const novotel = read('components','public','novotel','novotel-public-home.tsx');
  const dock = read('components','public','novotel','novotel-mobile-navigation.tsx');
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const supportCardClassName = novotel.match(/const supportCard = enabled\('contact'\) \? <section className="([^"]+)"/)?.[1] ?? '';

  assert.match(novotel,/pb-\[calc\(61px\+env\(safe-area-inset-bottom\)\+5rem\)\] min-\[1025px\]:pb-12/);
  assert.doesNotMatch(novotel,/61px\+env\(safe-area-inset-bottom\)\+4rem/);
  assert.doesNotMatch(novotel,/pb-\[calc\(7\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(dock,/fixed inset-x-0 bottom-0/);
  assert.match(dock,/border-t/);
  assert.match(dock,/pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(dock,/min-h-\[60px\]/);
  assert.match(dock,/min-\[1025px\]:hidden/);
  assert.match(supportCardClassName,/mx-4 mt-4/);
  assert.doesNotMatch(supportCardClassName,/pb-|mb-|translate-y/);
  assert.ok(novotel.indexOf('{supportCard}') < novotel.indexOf('<footer'));
  assert.match(novotel,/getThemedCardGridLayout\(cards\.length, 2, 'xl'\)/);
  assert.doesNotMatch(grandMercure,/61px\+env\(safe-area-inset-bottom\)\+5rem/);
});

test('preserves the approved Grand Mercure grid class contract', () => {
  const expected = [
    { container:'grid-cols-1 md:grid-cols-1',items:[''] },
    { container:'grid-cols-2 md:grid-cols-2',items:['',''] },
    { container:'grid-cols-4 md:grid-cols-3',items:['col-span-2 md:col-span-1 md:col-start-auto','col-span-2 md:col-span-1 md:col-start-auto','col-span-2 col-start-2 md:col-span-1 md:col-start-auto'] },
    { container:'grid-cols-2 md:grid-cols-2',items:['','','',''] },
    { container:'grid-cols-4 md:grid-cols-6',items:['col-span-2 md:col-span-2 md:col-start-auto','col-span-2 md:col-span-2 md:col-start-auto','col-span-2 md:col-span-2 md:col-start-auto','col-span-2 md:col-span-2 md:col-start-2','col-span-2 col-start-2 md:col-span-2 md:col-start-4'] },
    { container:'grid-cols-2 md:grid-cols-3',items:['','','','','',''] },
  ];

  for (let cardCount = 1; cardCount <= 6; cardCount += 1) {
    const grid = getThemedCardGridLayout(cardCount,2);
    assert.equal(grid.containerClassName,expected[cardCount - 1].container);
    assert.deepEqual(
      Array.from({ length: cardCount },(_,index) => grid.itemClassName(index).split(/\s+/).filter(Boolean)),
      expected[cardCount - 1].items.map((classes) => classes.split(/\s+/).filter(Boolean)),
    );
  }
});

test('keeps the Rio editorial section natural, mobile-safe and independent from highlights', () => {
  const grandMercure = read('components','public','grand-mercure','grand-mercure-public-home.tsx');
  const pillars = read('components','public','grand-mercure','grand-mercure-brazilian-pillars.tsx');
  const styles = read('app','globals.css');
  const dock = read('components','public','grand-mercure','grand-mercure-mobile-navigation.tsx');

  assert.match(pillars,/grid grid-cols-2 md:grid-cols-4/);
  assert.equal((pillars.match(/title:/g) ?? []).length,12);
  for (const title of ['Gastronomia Local','Vistas Inesquec\u00edveis','Cultura Carioca','Hospitalidade Brasileira']) {
    assert.match(pillars,new RegExp(title));
  }
  const sectionClassName = pillars.match(/className="grand-mercure-brazilian-pillars([^"]*)"/)?.[1] ?? '';
  assert.doesNotMatch(sectionClassName,/(?:^|\s)(?:h-|max-h-)\[[^\]]+\]/);
  assert.match(pillars,/grand-mercure-promenade/);
  assert.match(grandMercure,/getPublicHighlightsState\(enabled\('banners'\), banners\.length\)/);
  assert.match(grandMercure,/showHighlights \? <section/);
  assert.match(grandMercure,/showRioCopacabanaEditorial \? <GrandMercureBrazilianPillars/);
  assert.doesNotMatch(grandMercure,/showHighlights\s*&&[\s\S]{0,120}GrandMercureBrazilianPillars/);
  assert.ok(grandMercure.indexOf('{highlights}') < grandMercure.indexOf('{showRioCopacabanaEditorial ? <GrandMercureBrazilianPillars'));

  assert.match(styles,/--grand-mercure-dock-height:\s*94px/);
  assert.match(styles,/height:\s*calc\(100dvh - var\(--grand-mercure-dock-height\) - env\(safe-area-inset-bottom\)\)/);
  assert.match(styles,/\.grand-mercure-scroll-region\s*\{[\s\S]*?padding-bottom:\s*3rem;[\s\S]*?scroll-padding-bottom:\s*3rem;/);
  assert.doesNotMatch(styles,/padding-bottom:\s*calc\(var\(--grand-mercure-dock-height\)/);
  assert.match(dock,/pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(dock,/min-\[1025px\]:hidden/);
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
