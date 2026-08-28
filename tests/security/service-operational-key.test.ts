import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  getServiceCanonicalHours,
  getServiceEditorialContent,
  isBreakfastOperationalSection,
  parseServiceOperationalKey,
} from '../../lib/service-operational.ts';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const migration = read('supabase', 'migrations', '202608270001_service_operational_key.sql');
const createAction = read('app', 'admin', 'servicos', 'actions.ts');
const updateAction = read('app', 'admin', 'servicos', '[id]', 'actions.ts');
const createPage = read('app', 'admin', 'servicos', 'page.tsx');
const updatePage = read('app', 'admin', 'servicos', '[id]', 'page.tsx');
const detail = read('components', 'public', 'hotel-service-detail-content.tsx');
const aiContext = read('lib', 'public-ai-context.ts');
const operationalContract = read('lib', 'service-operational.ts');
const publicHotelData = read('lib', 'public-hotel-data.ts');
const publicArea = read('components', 'public', 'hotel-public-area-content.tsx');
const publicHome = read('components', 'public', 'hotel-public-page-content.tsx');
const novotelExplorer = read('components', 'public', 'novotel', 'novotel-service-explorer.tsx');
const databaseTypes = read('types', 'database.ts');

test('migration adds a closed nullable catalog and one semantic service per hotel', () => {
  assert.match(migration, /add column operational_key text null/i);
  assert.match(migration, /check \(operational_key is null or operational_key in \('breakfast'\)\)/i);
  assert.match(migration, /unique index hotel_sections_hotel_operational_key_unique[\s\S]*\(hotel_id, operational_key\)[\s\S]*where operational_key is not null/i);
  assert.doesNotMatch(migration, /update\s+public\.hotel_sections|where[\s\S]*(?:title|\[DEMO\])/i);
  assert.match(migration, /grant insert \(operational_key\)[\s\S]*to authenticated/i);
  assert.match(migration, /grant update \(operational_key\)[\s\S]*to authenticated/i);
  assert.match(migration, /has_active_hotel_role\(new\.hotel_id, 'editor'\)/i);
  assert.match(migration, /before insert or update of operational_key/i);
  assert.doesNotMatch(migration, /create policy|alter table public\.hotel_sections disable row level security/i);
});

test('server and database enforce editor-only closed semantic changes within hotel scope', () => {
  for (const action of [createAction, updateAction]) {
    assert.match(action, /parseServiceOperationalKey/);
    assert.match(action, /hasMinimumRole\(profile\.normalizedRole, 'editor'\)/);
    assert.match(action, /formData\.has\('operational_key'\)/);
  }
  assert.match(updateAction, /\.eq\('id', id\)[\s\S]*\.eq\('hotel_id', hotel\.id\)/);
  assert.throws(() => parseServiceOperationalKey('restaurant'));
  assert.equal(parseServiceOperationalKey('breakfast'), 'breakfast');
  assert.equal(parseServiceOperationalKey(''), null);
});

test('admin uses a non-technical explicit selector only for editors and administrators', () => {
  for (const page of [createPage, updatePage]) {
    assert.match(page, /Função operacional/);
    assert.match(page, /Nenhuma/);
    assert.match(page, /SERVICE_OPERATIONAL_KEY_OPTIONS/);
    assert.match(page, /canManageOperationalKey/);
    assert.doesNotMatch(page, />operational_key</);
  }
  assert.match(operationalContract, /label: 'Café da manhã'/);
});

test('structured breakfast keeps editorial content and uses only canonical hotel hours', () => {
  const breakfast = {
    operational_key: 'breakfast',
    content: 'Buffet editorial. Horário: 6h30–10h30',
  };
  assert.equal(isBreakfastOperationalSection(breakfast), true);
  assert.equal(getServiceEditorialContent(breakfast), 'Buffet editorial.');
  assert.equal(getServiceCanonicalHours(breakfast, '7h15–11h15'), '7h15–11h15');
  assert.equal(getServiceCanonicalHours(breakfast, null), null);

  const ordinary = {
    operational_key: null,
    content: 'Café da manhã editorial. Horário: 6h30–10h30',
  };
  assert.equal(isBreakfastOperationalSection(ordinary), false);
  assert.equal(getServiceEditorialContent(ordinary), ordinary.content);
});

test('public service cards preserve editorial content and use canonical breakfast hours', () => {
  const legacyHours = '6:30-10:30';
  const canonicalHours = '7:15-11:15';
  const breakfast = {
    operational_key: 'breakfast',
    content: `Buffet demonstrativo servido no restaurante. Hours: ${legacyHours}`,
  };
  const ordinary = {
    operational_key: null,
    content: `Transfer editorial. Hours: ${legacyHours}`,
  };

  const breakfastCard = [
    getServiceEditorialContent(breakfast),
    getServiceCanonicalHours(breakfast, canonicalHours),
  ].filter(Boolean).join('\n');
  assert.match(breakfastCard, /Buffet demonstrativo servido no restaurante\./);
  assert.match(breakfastCard, new RegExp(canonicalHours));
  assert.doesNotMatch(breakfastCard, new RegExp(legacyHours));
  assert.equal(getServiceEditorialContent(ordinary), ordinary.content);

  assert.match(publicArea, /getServiceEditorialContent\(section\)/);
  assert.match(publicArea, /getServiceCanonicalHours\(section, (?:pageData\.)?hotel\.breakfast_hours\)/);
  assert.match(publicArea, /operationalHours: isBreakfastOperationalSection\(section\)/);
  assert.doesNotMatch(publicArea, /content: section\.content/);
  assert.match(novotelExplorer, /\{item\.operationalHours\}/);
  assert.match(publicHome, /getServiceEditorialContent\(item\)/);
  assert.match(publicHome, /getServiceCanonicalHours\(item, breakfastHours\)/);
  assert.doesNotMatch(publicHome, /\{item\.content \|\| copy\.serviceInfoUnavailable\}/);
});

test('public detail and AI share operational_key without title inference or translated identity', () => {
  assert.match(detail, /getServiceCanonicalHours\(section, hotel\.breakfast_hours\)/);
  assert.match(detail, /canonicalServiceHours \|\| copy\.notInformed/);
  assert.match(detail, /getServiceEditorialContent\(section\)/);
  assert.match(aiContext, /getServiceEditorialContent\(item\)/);
  assert.match(aiContext, /hotel\.breakfast_hours \? `[^`]*\$\{sanitizeText\(hotel\.breakfast_hours\)\}` : null/);
  assert.equal(aiContext.includes(['BREAKFAST', 'SERVICE', 'TITLE'].join('_')), false);
  assert.doesNotMatch(aiContext, /breakfast\|desayuno|caf\[e/);
  assert.match(databaseTypes, /operational_key: 'breakfast' \| null/);
  assert.match(publicArea, /value: hotel\.breakfast_hours \|\| copy\.notInformed/);

  const translatedSectionMapping = publicHotelData.match(
    /const displaySections = typedSections\.map[\s\S]*?\n  \}\);/
  )?.[0] || '';
  assert.match(translatedSectionMapping, /\.\.\.item/);
  assert.doesNotMatch(translatedSectionMapping, /operational_key\s*:/);

  const translated = { operational_key: 'breakfast', content: 'Editorial. Hours: stale' } as const;
  assert.equal(isBreakfastOperationalSection(translated), true);
});
