import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateBootstrapManifest, contentAssetPath, ownedLocalAsset, ensureCatalogAirport } from '../../scripts/hotel-bootstrap-core.mjs';

const manifest = JSON.parse(readFileSync('docs/bootstrap/bugan-recife-20261028.json','utf8'));
const read = (p: string) => readFileSync(p,'utf8');

test('approved manifest covers all requested domains without fictional rooms, promotions or contact assumptions',()=>{
 validateBootstrapManifest(manifest);
 assert.equal(manifest.entries.filter((e: {domain:string})=>e.domain==='service').length,13);
 assert.equal(manifest.entries.filter((e: {domain:string})=>e.domain==='department').length,3);
 assert.equal(manifest.entries.filter((e: {domain:string})=>e.domain==='policy').length,2);
 assert.equal(manifest.entries.filter((e: {domain:string})=>e.domain==='tourism').length,2);
 assert.equal(manifest.media.length,4);
 assert.equal(manifest.expectedStatus,'suspended');
 assert.doesNotMatch(JSON.stringify(manifest), /whatsapp_number|wifi_password|roomToken|R\$35|promo[cç][aã]o/i);
 for(const slot of manifest.media) assert.doesNotMatch(slot.file,/golden|mockup/);
});
test('manifest rejects duplicate keys, unknown domains and an asset outside the approved image types',()=>{
 const copy=structuredClone(manifest);copy.entries.push(copy.entries[0]);assert.throws(()=>validateBootstrapManifest(copy));
 const unknown=structuredClone(manifest);unknown.entries[0].domain='profiles';assert.throws(()=>validateBootstrapManifest(unknown));
 for(const file of ['../.env.local','golden-master.png','logo.svg']){
  const copy=structuredClone(manifest);copy.media[0].file=file;assert.throws(()=>validateBootstrapManifest(copy));
  assert.throws(()=>ownedLocalAsset('docs',file));
 }
});
test('content-addressed paths are deterministic, tenant/slot scoped and cannot accept arbitrary prefixes',()=>{
 const id=manifest.hotelId,bytes=Buffer.from('synthetic');
 const path=contentAssetPath(id,'hero',bytes,'webp');
 assert.equal(path,contentAssetPath(id,'hero',bytes,'webp'));
 assert.match(path,new RegExp('^'+id+'/hero/hero/[0-9a-f-]+\\.webp$'));
 assert.notEqual(path,contentAssetPath(id,'about',bytes,'webp'));
 assert.throws(()=>contentAssetPath(id,'../../profiles',bytes,'webp'));
});
test('catalog registration is insert-only, verifies concurrent outcome and rejects drift',async()=>{
 const rows: Record<string, unknown>[]=[];let writes=0;
 const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:rows[0]||null,error:null})})}),insert:async(value: Record<string,unknown>)=>{writes++;if(!rows.length)rows.push({id:'rec',...value});return {};}})};
 assert.equal(await ensureCatalogAirport(client,manifest.airport),'rec');
 assert.equal(await ensureCatalogAirport(client,manifest.airport),'rec');
 assert.equal(writes,1);
 const changed={...manifest.airport,latitude:0};await assert.rejects(ensureCatalogAirport(client,changed),/conflict/);
 assert.equal(writes,1);
});
test('bootstrap uses real password authentication, never impersonates or deletes and keeps credentials off command arguments',()=>{
 const runner=read('scripts/bootstrap-hotel.mjs'),wrapper=read('scripts/bootstrap-hotel.ps1');
 assert.match(runner,/signInWithPassword\(credentials\)/);
 assert.match(runner,/profile\?\.hotel_id!==manifest.hotelId/);
 assert.match(runner,/upsert:false/);
 assert.match(runner,/apply_current_hotel_bootstrap/);
 assert.match(runner,/translation-service.ts/);
 assert.match(runner,/scope:'local'/);
 assert.doesNotMatch(runner,/generateLink|auth\.admin|set_config|\.remove\(/);
 assert.match(wrapper,/Read-Host.*-AsSecureString/);
 assert.match(wrapper,/\$credentials \| & node/);
 assert.doesNotMatch(wrapper,/Write-.*\$credentials|--password|SetEnvironmentVariable|Out-File/);
});
test('SQL bootstrap reuses canonical tourism/media, preserves human edits and never changes profiles, entitlements or lifecycle',()=>{
 const sql=read('supabase/migrations/20261028105402_hotel_bootstrap_and_slug.sql');
 assert.match(sql,/save_current_hotel_tourism_item\(null,values_json\)/);
 assert.match(sql,/update_current_hotel_experience_media\(item_key,0,values_json\)/);
 assert.match(sql,/save_current_hotel_tourism_translation/);
 assert.match(sql,/bootstrap_admin_edit_conflict/);
 assert.match(sql,/for update/);
 assert.match(sql,/hotel_admin_required/);
 assert.match(sql,/platform_status in\('draft','suspended'\)/);
 assert.doesNotMatch(sql,/update public.profiles|insert into public.profiles|update public.hotel_module_entitlements|set platform_status|request.jwt/);
 assert.match(sql,/revoke all.*apply_current_hotel_bootstrap.*from public,anon,authenticated,service_role/);
 assert.match(sql,/public\.record_admin_audit_event\(auth.uid\(\)/);
});
test('slug alias is private and only resolves active, entitled public hotels',()=>{
 const sql=read('supabase/migrations/20261028105402_hotel_bootstrap_and_slug.sql');
 assert.match(sql,/alter table public.hotel_slug_aliases enable row level security/);
 assert.match(sql,/is_hotel_publicly_active\(h.id\)/);
 assert.match(sql,/protect_hotel_slug_alias before insert or update of slug/);
 assert.match(sql,/hotel_slug_revision_conflict/);
 const source=read('lib/public-hotel-data.ts');assert.match(source,/resolve_public_hotel_slug/);
 assert.match(source,/\.from\('public_hotels'\)/);
});

test('suspended preview requires administrator cookie session, own tenant and entitlements without bypassing public RLS',()=>{
 const preview=read('lib/authenticated-hotel-preview.ts');
 assert.match(preview,/requireAdminAccess\('administrador'\)/);
 assert.match(preview,/requireHotelModule\('experience.preview'\)/);
 assert.match(preview,/requireHotelModule\('core.directory'\)/);
 assert.match(preview,/\.eq\('id',profile.hotel_id\)/);
 assert.doesNotMatch(preview,/createAdminClient|service_role|request.jwt|hotelId.*searchParams/);
 const route=read('app/preview/page.tsx');
 assert.match(route,/force-dynamic/);
 assert.match(route,/activeRoomContext=\{null\}/);
 assert.doesNotMatch(route,/hotel_id|roomToken|previewPreset/);
 assert.match(read('components/public/public-analytics.tsx'),/window.location.pathname === '\/preview'/);
});

test('complete CLI consumes private stdin, runs both data phases and reports provider fallback without any network',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {mkdtempSync,writeFileSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {randomUUID}=await import('node:crypto');
 const temporary=mkdtempSync(join(tmpdir(),'libguest-bootstrap-test-'));
 const testManifest=structuredClone(manifest);
 testManifest.hotelId='52100000-0000-4000-8000-000000000091';
 testManifest.publicOrigin='https://bootstraptest.libguest.digital';
 // Header-only synthetic image fixtures; never substitute these for hotel assets.
 const png=new Uint8Array(33);png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
 new DataView(png.buffer).setUint32(16,32);new DataView(png.buffer).setUint32(20,24);png[24]=8;png[25]=6;
 for(const media of testManifest.media){media.file='fixture-'+media.key+'.png';writeFileSync(join(temporary,media.file),png);}
 testManifest.logo='fixture-logo.png';writeFileSync(join(temporary,testManifest.logo),png);
 const fixture=join(temporary,'manifest.json');
 writeFileSync(fixture,JSON.stringify(testManifest));
 const password=randomUUID();
 const child=spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--conditions=react-server','--import','./tests/security/fixtures/bootstrap-sdk.mjs','scripts/bootstrap-hotel.mjs','--manifest',fixture,'--media-root',temporary],{
  input:JSON.stringify({email:'synthetic@example.invalid',password}),encoding:'utf8',timeout:30000,
  env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`https://${manifest.projectRef}.supabase.co`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',GOOGLE_CLOUD_TRANSLATION_API_KEY:''},
 });
 assert.equal(child.status,0,child.stdout+child.stderr);
 assert.match(child.stdout,/bootstrap_confirmed/);
 assert.match(child.stdout,/"entries": 21/);
 assert.match(child.stdout,/"media": 4/);
 assert.match(child.stdout,/"translationsPending": 48/);
 assert.equal((child.stdout+child.stderr).includes(password),false);
});