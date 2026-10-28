import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { associateTourismImage, cleanupTourismImage, type TourismImageIO } from '../../lib/tourism/image.ts';
import * as image from '../../lib/security/image-upload.ts';
import * as domain from '../../lib/tourism/admin.ts';
import { tourismImageUrl } from '../../lib/tourism/media.ts';

const hotel = '52100000-0000-4000-8000-000000000001';
const item = '52130000-0000-4000-8000-000000000001';
const oldPath = `${hotel}/tourism/${item}/52140000-0000-4000-8000-000000000001.png`;
const newPath = oldPath.replace('000000000001.png', '000000000002.png');
const thirdPath = oldPath.replace('000000000001.png', '000000000003.png');
const revision = '2026-09-14T01:02:03.123456+00:00';
function harness(options: { ambiguous?: boolean; code?: string; current?: string | null; readFails?: boolean; removeFails?: number; previous?: string | null } = {}) {
  const removed: string[] = []; const logs: string[] = [];
  const io: TourismImageIO = {
    associate: async (path, expected) => { assert.equal(expected, revision); return options.ambiguous ? { data: null, error: null } : options.code ? { data: null, error: { code: options.code } } : { data: { item_id: item, updated_at: revision, previous_image_path: options.previous === undefined ? oldPath : options.previous, main_image_path: path }, error: null }; },
    read: async () => { if (options.readFails) throw Error('offline'); return options.current ?? null; },
    remove: async (path) => { removed.push(path); return { error: removed.length <= (options.removeFails || 0) ? Error('storage') : null }; },
    log: (operation, path) => logs.push(`${operation}:${path}`),
  };
  const run = (path: string | null = newPath) => associateTourismImage({ io, hotelId: hotel, itemId: item, oldPath, newPath: path, revision, errorMessage: domain.tourismAdminError });
  return { io, removed, logs, run };
}
test('replace uses RPC previous path, never removes the resulting object', async () => {
  const h = harness(); assert.ok((await h.run()).success); assert.deepEqual(h.removed, [oldPath]);
  const same = harness({ previous: newPath }); assert.ok((await same.run()).success); assert.deepEqual(same.removed, []);
  const absent = harness({ previous: null }); await absent.run(); assert.deepEqual(absent.removed, []);
});
for (const code of ['PT409', '22023', '42501', 'P0002']) test(`confirmed ${code} compensates only the new upload`, async () => {
  const h = harness({ code }); const feedback = await h.run(); assert.ok(feedback.error); assert.equal(feedback.success, undefined); assert.deepEqual(h.removed, [newPath]);
});
test('ambiguous association reconciles a confirmed new path', async () => { const h = harness({ ambiguous: true, current: newPath }); assert.ok((await h.run()).success); assert.deepEqual(h.removed, [oldPath]); });
test('ambiguous old path preserves the upload and does not claim success or rollback', async () => {
  const h = harness({ ambiguous: true, current: oldPath }); const result = await h.run();
  assert.ok(result.warning); assert.equal(result.success, undefined); assert.equal(result.error, undefined);
  assert.deepEqual(h.removed, []); assert.ok(h.logs[0].includes('association_ambiguous_old_path_observed'));
});

test('late commit after an old-path read never associates a deleted upload', async () => {
  const objects = new Set([oldPath, newPath]); const removed: string[] = [];
  let current = oldPath; let lateCommit: (() => void) | undefined;
  const io: TourismImageIO = {
    associate: async (path) => {
      lateCommit = () => { current = path!; };
      throw Error('response lost while the original transaction is still pending');
    },
    read: async () => current,
    remove: async (path) => { removed.push(path); objects.delete(path); return { error: null }; },
    log: () => {},
  };
  const feedback = await associateTourismImage({ io, hotelId: hotel, itemId: item, oldPath, newPath, revision, errorMessage: domain.tourismAdminError });
  assert.deepEqual(removed, []);
  assert.ok(lateCommit); lateCommit();
  assert.equal(current, newPath); assert.ok(objects.has(current), 'late commit must reference an existing object');
  assert.ok(feedback.warning); assert.equal(feedback.success, undefined); assert.equal(feedback.error, undefined);
});

test('ambiguous removal observing the old path also preserves all objects', async () => {
  const h = harness({ ambiguous: true, current: oldPath }); const result = await h.run(null);
  assert.ok(result.warning); assert.equal(result.success, undefined); assert.equal(result.error, undefined);
  assert.deepEqual(h.removed, []);
});
test('ambiguous third path preserves every file and reports refresh', async () => { const h = harness({ ambiguous: true, current: thirdPath }); const result = await h.run(); assert.ok(result.warning); assert.equal(result.success, undefined); assert.deepEqual(h.removed, []); });
test('failed reconciliation preserves every file and logs uncertainty', async () => { const h = harness({ ambiguous: true, readFails: true }); assert.ok((await h.run()).warning); assert.deepEqual(h.removed, []); assert.equal(h.logs.length, 1); });
test('transport and shutdown error codes reconcile instead of assuming SQL rollback', async () => {
  for (const code of ['08006', '08007', '08P01', '57014', '57P01', '57P02', '57P03']) {
    const h = harness({ code, current: newPath }); assert.ok((await h.run()).success); assert.deepEqual(h.removed, [oldPath]);
  }
});
test('remove image commits NULL before cleaning previous path', async () => { const h = harness(); assert.ok((await h.run(null)).success); assert.deepEqual(h.removed, [oldPath]); });
test('cleanup retries once, then warns without claiming rollback', async () => {
  const retry = harness({ removeFails: 1 }); assert.ok((await retry.run()).success); assert.deepEqual(retry.removed, [oldPath, oldPath]);
  const failure = harness({ removeFails: 9 }); const result = await failure.run(); assert.ok(result.success); assert.ok(result.warning); assert.equal(failure.removed.length, 2); assert.ok(failure.logs[0].includes(oldPath));
});
test('cleanup is owner scoped and safe for NULL or equal paths', async () => {
  const h = harness(); assert.equal(await cleanupTourismImage(h.io, hotel, item, oldPath.replace(hotel, item), null), false);
  assert.equal(await cleanupTourismImage(h.io, hotel, item, null, null), true);
  assert.equal(await cleanupTourismImage(h.io, hotel, item, newPath, newPath), true); assert.deepEqual(h.removed, []);
});
test('media resolves only exact owned paths and trusted HTTPS/loopback origins', () => {
  assert.equal(tourismImageUrl('https://local.example', oldPath, hotel, item), `https://local.example/storage/v1/object/public/hotel-assets/${oldPath}`);
  for (const base of ['http://external.example', 'javascript:bad', 'https://user:pass@example.com']) assert.equal(tourismImageUrl(base, oldPath, hotel, item), null);
  assert.equal(tourismImageUrl('https://local.example', thirdPath, item, hotel), null);
});

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof import('typescript');
function actionHarness(options: { denied?: boolean; disabled?: boolean; foreign?: boolean; dbFailure?: boolean; storageFailure?: boolean; deletion?: boolean; ambiguous?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = []; const removed: string[] = []; const uploads: string[] = []; const filters: string[] = [];
  const operationalLogs: Array<{ operation: string; hotelId: string; itemId: string; oldPath: string; newPath: string; revision: string }> = [];
  const query = { select: () => query, eq: (k: string, v: string) => { filters.push(`${k}:${v}`); return query; }, maybeSingle: async () => ({ data: options.foreign ? null : { main_image_path: oldPath }, error: null }) };
  const storage = { upload: async (path: string, _bytes: unknown, config: { upsert: boolean }) => { assert.equal(config.upsert, false); assert.ok(image.isOwnedTourismImagePath(path, hotel, item)); uploads.push(path); return { error: null }; }, remove: async ([path]: string[]) => { removed.push(path); return { error: options.storageFailure ? Error('offline') : null }; } };
  const client = { from: () => query, rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); if (options.ambiguous) throw Error('transport lost'); return { data: options.dbFailure ? null : [options.deletion ? { deleted_id: item, main_image_path: oldPath } : { item_id: item, updated_at: revision, previous_image_path: oldPath, main_image_path: args.p_main_image_path }], error: options.dbFailure ? { code: 'PT409' } : null }; } };
  const compiledModule = { exports: {} };
  const file = options.deletion ? 'app/admin/turismo/actions.ts' : 'app/admin/turismo/image-actions.ts';
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, File, console: { error: (_message: string, context: typeof operationalLogs[number]) => operationalLogs.push(context) }, require: (name: string) => {
    if (name === 'next/cache') return { revalidatePath: () => {} };
    if (name === 'next/navigation') return { redirect: (url: string) => { throw Error(`REDIRECT:${url}`); } };
    if (name === '@/lib/auth') return { requireAdminAccess: async (role: string) => { assert.equal(role, 'operador'); if (options.denied) throw Error('DENIED'); return { profile: { hotel_id: hotel } }; } };
    if (name === '@/lib/admin-entitlements') return { requireHotelModule: async (key: string) => { assert.equal(key, 'content.tourism'); if (options.disabled) throw Error('DISABLED'); } };
    if (name === '@/lib/supabase/server') return { createClient: async () => client };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => ({ storage: { from: () => storage } }) };
    if (name === '@/lib/security/image-upload') return image;
    if (name === '@/lib/security/identifiers') return { isUuid: (v: string) => /^[a-f0-9-]{36}$/.test(v) };
    if (name === '@/lib/tourism/image') return { associateTourismImage, cleanupTourismImage };
    if (name === '@/lib/tourism/admin') return domain;
    if (name === '@/lib/services/translation-admin') return { buildFeedbackRedirect: (p: string, data: Record<string, string>) => `${p}?${new URLSearchParams(data)}` };
    throw Error(name);
  } });
  const actions = compiledModule.exports as Record<string, (form: FormData) => Promise<void>>;
  return { actions, calls, uploads, removed, filters, operationalLogs };
}
function form(mime = 'image/png') {
  const f = new FormData(); f.set('id', item); f.set('expected_updated_at', revision);
  const b = new Uint8Array(33); b.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]); const view = new DataView(b.buffer); view.setUint32(16,40); view.setUint32(20,30); b[24]=8;b[25]=6;
  f.set('image', new File([b], 'untrusted-name.svg', { type: mime })); return f;
}
test('real upload action scopes lookup and submits original microsecond revision via normal client', async () => { const h=actionHarness(); await assert.rejects(h.actions.uploadTourismImageAction(form()), /REDIRECT:/); assert.deepEqual(h.filters,[`id:${item}`,`hotel_id:${hotel}`]); assert.equal(h.calls[0].name,'update_current_hotel_tourism_image'); assert.equal(h.calls[0].args.p_expected_updated_at,revision); assert.equal(h.uploads.length,1);assert.deepEqual(h.removed,[oldPath]); });
for (const [key, message] of [['denied','DENIED'],['disabled','DISABLED'],['foreign','REDIRECT:']] as const) test(`real upload action rejects ${key} before storage`, async () => { const h=actionHarness({[key]:true}); await assert.rejects(h.actions.uploadTourismImageAction(form()),new RegExp(message));assert.equal(h.uploads.length,0);assert.equal(h.calls.length,0); });
test('real upload action rejects spoofed MIME before storage', async () => {const h=actionHarness();await assert.rejects(h.actions.uploadTourismImageAction(form('image/jpeg')), /REDIRECT:/);assert.equal(h.uploads.length,0);});

test('ambiguous upload action logs item, paths, revision and operation without deleting', async () => {
  const h = actionHarness({ ambiguous: true });
  await assert.rejects(h.actions.uploadTourismImageAction(form()), /warning=/);
  assert.deepEqual(h.removed, []); assert.equal(h.uploads.length, 1);
  const context = h.operationalLogs[0];
  assert.equal(context.operation, 'association_ambiguous_old_path_observed');
  assert.equal(context.hotelId, hotel); assert.equal(context.itemId, item);
  assert.equal(context.oldPath, oldPath); assert.equal(context.newPath, h.uploads[0]); assert.equal(context.revision, revision);
});
test('delete with image uses returned RPC path and preserves storage when DB fails', async () => {
  for(const dbFailure of [false,true]) {const h=actionHarness({deletion:true,dbFailure});await assert.rejects(h.actions.deleteTourismItemAction(form()), /REDIRECT:/);assert.deepEqual(h.removed, dbFailure?[]:[oldPath]);}
  const h=actionHarness({deletion:true,storageFailure:true});await assert.rejects(h.actions.deleteTourismItemAction(form()), /warning=/);assert.deepEqual(h.removed,[oldPath,oldPath]);
});
