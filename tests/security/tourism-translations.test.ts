import * as imageFlow from '../../lib/tourism/image.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as tourism from '../../lib/tourism/translations.ts';
import * as domain from '../../lib/tourism/admin.ts';
import { MODULE_CATALOG, BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';

type Admin = typeof import('../../lib/services/translation-admin.ts');
type Service = typeof import('../../lib/services/translation-service.ts');
type Actions = typeof import('../../app/admin/turismo/actions.ts');
const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
const id = '52130000-0000-4000-8000-000000000001';
const tenant = '52100000-0000-4000-8000-000000000001';
const originalRevision = '2026-09-14T01:02:03.123456+00:00';
const savedRevision = '2026-09-14T01:02:03.123457+00:00';
const item = {
  id, hotel_id: tenant, updated_at: savedRevision, name: 'Museu', short_description: 'Visita',
  full_description: null, opening_hours: 'Das 9 às 18', price_info: 'Entrada gratuita', duration_info: null,
  type: 'PLACE', category_key: 'sights', address: 'Rua Um', map_url: 'https://example.invalid',
  official_website_url: null, phone: '+5511999999999', whatsapp_number: null, slug: 'museu',
  featured: false, sort_order: 0, main_image_path: null,
};
type Language = 'en' | 'es';
type Options = {
  languages?: boolean; entitlementError?: boolean; viewer?: boolean; tourismDisabled?: boolean;
  google?: Partial<Record<Language, 'fail' | 'throw' | 'empty' | 'short'>>;
  persist?: Partial<Record<Language, 'stale' | 'error' | 'throw' | 'null'>>;
  saveConflict?: boolean; missing?: boolean; missingKey?: boolean;
};

function compile<T>(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports: compiledModule.exports, module: compiledModule, URLSearchParams, AbortSignal,
    ...globals,
    require: (name: string) => {
      if (name === '@/lib/tourism/image') return imageFlow;
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    },
  });
  return compiledModule.exports as T;
}

function harness(options: Options = {}) {
  const events: string[] = [];
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const requests: Array<{ target: Language; q: string[]; source: string; format: string; signal?: AbortSignal }> = [];
  const filters: Array<[string, unknown]> = [];
  const logs: unknown[] = [];
  let ptSaved = false;
  const entitlements = {
    requireHotelModule: async (key: string) => { events.push(key); if (options.tourismDisabled) throw new Error('DENIED'); },
    hasHotelModule: async (key: string) => {
      assert.equal(key, 'content.languages'); events.push(key);
      if (options.entitlementError) throw new Error('internal entitlement details');
      return options.languages !== false;
    },
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    maybeSingle: async () => ({ data: options.missing ? null : item, error: null }),
  };
  const supabase = {
    from: (table: string) => { assert.equal(table, 'hotel_tourism_items'); return query; },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args }); events.push(name);
      if (name === 'save_current_hotel_tourism_item') {
        if (options.saveConflict) return { data: null, error: { code: 'PT409', message: 'tourism_revision_conflict' } };
        ptSaved = true;
        return { data: [item], error: null };
      }
      assert.equal(name, 'save_current_hotel_tourism_translation');
      assert.equal(args.p_item_id, id);
      assert.equal(args.p_expected_updated_at, savedRevision);
      const outcome = options.persist?.[args.p_language as Language];
      if (outcome === 'throw') throw new Error('sensitive database payload');
      return { data: outcome === 'null' ? null : outcome !== 'stale', error: outcome === 'error' ? { message: 'internal database detail' } : null };
    },
  };
  const logger = compile<typeof import('../../lib/services/operational-logger.ts')>('lib/services/operational-logger.ts', {}, {
    console: { error: (...args: unknown[]) => logs.push(args) },
  });
  const service = compile<Service>('lib/services/translation-service.ts', {
    'server-only': {}, '@/lib/tourism/translations': tourism,
    '@/lib/services/operational-logger': logger,
    '@/lib/env': {
      getRequiredEnvVar: () => { if (options.missingKey) throw new Error('missing'); return 'FAKE_TEST_KEY'; },
      logWarningOnce: (warning: unknown) => logs.push(warning),
    },
  }, {
    process: { env: {} },
    fetch: async (_url: string, init: { body: string; signal?: AbortSignal }) => {
      const body = JSON.parse(init.body) as { target: Language; q: string[]; source: string; format: string };
      requests.push({ ...body, signal: init.signal }); events.push(`google:${body.target}`);
      const outcome = options.google?.[body.target];
      if (outcome === 'throw') throw new Error('FAKE_TEST_KEY provider stack');
      return {
        ok: outcome !== 'fail', status: outcome === 'fail' ? 503 : 200,
        text: async () => 'FAKE_TEST_KEY raw provider payload',
        json: async () => ({ data: { translations: outcome === 'short' ? [] : body.q.map((q) => ({ translatedText: outcome === 'empty' ? '' : `${body.target}: ${q} &amp;` })) } }),
      };
    },
  });
  const admin = compile<Admin>('lib/services/translation-admin.ts', {
    '@/lib/services/operational-logger': logger,
    '@/lib/services/translation-service': service, '@/lib/tourism/translations': tourism,
    '@/lib/admin-entitlements': entitlements, '@/lib/supabase/server': { createClient: async () => supabase },
  }, { console: { error: (...args: unknown[]) => logs.push(args) } });
  const actions = compile<Actions>('app/admin/turismo/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } },
    '@/lib/auth': { requireAdminAccess: async (role: string) => {
      assert.equal(role, 'operador'); if (options.viewer) throw new Error('DENIED'); return { profile: { hotel_id: tenant } };
    } },
    '@/lib/admin-entitlements': entitlements, '@/lib/services/translation-admin': admin,
    '@/lib/tourism/admin': domain, '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/security/identifiers': { isUuid: (value: string) => /^[0-9a-f-]{36}$/.test(value) },
  });
  return { admin, service, actions, calls, requests, filters, events, logs, ptSaved: () => ptSaved,
    sync: () => admin.syncTourismTranslations({ supabase: supabase as unknown as Parameters<Admin['syncTourismTranslations']>[0]['supabase'], item }) };
}

function form(revision = originalRevision) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id, name: 'Client name', short_description: 'Client description', type: 'PLACE', category_key: 'sights', expected_updated_at: revision })) data.set(key, value);
  return data;
}
async function feedback(operation: Promise<unknown>) {
  try { await operation; assert.fail('Expected redirect'); }
  catch (error) {
    assert.ok(error instanceof Error && error.message.startsWith('REDIRECT:'));
    return new URL(error.message.slice(9), 'http://localhost');
  }
}

test('create and update save PT first and translate only the six returned fields with exact returned revision', async () => {
  for (const operation of ['create', 'update']) {
    const h = harness();
    const url = await feedback(operation === 'create' ? h.actions.createTourismItemAction({}, form()) : h.actions.updateTourismItemAction(id, {}, form()));
    assert.equal(url.pathname, `/admin/turismo/${id}`);
    assert.match(url.searchParams.get('success') || '', /EN e ES concluídas/);
    assert.ok(h.ptSaved());
    assert.ok(h.events.indexOf('save_current_hotel_tourism_item') < h.events.indexOf('google:en'));
    assert.equal(h.calls[0].args.p_item_id, operation === 'create' ? null : id);
    if (operation === 'update') assert.equal(h.calls[0].args.p_expected_updated_at, originalRevision);
    assert.equal(h.requests.length, 2);
    assert.deepEqual(h.filters, []); // No newer revision is read to force persistence.
    for (const request of h.requests) {
      assert.deepEqual(request.q, ['Museu', 'Visita', 'Das 9 às 18', 'Entrada gratuita']);
      assert.equal(request.source, 'pt'); assert.equal(request.format, 'text'); assert.ok(request.signal);
    }
    for (const call of h.calls.slice(1)) {
      assert.equal(call.name, 'save_current_hotel_tourism_translation');
      const patch = call.args.p_changes as tourism.TourismTranslationFields;
      assert.deepEqual(Object.keys(patch), [...tourism.TOURISM_TRANSLATABLE_FIELDS]);
      assert.equal(patch.full_description, null); assert.equal(patch.duration_info, null);
      assert.match(patch.name || '', /Museu &$/);
    }
  }
});

test('languages disabled saves PT normally with zero Google and zero translation RPC', async () => {
  for (const operation of ['create', 'update']) {
    const h = harness({ languages: false });
    const url = await feedback(operation === 'create' ? h.actions.createTourismItemAction({}, form()) : h.actions.updateTourismItemAction(id, {}, form()));
    assert.ok(h.ptSaved()); assert.equal(h.requests.length, 0); assert.equal(h.calls.length, 1);
    assert.equal(url.searchParams.has('warning'), false); assert.equal(url.searchParams.has('error'), false);
  }
});

test('the central Tourism translator enforces all six fields even when passed a full row', async () => {
  const h = harness();
  const result = await h.service.translateTourismFields({ ...item, full_description: 'Completa', duration_info: '2 horas' }, 'en');
  assert.deepEqual(h.requests[0].q, ['Museu', 'Visita', 'Completa', 'Das 9 às 18', 'Entrada gratuita', '2 horas']);
  assert.deepEqual(Object.keys(result || {}), [...tourism.TOURISM_TRANSLATABLE_FIELDS]);
});

test('Google failures, missing key and entitlement lookup failure never undo PT or expose provider details', async () => {
  for (const options of [
    { google: { en: 'fail', es: 'throw' } }, { missingKey: true }, { entitlementError: true },
    { google: { en: 'short', es: 'empty' } }, { persist: { en: 'throw', es: 'error' } },
  ] as Options[]) {
    const h = harness(options);
    const url = await feedback(h.actions.updateTourismItemAction(id, {}, form()));
    assert.ok(h.ptSaved()); assert.equal(h.calls.filter((call) => call.name === 'save_current_hotel_tourism_item').length, 1);
    assert.match(url.searchParams.get('success') || '', /atualizado/);
    assert.match(url.searchParams.get('warning') || '', /salvo em português.*não puderam/);
    assert.equal(url.searchParams.has('error'), false);
    assert.doesNotMatch(decodeURIComponent(url.toString()) + JSON.stringify(h.logs), /FAKE_TEST_KEY|raw provider|sensitive database|internal database|provider stack/);
  }
});

test('EN success and ES failure persist independently and produce partial feedback', async () => {
  for (const options of [{ google: { es: 'fail' } }, { persist: { es: 'error' } }] as Options[]) {
    const h = harness(options);
    const result = await h.sync();
    assert.equal(result.status, 'partial');
    assert.deepEqual([...result.successfulLanguages], ['en']); assert.deepEqual([...result.failedLanguages], ['es']);
    assert.match(h.admin.formatTourismTranslationFeedback(result).warning || '', /parcial.*EN concluída; ES/);
  }
});

test('stale false is discarded, never reported as success, and never retried with a newer revision', async () => {
  for (const persist of [{ en: 'stale', es: 'stale' }, { en: 'stale' }, { en: 'null', es: 'null' }] as Options['persist'][]) {
    const h = harness({ persist });
    const result = await h.sync();
    assert.equal(h.calls.length, 2); assert.deepEqual(h.filters, []);
    for (const call of h.calls) assert.equal(call.args.p_expected_updated_at, savedRevision);
    if (persist?.en === 'stale') {
      assert.equal(result.status, 'stale'); assert.ok(!result.successfulLanguages.includes('en'));
      const message = h.admin.formatTourismTranslationFeedback(result);
      assert.equal(message.success, undefined); assert.match(message.warning || '', /descartado por revisão obsoleta/);
    } else assert.equal(result.status, 'failed');
  }
  const h = harness({ persist: { en: 'stale', es: 'stale' } });
  const url = await feedback(h.actions.createTourismItemAction({}, form()));
  assert.ok(h.ptSaved()); assert.match(url.searchParams.get('warning') || '', /descartado/);
});

test('PT409 stops before translation and preserves the B1 form message', async () => {
  const h = harness({ saveConflict: true });
  const result = await h.actions.updateTourismItemAction(id, {}, form());
  assert.equal(result.error, domain.TOURISM_CONFLICT_MESSAGE);
  assert.equal(h.requests.length, 0); assert.equal(h.calls.length, 1); assert.equal(h.ptSaved(), false);
});

test('completeness is field-based, ignores absent PT and cannot infer complete from row existence', () => {
  const source = tourism.tourismTranslationFields(item);
  assert.equal(tourism.getTourismTranslationStatus(source, null), 'missing');
  assert.equal(tourism.getTourismTranslationStatus(source, {}), 'missing');
  assert.equal(tourism.getTourismTranslationStatus(source, { name: 'Museum' }), 'partial');
  assert.equal(tourism.getTourismTranslationStatus(source, { ...source, price_info: null }), 'partial');
  assert.equal(tourism.getTourismTranslationStatus(source, { ...source, name: ' ' }), 'partial');
  assert.equal(tourism.getTourismTranslationStatus(source, source), 'complete'); // PT NULL optional fields aren't required.
  for (const field of tourism.TOURISM_TRANSLATABLE_FIELDS) {
    const populated = { ...source, [field]: 'PT' };
    assert.equal(tourism.getTourismTranslationStatus(populated, { ...populated, [field]: null }), 'partial');
  }
});

test('manual retranslation requires operator and tourism, scopes item and rejects a changed displayed revision', async () => {
  for (const options of [{ viewer: true }, { tourismDisabled: true }]) {
    const h = harness(options);
    await assert.rejects(h.actions.retranslateTourismItemAction(form(savedRevision)), /DENIED/);
    assert.equal(h.requests.length, 0); assert.equal(h.calls.length, 0);
  }
  const stale = harness();
  const url = await feedback(stale.actions.retranslateTourismItemAction(form()));
  assert.equal(url.searchParams.get('error'), domain.TOURISM_CONFLICT_MESSAGE);
  assert.equal(stale.requests.length, 0); assert.equal(stale.calls.length, 0);
  const h = harness();
  await feedback(h.actions.retranslateTourismItemAction(form(savedRevision)));
  assert.deepEqual(h.filters, [['id', id], ['hotel_id', tenant]]);
  assert.equal(h.ptSaved(), false); assert.equal(h.calls.length, 2);
  const disabled = harness({ languages: false });
  const disabledUrl = await feedback(disabled.actions.retranslateTourismItemAction(form(savedRevision)));
  assert.equal(disabled.calls.length, 0); assert.equal(disabled.requests.length, 0);
  assert.equal(disabledUrl.searchParams.has('warning'), false);
  const foreign = harness({ missing: true });
  const foreignUrl = await feedback(foreign.actions.retranslateTourismItemAction(form(savedRevision)));
  assert.match(foreignUrl.searchParams.get('error') || '', /não encontrado/);
  assert.equal(foreign.requests.length, 0);
});

test('five existing editorial syncs retain their transport, persistence and feedback behavior', async () => {
  const cases = [
    ['syncSectionTranslations', 'sectionId', 'hotel_section_translations', 'section_id,language', { title: 'Title', content: null, cta: 'CTA', category: 'Category' }],
    ['syncDepartmentTranslations', 'departmentId', 'hotel_department_translations', 'department_id,language', { name: 'Name', description: null, action: 'Action' }],
    ['syncPolicyTranslations', 'policyId', 'hotel_policy_translations', 'policy_id,language', { title: 'Title', description: null }],
    ['syncAnnouncementTranslations', 'announcementId', 'hotel_announcement_translations', 'announcement_id,language', { title: 'Title', body: 'Body' }],
    ['syncPromotionalBannerTranslations', 'bannerId', 'hotel_promotional_banner_translations', 'banner_id,language', { title: 'Title', subtitle: null, cta_label: 'CTA' }],
  ] as const;
  for (const [name, idKey, table, onConflict, fields] of cases) {
    for (const mode of ['complete', 'partial', 'persist-error']) {
      const h = harness(mode === 'partial' ? { google: { es: 'fail' } } : {});
      let writes = 0;
      const client = { from: (actual: string) => {
        assert.equal(actual, table);
        return { upsert: async (rows: Array<Record<string, unknown>>, options: { onConflict: string }) => {
          writes++; assert.equal(options.onConflict, onConflict);
          assert.equal(rows.length, mode === 'partial' ? 1 : 2);
          for (const row of rows) { assert.equal(row[idKey.replace('Id', '_id')], id); assert.ok(row.updated_at); }
          return { error: mode === 'persist-error' ? new Error('test persistence failure') : null };
        } };
      } };
      const sync = h.admin[name] as unknown as (input: object) => Promise<import('../../lib/services/translation-admin.ts').TranslationSyncResult>;
      const result = await sync({ supabase: client, [idKey]: id, fields });
      assert.equal(result.status, mode === 'persist-error' ? 'failed' : mode);
      assert.equal(writes, 1); assert.equal(h.requests.length, 2);
      assert.ok(h.requests.every((request) => !request.signal)); // Tourism-only timeout doesn't change existing domains.
      assert.ok(!h.events.includes('content.languages'));
      assert.equal(h.admin.formatTranslationWarning(result) === null, mode === 'complete');
    }
  }
});

test('B2 historical scope remains immutable; current translator preserves its boundaries', () => {
  const baseline = '0b3e36ddc23d92bddfd47f96c042f042f17ca534';
  const protectedPaths = [
    'app/admin/idiomas/page.tsx', 'lib/tourism/admin.ts', 'lib/tourism/validation.ts', 'types/database.ts',
    ...['servicos', 'departamentos', 'politicas', 'comunicados', 'banners'].map((area) => `app/admin/${area}/actions.ts`),
  ];
  for (const path of protectedPaths) {
    const before = execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' });
    const deliveredB2 = execFileSync('git', ['show', `6551abd:${path}`], { encoding: 'utf8' });
    assert.equal(deliveredB2.replaceAll('\r\n', '\n'), before.replaceAll('\r\n', '\n'), path);
  }
  assert.equal(execFileSync('git', ['diff', baseline, '6551abd', '--name-only', '--', 'supabase/migrations', 'lib/modules', 'app/hotel', 'app/explorar', 'app/page.tsx'], { encoding: 'utf8' }).trim(), '');
  assert.equal(MODULE_CATALOG.find((entry) => entry.key === 'content.tourism')?.availability, 'available');
  assert.ok(!(BASELINE_MODULE_KEYS as readonly string[]).includes('content.tourism'));
  assert.equal((readFileSync('lib/services/translation-service.ts', 'utf8').match(/await fetch\(/g) || []).length, 1);
  const sync = readFileSync('lib/services/translation-admin.ts', 'utf8').split('export async function syncTourismTranslations')[1].split('export function formatTourismTranslationFeedback')[0];
  assert.doesNotMatch(sync, /\.upsert\(|\.from\(|new Date|createAdminClient|service_role|hotel_module_entitlements/);
});
