import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { TOURISM_TYPES, TOURISM_CATEGORIES, isTourismCategoryPair } from '../../lib/tourism/catalog.ts';
import { normalizeTourismPatch, isTourismUrl, tourismSlugBase, TOURISM_TEXT_LIMITS, TOURISM_PHONE_PATTERN } from '../../lib/tourism/validation.ts';
import { MODULE_CATALOG, BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';

const migrationPath = 'supabase/migrations/20260910043520_52_1_tourism_foundation.sql';
const sql = readFileSync(migrationPath, 'utf8');

test('incremental tourism image RPC keeps generic writes closed and audits atomically', () => {
  const imageSql = readFileSync('supabase/migrations/20260911011338_52_2a_tourism_main_image.sql', 'utf8');
  assert.match(imageSql, /create function public\.update_current_hotel_tourism_image\(/);
  assert.match(imageSql, /security definer set search_path=''/);
  assert.match(imageSql, /tourism_private\.mutation_hotel\(\)/);
  assert.match(imageSql, /i\.id=p_item_id and i\.hotel_id=target for update/);
  assert.match(imageSql, /errcode='40001',message='tourism_revision_conflict'/);
  assert.match(imageSql, /tourism\.image_updated/);
  assert.doesNotMatch(imageSql, /tourism\.updated|alter table|storage\.|hotel_module_entitlements|create or replace/i);
  assert.match(imageSql, /from public,anon,authenticated,service_role/);
  assert.match(imageSql, /to authenticated/);
  assert.match(imageSql, /previous_image_path text,main_image_path text/);
  const allowlist = sql.split('allowed:=case')[1].split('for k,v')[0];
  assert.doesNotMatch(allowlist, /main_image_path/);
});

test('image RPC rejects unchanged paths including NULL before mutation or audit', () => {
  const imageSql = readFileSync('supabase/migrations/20260911011338_52_2a_tourism_main_image.sql', 'utf8');
  assert.match(imageSql, /if p_main_image_path is not distinct from previous\.main_image_path then\s+raise exception using errcode='22023',message='tourism_image_unchanged'; end if;/);
  const guard = imageSql.indexOf('if p_main_image_path is not distinct');
  assert.ok(guard > imageSql.indexOf("message='tourism_revision_conflict'"));
  assert.ok(guard < imageSql.indexOf('update public.hotel_tourism_items'));
  assert.ok(guard < imageSql.indexOf('perform public.record_admin_audit_event'));
});

test('checked_patch rejects an empty object explicitly before either field allowlist', () => {
  const body = sql.split('create function tourism_private.checked_patch(')[1].split('end $$;')[0];
  assert.match(body, /p_patch is null or pg_catalog\.jsonb_typeof\(p_patch\)<>'object'/);
  assert.match(body, /if p_patch='\{\}'::jsonb then\s+raise exception using errcode='22023',message='tourism_patch_empty'; end if;/);
  assert.ok(body.indexOf("message='tourism_patch_invalid'") < body.indexOf("message='tourism_patch_empty'"));
  assert.ok(body.indexOf("message='tourism_patch_empty'") < body.indexOf('allowed:=case'));
});

test('tourism has exactly three types and fifteen closed, translated pairs in SQL parity', () => {
  assert.deepEqual(TOURISM_TYPES.map(({ key }) => key), ['PLACE', 'EXPERIENCE', 'GASTRONOMY']);
  assert.equal(TOURISM_CATEGORIES.length, 15);
  const actual: string[] = [];
  for (const match of sql.matchAll(/\(type = '([^']+)' and category_key in \(([^)]+)\)\)/g)) {
    for (const key of match[2].matchAll(/'([^']+)'/g)) actual.push(`${match[1]}:${key[1]}`);
  }
  const expected = TOURISM_CATEGORIES.map(({ type, key }) => `${type}:${key}`);
  assert.equal(new Set(expected).size, 15);
  assert.deepEqual(actual.sort(), expected.sort());
  for (const category of TOURISM_CATEGORIES) {
    assert.ok(isTourismCategoryPair(category.type, category.key));
    assert.equal(Object.keys(category.labels).length, 3);
    for (const language of ['pt', 'en', 'es'] as const) assert.ok(category.labels[language].trim());
    for (const type of TOURISM_TYPES) assert.equal(isTourismCategoryPair(type.key, category.key), type.key === category.type);
  }
  assert.equal(isTourismCategoryPair('PLACE', 'free'), false);
  assert.throws(() => normalizeTourismPatch({ type: 'PLACE', category_key: 'restaurants' }));
});

test('required text, scalar types, normalization, plain text and every base text limit', () => {
  for (const field of ['name', 'short_description', 'type', 'category_key']) {
    for (const value of ['', '  ', null]) assert.throws(() => normalizeTourismPatch({ [field]: value }));
  }
  for (const [field, limit] of Object.entries(TOURISM_TEXT_LIMITS)) {
    assert.throws(() => normalizeTourismPatch({ [field]: 'x'.repeat(limit + 1) }));
    if (!['phone', 'whatsapp_number', 'map_url', 'official_website_url'].includes(field)) {
      assert.equal(normalizeTourismPatch({ [field]: 'x'.repeat(limit) })[field], 'x'.repeat(limit));
    }
  }
  assert.deepEqual(normalizeTourismPatch({ name: '  Museu  ', address: ' ', full_description: null }), { name: 'Museu', address: null, full_description: null });
  assert.throws(() => normalizeTourismPatch({ name: '<img src=x onerror=alert(1)>' }));
  assert.throws(() => normalizeTourismPatch({ name: '\u0000' }));
  assert.throws(() => normalizeTourismPatch({ name: { nested: 'text' } }));
  assert.throws(() => normalizeTourismPatch({ featured: 'true' }));
  assert.throws(() => normalizeTourismPatch({ is_published: null }));
  assert.deepEqual(normalizeTourismPatch({ featured: true, recommended_by_hotel: true, is_published: false }), { featured: true, recommended_by_hotel: true, is_published: false });
});

test('phone and WhatsApp are international numbers; URL validation never fetches', () => {
  for (const field of ['phone', 'whatsapp_number']) {
    for (const value of ['5511', '+0123', '+1234567890123456', '+55 11', 'tel:+5511']) assert.throws(() => normalizeTourismPatch({ [field]: value }));
    assert.ok(TOURISM_PHONE_PATTERN.test('+5511999999999'));
    assert.equal(normalizeTourismPatch({ [field]: '+5511999999999' })[field], '+5511999999999');
  }
  for (const url of ['http://example.com', 'https://example.com/map?q=a%20b']) assert.ok(isTourismUrl(url));
  for (const url of ['javascript:alert(1)', '/relative', '//example.com', 'https://user:pass@example.com', 'https://@example.com', 'https://example.com\n', 'https://example.com\\@evil.test', 'https://', 'https://example.com:99999']) assert.equal(isTourismUrl(url), false, url);
  for (const field of ['map_url', 'official_website_url']) assert.throws(() => normalizeTourismPatch({ [field]: 'https://example.com\n' }));
  assert.doesNotMatch(readFileSync('lib/tourism/validation.ts', 'utf8'), /fetch\s*\(/);
});

test('slugs normalize PT independently of onboarding and reject protected RPC fields', () => {
  assert.equal(tourismSlugBase('Pão de Açúcar'), 'pao-de-acucar');
  assert.equal(tourismSlugBase('  Café --- & Mar  '), 'cafe-mar');
  assert.equal(tourismSlugBase('東京'), 'item');
  assert.equal(tourismSlugBase('a'.repeat(200)).length, 100);
  for (const field of ['hotel_id', 'slug', 'id', 'sort_order', 'main_image_path', 'created_at', 'updated_at', 'toString']) assert.throws(() => normalizeTourismPatch({ [field]: 'forged' }));
  assert.match(sql, /unique\(hotel_id,slug\)/);
  assert.match(sql, /for attempt in 0\.\.8 loop/);
  assert.match(sql, /tourism_ownership_slug_immutable/);
});

test('SQL RPC surface is closed, uses shared authorization/locking and atomic audit', () => {
  const functions = [...sql.matchAll(/create function public\.([a-z_]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(functions, ['save_current_hotel_tourism_item', 'reorder_current_hotel_tourism_items', 'delete_current_hotel_tourism_item', 'save_current_hotel_tourism_translation']);
  for (const name of functions) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^;]+from public,anon,authenticated,service_role;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^;]+to authenticated;`));
    const body = sql.split(`create function public.${name}(`)[1].split('end $$;')[0];
    assert.match(body, /security definer set search_path=''/);
    assert.match(body, /tourism_private\.mutation_hotel\(\)/);
    assert.match(body, /public\.record_admin_audit_event/);
    assert.doesNotMatch(body.split('returns')[0], /p_hotel_id|p_actor/);
  }
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /has_active_hotel_role\(target,'operador'\)/);
  assert.match(sql, /platform_status<>'archived' for update/);
  assert.match(sql, /is_hotel_module_enabled\(target,'content.tourism'\)/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
  assert.match(sql, /revoke all on all functions in schema tourism_private/);
});

test('translation schema and field-level invalidation preserve revision contract', () => {
  const table = sql.split('create table public.hotel_tourism_item_translations')[1].split('create function')[0];
  assert.match(table, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(table, /references public.hotel_tourism_items\(id\) on delete cascade/);
  assert.match(table, /language in \('en','es'\)/);
  assert.match(table, /unique\(item_id,language\)/);
  assert.match(table, /check\(coalesce\(name,short_description,full_description,opening_hours,price_info,duration_info\) is not null\)/);
  assert.match(sql, /if p_expected_updated_at<>parent.updated_at then return false/);
  assert.match(sql, /old.updated_at\+interval '1 microsecond'/);
  for (const field of ['name', 'short_description', 'full_description', 'opening_hours', 'price_info', 'duration_info']) assert.match(sql, new RegExp(`case when previous\\.${field} is distinct from candidate\\.${field} then null else t\\.${field} end`));
});

test('foundation preserves entitlement, legacy, Home, flights, Storage and analytics', () => {
  assert.equal(MODULE_CATALOG.find(({ key }) => key === 'content.tourism')?.availability, 'available');
  assert.ok(!(BASELINE_MODULE_KEYS as readonly string[]).includes('content.tourism'));
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:hotel_sections|hotel_module_entitlements|hotel_analytics_events)|storage\.|create bucket/i);
  assert.doesNotMatch(sql, /tourism\.image_updated|deleted_at|latitude|longitude/);
  // Compare with the parent of this migration's introduction, so this guard remains
  // useful after a later sprint intentionally evolves one of these domains.
  const introduction = execFileSync('git', ['log', '--format=%H', '--diff-filter=A', '--', migrationPath], { encoding: 'utf8' }).trim().split('\n')[0];
  const changed = execFileSync('git', ['diff', '--name-only', ...(introduction ? [`${introduction}^`, introduction] : ['HEAD'])], { encoding: 'utf8' }).trim().split('\n');
  const protectedPaths = /^(app\/|components\/|lib\/(?:analytics|public-|experience-layout|flight|modules\/)|supabase\/migrations\/(?!20260910043520_52_1_tourism_foundation))/;
  assert.deepEqual(changed.filter((file) => protectedPaths.test(file)), []);
});
