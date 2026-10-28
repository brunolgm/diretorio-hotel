import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {parsePublicPresentation,editorialText,emptyPresentation,ownedEditorialImage} from '../../lib/public-presentation.ts';
const manifest=JSON.parse(readFileSync('docs/bootstrap/bugan-public-v3-refinement-20261028.json','utf8'));
const h=manifest.hotelId;
test('approved editorials preserve PT and give field-level language fallback without providers',()=>{
 const config=parsePublicPresentation(manifest.configuration,h);assert.ok(config);
 assert.equal(config.benefits.length,4);assert.equal(config.tourism.cards.length,4);
 assert.equal(editorialText({pt:'Fonte',en:'',es:'Fuente'},'en'),'Fonte');
 assert.equal(parsePublicPresentation(emptyPresentation(),h)?.heroDesktopFocal,null);
});
test('rejects foreign paths, browser destinations, unknown fields and malformed config',()=>{
 for(const mutate of [
  (c:typeof manifest.configuration)=>{c.hotel_id='other';},
  (c:typeof manifest.configuration)=>{c.tourism.cards[0].image_path='https://example.test/photo.webp';},
  (c:typeof manifest.configuration)=>{c.tourism.cards[0].href='javascript:alert(1)';},
  (c:typeof manifest.configuration)=>{c.heroDesktopFocal.y=101;},
  (c:typeof manifest.configuration)=>{c.benefits[0].label.pt='<script>';},
 ]){const c=structuredClone(manifest.configuration);mutate(c);assert.equal(parsePublicPresentation(c,h),null);}
 assert.equal(parsePublicPresentation(null,h),null);assert.equal(ownedEditorialImage(manifest.assets[0].storagePath,'52100000-0000-4000-8000-000000000001'),false);
});
test('four assets are pixel-exact approved golden crops; no text, resize or generated pixels',async()=>{
 const sharp=createRequire(import.meta.url)('sharp');
 for(const a of manifest.assets){
  const bytes=readFileSync(a.path);assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
  const expected=await sharp(a.source).extract(a.crop).removeAlpha().raw().toBuffer();
  const actual=await sharp(a.path).removeAlpha().raw().toBuffer();assert.deepEqual(actual,expected);
  assert.ok(a.width<=149&&a.height===80);assert.ok(ownedEditorialImage(a.storagePath,h));
 }
});
test('schema exposes reads through RLS and authenticated revision RPC only, without auto-enablement',()=>{
 const sql=readFileSync('supabase/migrations/20261028230359_public_editorial_presentation.sql','utf8');
 assert.match(sql,/enable row level security/i);assert.match(sql,/is_hotel_publicly_active\(hotel_id\)/);
 assert.match(sql,/has_active_hotel_role\(target,'editor'\)/);assert.match(sql,/PT409/);assert.match(sql,/experience.presentation_updated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete)|insert into public\.hotel_module_entitlements|update public\.hotels/i);
 const action=readFileSync('app/admin/hotel/apresentacao/actions.ts','utf8');
 assert.match(action,/requireAdminAccess\('editor'\)/);assert.match(action,/upsert:false/);assert.doesNotMatch(action,/storage\.remove|form.get\('hotel_id'\)/);
});
