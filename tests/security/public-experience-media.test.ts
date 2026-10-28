import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cleanupExperienceMedia, experienceHttpsUrl, experienceMediaUrl, focalPosition, ownedExperienceMediaPath } from '../../lib/public-experience-media.ts';
import { buildHotelSubdomainPreviewUrl, normalizeHotelSubdomainInput } from '../../lib/hotel-subdomain.ts';
const hotel='b0600000-0000-4000-8000-000000000001';
const other='b0600000-0000-4000-8000-000000000002';
const path=`${hotel}/hero/hero/b0600000-0000-4000-8000-000000000003.png`;
const read=(p:string)=>readFileSync(p,'utf8');
test('media paths are scoped to hotel and placement, never browser URLs or traversal',()=>{
  assert.ok(ownedExperienceMediaPath(path,hotel,'hero'));
  for(const bad of [path.replace(hotel,other),path.replace('/hero/hero/','/hero/about/'),path+'.svg',path+'/../x','https://example.test/'+path]) assert.equal(ownedExperienceMediaPath(bad,hotel,'hero'),false);
  assert.equal(experienceMediaUrl(path,other,'hero','https://example.test'),null);
  assert.equal(experienceMediaUrl(path,hotel,'hero','https://example.test/'),`https://example.test/storage/v1/object/public/hotel-assets/${path}`);
});
test('normalized focal points clamp invalid persisted coordinates safely',()=>{
  assert.equal(focalPosition(25,80),'25% 80%'); assert.equal(focalPosition(-2,101),'0% 100%'); assert.equal(focalPosition(NaN,Infinity),'50% 50%');
});
test('links require HTTPS and never expose credentials',()=>{
  for(const value of ['javascript:alert(1)','http://example.test','#','https://user:pass@example.test']) assert.equal(experienceHttpsUrl(value),null);
  assert.equal(experienceHttpsUrl('https://example.test/book'),'https://example.test/book');
});
test('cleanup preserves current desktop/mobile shared references and bounds retries',async()=>{
  const removed:string[]=[]; const logs:string[]=[];
  const io={hotelId:hotel,slot:'hero' as const,paths:[path,path],currentPaths:[path],remove:async(p:string)=>{removed.push(p);return {error:Error()};},log:(p:string)=>logs.push(p)};
  assert.equal(await cleanupExperienceMedia(io),true); assert.equal(removed.length,0);
  assert.equal(await cleanupExperienceMedia({...io,currentPaths:[]}),false); assert.equal(removed.length,2); assert.deepEqual(logs,[path]);
  removed.length=0; assert.equal(await cleanupExperienceMedia({...io,paths:[path.replace(hotel,other)],currentPaths:[]}),false); assert.equal(removed.length,0);
});
test('administrative media association derives tenant, validates files before upload, and conservatively handles uncertainty',()=>{
  const source=read('app/admin/hotel/experience-media-actions.ts');
  assert.match(source,/requireAdminAccess\('editor'\)/); assert.match(source,/requireHotelModule\('experience.appearance'\)/);
  assert.doesNotMatch(source,/form.get\('hotel_id'\)|form.get\('image_path'\)|upsert: true/);
  assert.match(source,/upsert: false/); assert.match(source,/update_current_hotel_experience_media/);
  assert.ok(source.indexOf('validateImageUpload(file')<source.indexOf('storage.upload('));
  assert.match(source,/Resposta incerta. Nenhum arquivo foi removido/); assert.match(source,/code === 'PT409'/);
});
test('media SQL has no auto-enablement, no browser writes, tenant RPC, revision, audit and least privilege',()=>{
  const sql=read('supabase/migrations/20261028034907_public_experience_media_v3.sql');
  assert.match(sql,/enable row level security/); assert.match(sql,/is_published and public.is_hotel_publicly_active/);
  assert.match(sql,/has_active_hotel_role\(target,'editor'\)/); assert.match(sql,/errcode='PT409'/); assert.match(sql,/record_admin_audit_event/);
  assert.match(sql,/security definer set search_path=''/); assert.match(sql,/previous.image_path,previous.mobile_image_path/);
  assert.doesNotMatch(sql,/insert into public.hotel_module_entitlements|grant (insert|update|delete)|create policy.*storage|truncate|drop table/i);
});
test('V3 uses shared Tourism and makes optional modules conditional without new dock keys',()=>{
  const source=read('components/public/public-experience-overview.tsx');
  assert.match(source,/pageData.tourismHomeAvailable/); assert.match(source,/flightHomeCard \?/); assert.doesNotMatch(source,/PublicBottomDock/);
  assert.match(source,/row.hotel_id === hotel.id && row.is_published/);
  assert.doesNotMatch(source,/createAdminClient|fetch\(|roomToken|wifi_password|buganrecife.libguest/);
  assert.match(read('lib/public-hotel-data.ts'),/loadPublicTourism\(supabase, hotel, language\)/);
});
test('approved hostname uses generic normalization and URL generation',()=>{
  assert.equal(normalizeHotelSubdomainInput(' BUGANRECIFE '),'buganrecife');
  assert.equal(buildHotelSubdomainPreviewUrl('buganrecife'),'buganrecife.libguest.digital');
});
