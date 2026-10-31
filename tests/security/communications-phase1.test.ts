/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic PostgREST and VM fixtures remain entirely in memory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setCommunicationStatus } from '../../lib/communications/status.ts';
import * as editorial from '../../lib/communications/editorial.ts';
import * as access from '../../lib/communications/access.ts';
import * as forms from '../../lib/form-utils.ts';
import { isUuid } from '../../lib/security/identifiers.ts';
import { evaluateCommunicationEditorialGate, KNOWN_DEMO_COMMUNICATIONS, BUGAN_DEMO_HOTEL_ID } from '../../lib/communications/editorial-gate.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const hotelId = '11111111-1111-4111-8111-111111111111', otherHotel = '22222222-2222-4222-8222-222222222222', id = '33333333-3333-4333-8333-333333333333', version = '2026-10-31T10:00:00.123456+00:00';
type Row = Record<string, any>; // isolated PostgREST simulator, never constructs a real client
function lab(options: {
    kind?: 'banner' | 'announcement';
    role?: string;
    profileActive?: boolean;
    module?: boolean;
    audit?: boolean;
    failure?: boolean;
    throwBefore?: boolean;
    throwAfter?: boolean;
    missing?: boolean;
    tenant?: string;
    beforeMutation?: () => void;
} = {}) {
    const kind = options.kind ?? 'announcement', table = access.communicationTable(kind), row: Row = { id, hotel_id: options.tenant ?? hotelId, title: 'Aviso legítimo', body: 'Orientação', subtitle: 'Resumo', cta_label: 'Detalhes', cta_url: null, category: 'informativo', image_url: 'old-owned.jpg', is_active: true, updated_at: version, starts_at: null, ends_at: null, display_order: 0 };
    const records: Row[] = options.missing ? [] : [row], events: Row[] = [], mutations: Row[] = [], assets: string[][] = [];
    const data: Record<string, Row[]> = { [table]: records, profiles: [{ hotel_id: hotelId, role: options.role ?? 'operador', is_active: options.profileActive !== false }], hotels: [{ platform_status: 'active' }] };
    let translations = 0;
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) }, rpc: async () => ({ data: options.module === false ? [] : [{ module_key: kind === 'banner' ? 'content.banners' : 'content.announcements', is_enabled: true }], error: null }), storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://fixture.invalid/new.jpg' } }) }) }, from(name: string) {
            let patch: Row | undefined, remove = false, one = false, inserting = false;
            const filters: [
                string,
                unknown
            ][] = [];
            const q = { select() { return q; }, eq(k: string, v: unknown) { filters.push([k, v]); return q; }, single() { one = true; return q; }, maybeSingle() { one = true; return q; }, update(v: Row) { patch = v; return q; }, delete() { remove = true; return q; }, insert(v: Row) { inserting = true; patch = v; return q; }, then(resolve: (value: unknown) => unknown) {
                    if (patch || remove) {
                        if (options.throwBefore)
                            throw new Error('private network failure');
                        options.beforeMutation?.();
                        mutations.push({ patch, filters, remove });
                        if (options.failure)
                            return Promise.resolve({ data: null, error: { message: 'private database internals', code: '08006' } }).then(resolve);
                    }
                    let rows = (data[name] ?? []).filter(r => filters.every(([k, v]) => k === 'id' && name === 'profiles' || k === 'id' && name === 'hotels' || r[k] === v));
                    if (inserting) {
                        const created = { ...row, ...patch, id: '44444444-4444-4444-8444-444444444444' };
                        (data[name] ??= []).push(created);
                        rows = [created];
                    }
                    if (patch)
                        for (const r of rows)
                            Object.assign(r, patch);
                    if(options.throwAfter&&(patch||remove))throw new Error('private lost response');
                    if (remove)
                        for (const r of rows)
                            records.splice(records.indexOf(r), 1);
                    return Promise.resolve({ data: one ? rows[0] ? structuredClone(rows[0]) : null : structuredClone(rows), error: null }).then(resolve);
                } };
            return q;
        } };
    const audit = async (event: Row) => { events.push(event); return options.audit !== false; };
    const input = { kind, id, hotelId, expectedUpdatedAt: version, changes: { title: 'Novo título' } };
    function load(file: string) {
        const mod = { exports: {} as Record<string, (...args: any[]) => Promise<unknown>> };
        const deps: Record<string, unknown> = { '@/lib/communications/editorial': editorial, '@/lib/communications/access': access, '@/lib/communications/status': { setCommunicationStatus }, '@/lib/audit': { recordAdminAuditEvent: audit }, '@/lib/auth': { requireAdminAccess: async () => ({ user: { id: 'actor' } }) }, '@/lib/admin-entitlements': { requireHotelModule: async () => { } }, '@/lib/form-utils': forms, '@/lib/queries': { getAdminHotel: async () => ({ id: hotelId, slug: 'fixture' }) }, '@/lib/security/identifiers': { isUuid }, '@/lib/supabase/server': { createClient: async () => client }, '@/lib/supabase/admin': { createAdminClient: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }), remove: async (paths: string[]) => { assets.push(Array.from(paths)); return { error: null }; } }) } }) }, '@/lib/security/image-upload': { buildHotelAssetStoragePath: () => 'new-owned.jpg', extractOwnedHotelAssetPath: ({ publicUrl }: {
                    publicUrl: string;
                }) => publicUrl === 'old-owned.jpg' ? 'old-owned.jpg' : null, IMAGE_UPLOAD_POLICIES: { banner: {} }, validateImageUpload: async () => ({ ok: true, value: { bytes: new Uint8Array([1]), mimeType: 'image/jpeg', extension: 'jpg' } }) }, 'next/cache': { revalidatePath: () => { } }, 'next/navigation': { redirect: (url: string) => { throw Object.assign(new Error('redirect'), { url }); } }, '@/lib/services/translation-admin': { buildFeedbackRedirect: (path: string, feedback: Record<string, string>) => path + '?' + new URLSearchParams(feedback), buildOperationalErrorMessage: () => 'Falha não confirmada', formatTranslationWarning: () => undefined, logOperationalError: () => { }, syncAnnouncementTranslations: async () => { translations++; return {}; }, syncPromotionalBannerTranslations: async () => { translations++; return {}; } } };
        runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: mod.exports, module: mod, require: (name: string) => {
                if (!(name in deps))
                    throw new Error('Unexpected dependency ' + name);
                return deps[name];
            }, FormData, File, URL, encodeURIComponent, console });
        return mod.exports;
    }
    return { client: client as unknown as SupabaseClient, row, records, events, mutations, audit, input, load, assets, translations: () => translations };
}
for (const kind of ['announcement', 'banner'] as const) {
    test(kind + ': stale active editor cannot reactivate a record disabled in another session', async () => {
        const l = lab({ kind });
        await setCommunicationStatus(l.client, { kind, id, isActive: false, expectedUpdatedAt: version }, l.audit);
        await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, l.input, l.audit), /PT409/);
        assert.equal(l.row.is_active, false);
        assert.equal(l.row.title, 'Aviso legítimo');
        assert.equal(l.events.length, 1);
        assert.equal(l.mutations[1].filters.some(([key, value]: [
            string,
            unknown
        ]) => key === 'updated_at' && value === version), true);
    });
    for (const operation of ['content', 'translations', ...(kind === 'banner' ? ['image'] : [])] as const)
        test(kind + ': ' + operation + ' preserves status', async () => {
            const l = lab({ kind });
            l.row.is_active = false;
            const changes = operation === 'content' ? { title: 'Título', ...(kind === 'banner' ? { cta_url: 'https://example.invalid', display_order: 2 } : { body: 'Nova mensagem', starts_at: '2026-10-31T11:00:00Z' }) } : operation === 'image' ? { image_url: 'https://example.invalid/picture.jpg' } : {};
            await editorial.updateCommunicationEditorial(l.client, { ...l.input, changes, operation: operation as 'content' | 'image' | 'translations' }, l.audit);
            assert.equal(l.row.is_active, false);
            assert.ok(!('is_active' in l.mutations[0].patch));
            assert.equal(l.events.length, 1);
        });
    test(kind + ': forged editorial identity/status/version columns are rejected before writing', async () => {
        for (const key of ['is_active', 'hotel_id', 'id', 'updated_at', 'published_at']) {
            const l = lab({ kind });
            await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, { ...l.input, changes: { [key]: true } }, l.audit), /invalid_editorial_fields/);
            assert.equal(l.mutations.length, 0);
            assert.equal(l.events.length, 0);
        }
    });
    test(kind + ': authorized explicit activation remains available to operator', async () => { const l = lab({ kind }); l.row.is_active = false; await setCommunicationStatus(l.client, { kind, id, isActive: true, expectedUpdatedAt: version }, l.audit); assert.equal(l.row.is_active, true); assert.equal(l.events[0].action, kind + '.activated'); });
    for (const options of [{ role: 'visualizador' }, { profileActive: false }, { module: false }, { tenant: otherHotel }])
        test(kind + ': rejects unauthorized/foreign write ' + JSON.stringify(options), async () => { const l = lab({ kind, ...options }); await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, l.input, l.audit)); await assert.rejects(() => setCommunicationStatus(l.client, { kind, id, isActive: false, expectedUpdatedAt: version }, l.audit)); assert.equal(l.row.title, 'Aviso legítimo'); assert.equal(l.row.is_active, true); assert.equal(l.events.length, 0); });
    test(kind + ': explicit foreign tenant rejected before mutation', async () => { const l = lab({ kind }); await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, { ...l.input, hotelId: otherHotel }, l.audit), /authorization_required/); assert.equal(l.mutations.length, 0); });
    test(kind + ': simultaneous saves accept exactly one; old request replay fails', async () => { const l = lab({ kind }), outcomes = await Promise.allSettled([editorial.updateCommunicationEditorial(l.client, l.input, l.audit), editorial.updateCommunicationEditorial(l.client, { ...l.input, changes: { title: 'Concorrente' } }, l.audit)]); assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, l.input, l.audit), /PT409/); assert.equal(l.events.length, 1); assert.equal(l.row.title, 'Novo título'); });
    test(kind + ': race immediately before mutation cannot overwrite deactivation', async () => { const l = lab({ kind, beforeMutation: () => { l.row.updated_at = '2026-10-31T10:01:00Z'; l.row.is_active = false; } }); await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, l.input, l.audit), /PT409/); assert.equal(l.row.is_active, false); assert.equal(l.row.title, 'Aviso legítimo'); assert.equal(l.events.length, 0); });
    test(kind + ': missing version, missing record, failed write and audit failure have distinct safe outcomes', async () => {
        for (const token of ['', undefined, 'not a timestamp']) {
            const l = lab({ kind });
            await assert.rejects(() => editorial.updateCommunicationEditorial(l.client, { ...l.input, expectedUpdatedAt: token as string }, l.audit), /version_required/);
            assert.equal(l.mutations.length, 0);
        }
        const missing = lab({ kind, missing: true });
        await assert.rejects(() => editorial.updateCommunicationEditorial(missing.client, missing.input, missing.audit), /record_unavailable/);
        const failed = lab({ kind, failure: true });
        await assert.rejects(() => editorial.updateCommunicationEditorial(failed.client, failed.input, failed.audit), /content_update_unconfirmed/);
        assert.equal(failed.events.length, 0);
        assert.equal(failed.row.title, 'Aviso legítimo');
        const audit = lab({ kind, audit: false });
        await assert.rejects(() => editorial.updateCommunicationEditorial(audit.client, audit.input, audit.audit), /write_audit_unconfirmed/);
        assert.equal(audit.row.title, 'Novo título');
        assert.equal(audit.mutations.length, 1);
        assert.match(editorial.communicationFailureMessage(new Error('private db text')), /Não foi possível/);
    });
    test(kind + ': versioned deletion rejects an obsolete request', async () => { const l = lab({ kind }); l.row.updated_at = '2026-11-01T00:00:00Z'; await assert.rejects(() => editorial.deleteCommunication(l.client, l.input, l.audit), /PT409/); assert.equal(l.records.length, 1); assert.equal(l.events.length, 0); });
    test(kind + ': actual Server Action ignores stale checkbox and reports conflict instead of success', async () => {
        const l = lab({ kind }), folder = kind === 'banner' ? 'banners' : 'comunicados', action = kind === 'banner' ? 'updatePromotionalBannerAction' : 'updateAnnouncementAction', actions = l.load('app/admin/' + folder + '/[id]/actions.ts'), form = new FormData();
        form.set('title', 'Formulário antigo');
        form.set('is_active', 'on');
        form.set('expected_updated_at', version);
        l.row.is_active = false;
        l.row.updated_at = '2026-10-31T11:00:00Z';
        await assert.rejects(() => actions[action](id, form), (e: any) => { const url = new URL(e.url, 'https://fixture.invalid'); assert.ok(url.searchParams.get('error')?.includes('Recarregue')); assert.equal(url.searchParams.has('success'), false); return true; });
        assert.equal(l.row.is_active, false);
        assert.equal(l.translations(), 0);
        assert.equal(l.events.length, 0);
    });
    test(kind + ': actual Server Action saves content and preserves inactive state even if is_active was forged', async () => { const l = lab({ kind }), folder = kind === 'banner' ? 'banners' : 'comunicados', action = kind === 'banner' ? 'updatePromotionalBannerAction' : 'updateAnnouncementAction', actions = l.load('app/admin/' + folder + '/[id]/actions.ts'), form = new FormData(); form.set('title', 'Novo'); form.set('is_active', 'on'); form.set('expected_updated_at', version); l.row.is_active = false; await assert.rejects(() => actions[action](id, form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('success')); assert.equal(l.row.is_active, false); assert.equal(l.row.title, 'Novo'); assert.equal(l.events[0].action, kind + '.updated'); assert.equal(l.translations(), 1); });
}
test('version always advances, including same-millisecond writes and six-digit persisted precision', () => { const t = '2026-10-31T10:00:00.123Z'; assert.equal(access.nextCommunicationVersion(t, Date.parse(t)), '2026-10-31T10:00:00.124Z'); assert.ok(Date.parse(access.nextCommunicationVersion(version, 0)) > Date.parse(version)); });
for (const options of [{ audit: false }, { failure: true }, { beforeMutation: true }])
    test('upload retains linked/ambiguous assets, cleans only rejected upload ' + JSON.stringify(options), async () => {
        const l = lab({ kind: 'banner', audit: 'audit' in options ? false : true, failure: 'failure' in options, beforeMutation: 'beforeMutation' in options ? () => { l.row.updated_at = '2026-10-31T11:00:00Z'; l.row.is_active = false; } : undefined }), actions = l.load('app/admin/banners/upload-image-action.ts'), form = new FormData();
        form.set('banner_id', id);
        form.set('expected_updated_at', version);
        form.set('image', new File(['fixture'], 'x.jpg', { type: 'image/jpeg' }));
        await assert.rejects(() => actions.uploadPromotionalBannerImageAction(form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('error'));
        assert.equal(l.assets.flat().includes('old-owned.jpg'), false);
        if ('beforeMutation' in options) {
            assert.deepEqual(l.assets, [['new-owned.jpg']]);
            assert.equal(l.row.is_active, false);
        }
        else
            assert.deepEqual(l.assets, []);
    });
const now = Date.parse('2026-10-31T12:00:00Z');
function gate(rows: Row[], functionalPassed = true, tenant = BUGAN_DEMO_HOTEL_ID) { return evaluateCommunicationEditorialGate({ hotelId: tenant, announcements: rows.filter(r => r.kind === 'announcement') as never, banners: rows.filter(r => r.kind === 'banner') as never, now, functionalPassed }); }
function demo(index = 0, changes: Row = {}) { return { ...KNOWN_DEMO_COMMUNICATIONS[index], hotel_id: BUGAN_DEMO_HOTEL_ID, is_active: true, title: 'TESTE', category: 'informativo', body: 'Aviso', starts_at: null, ends_at: null, ...changes }; }
for (const change of [{ is_active: false }, { ends_at: '2026-10-30T00:00:00Z' }, { starts_at: '2026-11-01T00:00:00Z' }, { hotel_id: otherHotel }, { starts_at: 'invalid' }])
    test('editorial gate excludes ineligible identity ' + JSON.stringify(change), () => { assert.equal(gate([demo(0, change)]).editorial, 'green'); });
test('all seven known IDs remain detectable after rename, independent of functional GO', () => {
    for (let index = 0; index < 7; index++) {
        const result = gate([demo(index, { title: 'Campanha renomeada' })]);
        assert.equal(result.functional, 'green');
        assert.equal(result.editorial, 'red');
        assert.equal(result.violations[0].id, KNOWN_DEMO_COMMUNICATIONS[index].id);
    }
});
test('legitimate teste text is allowed and other tenants are isolated', () => { assert.equal(gate([demo(0, { id, title: 'Teste de qualidade da água' })]).editorial, 'green'); assert.equal(gate([demo()], true, otherHotel).editorial, 'green'); });
test('fresh editorial snapshot catches identity created after the preceding functional smoke', () => { assert.equal(gate([]).editorial, 'green'); const later = gate([demo(6, { created_at: '2026-10-31T11:59:00Z' })]); assert.equal(later.functional, 'green'); assert.equal(later.editorial, 'red'); });
for (const kind of ['announcement', 'banner'] as const) {
    const folder = kind === 'banner' ? 'banners' : 'comunicados', create = kind === 'banner' ? 'createPromotionalBannerAction' : 'createAnnouncementAction', retranslate = kind === 'banner' ? 'retranslatePromotionalBannerAction' : 'retranslateAnnouncementAction', toggle = kind === 'banner' ? 'togglePromotionalBannerAction' : 'toggleAnnouncementAction';
    for (const active of [true, false])
        test(kind + ': actual creation preserves explicit initial status ' + active, async () => {
            const l = lab({ kind }), actions = l.load('app/admin/' + folder + '/actions.ts'), form = new FormData();
            form.set('title', 'Conteúdo isolado');
            if (active)
                form.set('is_active', 'on');
            await assert.rejects(() => actions[create](form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('success'));
            assert.equal(l.records[1].is_active, active);
            assert.equal(l.events[0].action, kind + '.created');
        });
    test(kind + ': actual creation reports audit failure after confirmed insert without retry', async () => { const l = lab({ kind, audit: false }), actions = l.load('app/admin/' + folder + '/actions.ts'), form = new FormData(); form.set('title', 'Conteúdo isolado'); await assert.rejects(() => actions[create](form), (e: any) => { const u = new URL(e.url, 'https://fixture.invalid'); assert.ok(u.searchParams.get('error')?.includes('foi gravada')); assert.equal(u.searchParams.has('success'), false); return true; }); assert.equal(l.records.length, 2); assert.equal(l.mutations.length, 1); assert.equal(l.translations(), 0); });
    test(kind + ': actual retranslation claims source version and preserves inactive status', async () => { const l = lab({ kind }), actions = l.load('app/admin/' + folder + '/actions.ts'), form = new FormData(); l.row.is_active = false; form.set('id', id); form.set('expected_updated_at', version); await assert.rejects(() => actions[retranslate](form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('success')); assert.equal(l.translations(), 1); assert.equal(l.row.is_active, false); assert.deepEqual(Object.keys(l.mutations[0].patch), ['updated_at']); await assert.rejects(() => actions[retranslate](form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('error')); assert.equal(l.translations(), 1); });
    test(kind + ': actual status form requires captured version and activates explicitly', async () => { const l = lab({ kind }), actions = l.load('app/admin/' + folder + '/actions.ts'), form = new FormData(); l.row.is_active = false; form.set('id', id); form.set('is_active', 'true'); await assert.rejects(() => actions[toggle](form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('error')); assert.equal(l.mutations.length, 0); form.set('expected_updated_at', version); await assert.rejects(() => actions[toggle](form), (e: any) => new URL(e.url, 'https://fixture.invalid').searchParams.has('success')); assert.equal(l.row.is_active, true); assert.equal(l.events[0].action, kind + '.activated'); });
}
for (const kind of ['announcement', 'banner'] as const)
    test(kind + ': translated response already stale is discarded before child upsert', async () => {
        const l = lab({ kind }), mod = { exports: {} as Record<string, (value: unknown) => Promise<any>> };
        let writes = 0;
        const client = { from: (table: string) => table.endsWith('_translations') ? { upsert: async () => { writes++; return { error: null }; } } : l.client.from(table) };
        const translator = async () => { l.row.updated_at = '2026-11-01T00:00:00Z'; return { title: 'Translated', body: 'Message', subtitle: 'Summary', cta_label: 'More' }; };
        const deps: Record<string, unknown> = { '@/lib/services/operational-logger': { logOperationalError: () => { } }, '@/lib/admin-entitlements': {}, '@/lib/tourism/translations': {}, '@/lib/services/translation-service': { translateAnnouncementFields: translator, translatePromotionalBannerFields: translator } };
        runInNewContext(ts.transpileModule(readFileSync('lib/services/translation-admin.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: mod.exports, module: mod, require: (name: string) => {
                if (!(name in deps))
                    throw Error(name);
                return deps[name];
            }, URL, Date, encodeURIComponent, console });
        const fn = kind === 'banner' ? 'syncPromotionalBannerTranslations' : 'syncAnnouncementTranslations';
        const result = await mod.exports[fn]({ supabase: client, [kind === 'banner' ? 'bannerId' : 'announcementId']: id, hotelId, expectedParentVersion: version, fields: { title: 'PT', body: 'Mensagem', subtitle: 'Resumo', cta_label: 'Detalhes' } });
        assert.equal(writes, 0);
        assert.equal(result.status, 'failed');
        assert.equal(l.row.is_active, true);
    });
test('editorial audit metadata conforms to the existing shallow scalar RPC contract', async () => {
    const l = lab({ kind: 'banner' });
    await editorial.updateCommunicationEditorial(l.client, l.input, l.audit);
    const event = l.events[0];
    assert.match(event.requestId, /^[0-9a-f-]{36}$/);
    assert.ok(JSON.stringify(event.metadata).length < 2048);
    for (const value of Object.values(event.metadata))
        assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    assert.equal(event.metadata.submitted_fields, 'title');
});
for (const after of [false, true])
    test('actual edit handles thrown network ' + (after ? 'after commit' : 'before commit') + ' without success/retry or leaked details', async () => {
        const l = lab({ throwBefore: !after, throwAfter: after }), actions = l.load('app/admin/comunicados/[id]/actions.ts'), form = new FormData();
        form.set('title', 'Novo');
        form.set('expected_updated_at', version);
        await assert.rejects(() => actions.updateAnnouncementAction(id, form), (e: any) => { const url = new URL(e.url, 'https://fixture.invalid'); assert.equal(url.searchParams.has('success'), false); assert.ok(url.searchParams.get('error')?.includes('Não foi possível confirmar')); assert.ok(!e.url.includes('private')); return true; });
        assert.equal(l.row.title, after ? 'Novo' : 'Aviso legítimo');
        assert.equal(l.events.length, 0);
        assert.equal(l.translations(), 0);
        assert.equal(l.mutations.length, after ? 1 : 0);
    });
test('permission query errors are mapped to a safe authorization failure', () => { assert.throws(() => access.communicationQueryFailure({ code: '42501' }, 'content_update_unconfirmed'), (error: any) => error.status === 403 && editorial.communicationFailureMessage(error).includes('autorizar')); });
