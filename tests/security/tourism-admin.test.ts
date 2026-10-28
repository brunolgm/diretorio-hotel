import * as image from '../../lib/tourism/image.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as domain from '../../lib/tourism/admin.ts';
import * as catalog from '../../lib/tourism/catalog.ts';
import * as translations from '../../lib/tourism/translations.ts';
import { MODULE_CATALOG } from '../../lib/modules/catalog.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof import('typescript');
const source = readFileSync('app/admin/turismo/actions.ts', 'utf8');
const id = '52130000-0000-4000-8000-000000000001';
const other = '52130000-0000-4000-8000-000000000002';
const revision = '2026-09-11T01:02:03.123456+00:00';
const tenant = '52100000-0000-4000-8000-000000000001';

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const valid = () => form({ name: 'Museu', type: 'PLACE', category_key: 'sights', short_description: 'Visita', expected_updated_at: revision });

function harness(options: { denied?: boolean; disabled?: boolean; image?: boolean; missing?: boolean; rpcError?: { code: string; message?: string } } = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const filters: Array<[string, unknown]> = [];
  const guards: string[] = [];
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    order: () => query,
    maybeSingle: async () => ({ data: options.missing ? null : { main_image_path: options.image ? 'owned/image.png' : null }, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: [{ id }, { id: other }], error: null }),
  };
  const client = { from: () => query, rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: [{ id, deleted_id: id, main_image_path: null }], error: options.rpcError || null }; } };
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports: compiledModule.exports, module: compiledModule, require: (name: string) => {
    if (name === 'next/cache') return { revalidatePath: () => {} };
    if (name === 'next/navigation') return { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } };
    if (name === '@/lib/auth') return { requireAdminAccess: async (role: string) => { guards.push(role); if (options.denied) throw new Error('DENIED'); return { profile: { hotel_id: tenant } }; } };
    if (name === '@/lib/admin-entitlements') return { requireHotelModule: async (key: string) => { guards.push(key); if (options.disabled) throw new Error('DISABLED'); } };
    if (name === '@/lib/supabase/server') return { createClient: async () => client };
    if (name === '@/lib/security/identifiers') return { isUuid: (value: string) => /^[0-9a-f-]{36}$/.test(value) };
    if (name === '@/lib/services/translation-admin') return {
      buildFeedbackRedirect: (path: string, messages: Record<string, string>) => `${path}?${new URLSearchParams(messages)}`,
      syncTourismTranslations: async () => ({ status: 'skipped' }), formatTourismTranslationFeedback: () => ({}),
    };
    if (name === '@/lib/tourism/admin') return domain;
    if (name === '@/lib/tourism/image') return image;
    throw new Error(`Unexpected import ${name}`);
  } });
  const actions = compiledModule.exports as {
    createTourismItemAction: (state: object, data: FormData) => Promise<domain.TourismFormState>;
    updateTourismItemAction: (id: string, state: object, data: FormData) => Promise<domain.TourismFormState>;
    publishTourismItemAction: (data: FormData) => Promise<void>;
    moveTourismItemAction: (data: FormData) => Promise<void>;
    deleteTourismItemAction: (data: FormData) => Promise<void>;
    retranslateTourismItemAction: (data: FormData) => Promise<void>;
  };
  return { actions, calls, filters, guards };
}

test('tourism form whitelist excludes protected fields and validates the closed pair', () => {
  const data = valid();
  for (const key of ['hotel_id', 'id', 'slug', 'sort_order', 'main_image_path', 'created_at', 'updated_at']) data.set(key, 'forged');
  const patch = domain.tourismFormPatch(data);
  for (const key of ['hotel_id', 'id', 'slug', 'sort_order', 'main_image_path', 'created_at', 'updated_at']) assert.ok(!(key in patch));
  assert.equal(patch.is_published, false);
  assert.equal(patch.address, null);
  data.set('featured', 'on'); data.set('recommended_by_hotel', 'on');
  assert.equal(domain.tourismFormPatch(data).is_published, false);
  data.set('category_key', 'restaurants');
  assert.throws(() => domain.tourismFormPatch(data));
  assert.throws(() => domain.tourismFormPatch(form()), /tourism_patch_empty/);
});

test('create/update call only save RPC and preserve the original microsecond revision', async () => {
  const h = harness();
  await assert.rejects(h.actions.createTourismItemAction({}, valid()), /REDIRECT:\/admin\/turismo\//);
  assert.equal(h.calls[0].args.p_item_id, null);
  await assert.rejects(h.actions.updateTourismItemAction(id, {}, valid()), /REDIRECT:/);
  assert.equal(h.calls[1].args.p_expected_updated_at, revision);
  assert.equal(h.calls[1].name, 'save_current_hotel_tourism_item');
  assert.deepEqual(h.filters, []); // No read of a newer revision before saving.
  assert.deepEqual(h.guards, ['operador', 'content.tourism', 'operador', 'content.tourism']);
});

test('conflict returns form error without retry; empty form never invokes a write', async () => {
  const h = harness({ rpcError: { code: 'PT409', message: 'tourism_revision_conflict' } });
  assert.equal((await h.actions.updateTourismItemAction(id, {}, valid())).error, domain.TOURISM_CONFLICT_MESSAGE);
  assert.equal(h.calls.length, 1);
  const empty = harness();
  assert.match((await empty.actions.createTourismItemAction({}, form())).error || '', /Informe os campos/);
  assert.equal(empty.calls.length, 0);
  assert.match(domain.tourismAdminError({ message: 'tourism_patch_empty' }), /Informe os campos/);
});

test('every mutation repeats role and module guards', async () => {
  for (const options of [{ denied: true }, { disabled: true }]) {
    const h = harness(options);
    const data = form({ id, expected_updated_at: revision, direction: 'down', is_published: 'true' });
    for (const operation of [() => h.actions.createTourismItemAction({}, valid()), () => h.actions.updateTourismItemAction(id, {}, valid()), () => h.actions.publishTourismItemAction(data), () => h.actions.moveTourismItemAction(data), () => h.actions.deleteTourismItemAction(data), () => h.actions.retranslateTourismItemAction(data)]) await assert.rejects(operation, /DENIED|DISABLED/);
    assert.equal(h.calls.length, 0);
  }
});

test('publish sends a minimal patch and reorder uses the complete server tenant set', async () => {
  const h = harness();
  await assert.rejects(h.actions.publishTourismItemAction(form({ id, is_published: 'true', expected_updated_at: revision, featured: 'on' })), /REDIRECT:/);
  assert.equal(JSON.stringify(h.calls[0].args.p_changes), '{"is_published":true}');
  await assert.rejects(h.actions.moveTourismItemAction(form({ id, direction: 'down', hotel_id: 'forged', q: 'filtered' })), /REDIRECT:/);
  assert.deepEqual(h.calls[1].args.p_item_ids, [other, id]);
  assert.deepEqual(h.filters, [['hotel_id', tenant]]);
  assert.equal(domain.moveTourismOrder([id, other], id, 'up'), null);
  assert.equal(domain.moveTourismOrder([id, other], other, 'down'), null);
  assert.throws(() => domain.moveTourismOrder([id], other, 'down'));
});

test('delete requires original revision and consumes the existing RPC result', async () => {
  const h = harness();
  await assert.rejects(h.actions.deleteTourismItemAction(form({ id, expected_updated_at: revision })), /REDIRECT:/);
  assert.equal(h.calls[0].name, 'delete_current_hotel_tourism_item');
  assert.equal(h.calls[0].args.p_expected_updated_at, revision);
});

test('pages expose viewer detail but gate every mutation; public/image scope stays closed', () => {
  for (const file of ['app/admin/turismo/page.tsx', 'app/admin/turismo/[id]/page.tsx']) {
    const page = readFileSync(file, 'utf8');
    assert.match(page, /requireAdminAccess\('visualizador'\)/);
    assert.match(page, /requireHotelModule\('content.tourism'\)/);
    assert.match(page, /\.eq\('hotel_id', profile.hotel_id\)/);
    assert.match(page, /hasMinimumRole\(profile.normalizedRole, 'operador'\)/);
    assert.match(page, /canManage \?/);
  }
  const detail = readFileSync('app/admin/turismo/[id]/page.tsx', 'utf8');
  assert.match(detail, /\.eq\('id', id\)\.eq\('hotel_id', profile.hotel_id\)/);
  const controls = readFileSync('components/admin/tourism-item-actions.tsx', 'utf8');
  assert.match(controls, /AdminConfirmAction/);
  assert.match(controls, /name: 'expected_updated_at', value: item.updated_at/);
  const formSource = readFileSync('components/admin/tourism-form.tsx', 'utf8');
  assert.match(formSource, /useActionState/);
  assert.match(formSource, /value=\{item.updated_at\}/);
  assert.match(formSource, /TOURISM_CATEGORIES.filter/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|service_role|update_current_hotel_tourism_image/);
  assert.match(source, /syncTourismTranslations/);
  assert.doesNotMatch(source, /sync(?:Section|Department|Policy|Announcement|PromotionalBanner)Translations/);
  assert.equal(MODULE_CATALOG.find((entry) => entry.key === 'content.tourism')?.availability, 'available');
});

test('Server Components actually omit forms/actions for viewer and reject a foreign item', async () => {
  async function renderPage(role: 'visualizador' | 'operador', detail: boolean, foreign = false, languages = true, translated = false) {
    const filters: Array<[string, unknown]> = [];
    const item = { id, hotel_id: tenant, name: 'Museu', type: 'PLACE', category_key: 'sights', short_description: 'Visita', updated_at: revision };
    const query = {
      select: () => query, order: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: foreign ? null : item, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: translated ? [
        { language: 'en', name: 'Museum', short_description: null },
        { language: 'es', name: 'Museo', short_description: 'Visita' },
      ] : [item], error: null }),
    };
    const file = detail ? 'app/admin/turismo/[id]/page.tsx' : 'app/admin/turismo/page.tsx';
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    const compiledModule = { exports: {} };
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    runInNewContext(code, { exports: compiledModule.exports, module: compiledModule, require: (name: string) => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'next/navigation') return { notFound: () => { throw new Error('NOT_FOUND'); } };
      if (name === '@/lib/auth') return { requireAdminAccess: async () => ({ profile: { hotel_id: tenant, normalizedRole: role } }), hasMinimumRole: () => role === 'operador' };
      if (name === '@/lib/admin-entitlements') return { requireHotelModule: async () => {}, hasHotelModule: async () => languages };
      if (name === '@/lib/supabase/server') return { createClient: async () => ({ from: () => query }) };
      if (name === '@/lib/security/identifiers') return { isUuid: () => true };
      if (name === '@/lib/tourism/catalog') return catalog;
      if (name === '@/lib/tourism/admin') return domain;
      if (name === '@/lib/tourism/translations') return translations;
      if (name.endsWith('/actions')) return { createTourismItemAction: () => {}, updateTourismItemAction: () => {} };
      if (name.startsWith('@/components/')) return new Proxy({}, { get: (_object, key) => String(key) });
      throw new Error(`Unexpected import ${name}`);
    } });
    const page = (compiledModule.exports as { default: (props: object) => Promise<unknown> }).default;
    const tree = await page({ params: Promise.resolve({ id: foreign ? other : id }), searchParams: Promise.resolve({}) });
    assert.ok(filters.some(([key, value]) => key === 'hotel_id' && value === tenant));
    return JSON.stringify(tree);
  }
  for (const detail of [false, true]) {
    const viewer = await renderPage('visualizador', detail);
    assert.doesNotMatch(viewer, /"type":"TourismForm"|"type":"TourismItemActions"/);
    assert.doesNotMatch(viewer, /Traduzir novamente/);
    const operator = await renderPage('operador', detail);
    assert.match(operator, /"type":"TourismForm"/);
    assert.match(operator, /"type":"TourismItemActions"/);
    if (detail) {
      assert.match(viewer, /English — Ausente/);
      assert.match(operator, /Traduzir novamente/);
      assert.doesNotMatch(await renderPage('operador', true, false, false), /Traduzir novamente/);
      const statuses = await renderPage('visualizador', true, false, true, true);
      assert.match(statuses, /English — Parcial/);
      assert.match(statuses, /Español — Completo/);
    }
  }
  await assert.rejects(renderPage('visualizador', true, true), /NOT_FOUND/);
});
