import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  EXPERIENCE_BLOCK_CATALOG,
  EXPERIENCE_BLOCK_KEYS,
  getDefaultExperienceLayout,
  getRenderableExperienceLayout,
  normalizeExperienceLayout,
} from '../../lib/experience-layout.ts';
import { BASELINE_MODULE_KEYS, MODULE_CATALOG } from '../../lib/modules/catalog.ts';

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
  assert.match(branded,/layoutByKey/);
  assert.match(branded,/style=\{\{ order:/);
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
