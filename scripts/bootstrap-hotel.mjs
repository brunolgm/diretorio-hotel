import './bootstrap-runtime.mjs';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateBootstrapManifest, ownedLocalAsset, contentAssetPath, ensureCatalogAirport } from './hotel-bootstrap-core.mjs';
import { PRIMARY_PRODUCT_ROOT_DOMAIN } from '../lib/product-domain.ts';
import { validateImageUpload, IMAGE_UPLOAD_POLICIES } from '../lib/security/image-upload.ts';

let stage='plan';
let client;
const args=process.argv.slice(2);
const arg=(key, fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
try {
 const manifest=validateBootstrapManifest(JSON.parse(readFileSync(resolve(arg('--manifest')),'utf8')));
 const mediaRoot=resolve(arg('--media-root'));
 const prepared=[];
 for(const [slot,filename] of [...(manifest.media||[]).map(m=>[m.key,m.file]),...(manifest.logo?[['logo',manifest.logo]]:[])]) {
  const bytes=readFileSync(ownedLocalAsset(mediaRoot,filename));
  const type=filename.endsWith('.webp')?'image/webp':filename.endsWith('.png')?'image/png':'image/jpeg';
  const validated=await validateImageUpload({size:bytes.length,type,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},slot==='logo'?IMAGE_UPLOAD_POLICIES.logo:{...IMAGE_UPLOAD_POLICIES.hero,maxBytes:2*1024*1024});
  if(!validated.ok)throw new Error('asset_validation_failed');
  if(manifest.assetSha256?.[filename] && createHash('sha256').update(bytes).digest('hex')!==manifest.assetSha256[filename])throw new Error('asset_checksum_conflict');
  prepared.push({slot,filename,bytes,type,path:contentAssetPath(manifest.hotelId,slot,bytes,validated.value.extension),sha256:createHash('sha256').update(bytes).digest('hex'),width:validated.value.width,height:validated.value.height});
 }
 if(args.includes('--plan')) {
  console.log(JSON.stringify({mode:'plan',hotelId:manifest.hotelId,namespace:manifest.namespace,entries:manifest.entries.length,assets:prepared.map(({slot,filename,bytes,width,height})=>({slot,filename,bytes:bytes.length,width,height})),requires:'normal authenticated administrator session; password entered locally',writes:false},null,2));
  process.exit(0);
 }
 if(existsSync('.env.local'))process.loadEnvFile('.env.local');
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(origin!==`https://${manifest.projectRef}.supabase.co`)throw new Error('project_mismatch');
 const admin=()=>createClient(origin,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 if(args.includes('--catalog-only')) {
  stage='catalog';
  const id=await ensureCatalogAirport(admin(),manifest.airport);
  console.log(JSON.stringify({catalog:'confirmed',iata:manifest.airport.iata_code,id,hotelWrites:false}));
  process.exit(0);
 }
 stage='authentication';
 let stdin='';for await(const chunk of process.stdin){stdin+=chunk;if(stdin.length>16384)throw new Error('invalid_credentials');}
 let credentials=JSON.parse(stdin);stdin='';
 client=createClient(origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const signIn=await client.auth.signInWithPassword(credentials);credentials=null;
 if(signIn.error||!signIn.data.user)throw new Error('login_failed');
 stage='authorization';
 const {data:profile,error:profileError}=await client.from('profiles').select('hotel_id,role,is_active').eq('id',signIn.data.user.id).single();
 if(profileError||profile?.hotel_id!==manifest.hotelId||!profile.is_active||!['administrador','admin','owner'].includes(profile.role))throw new Error('wrong_tenant_or_role');
 const {data:hotel,error:hotelError}=await client.from('hotels').select('*').eq('id',manifest.hotelId).single();
 if(hotelError||hotel.platform_status!==manifest.expectedStatus||!['draft','suspended'].includes(hotel.platform_status))throw new Error('wrong_lifecycle');
 stage='catalog';
 await ensureCatalogAirport(admin(),manifest.airport);
 stage='storage';
 const storage=admin().storage.from('hotel-assets');
 for(const asset of prepared) {
  const existing=await storage.download(asset.path);
  if(existing.data) {
   const sha=createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex');
   if(sha!==asset.sha256)throw new Error('asset_conflict');
  } else {
   const upload=await storage.upload(asset.path,asset.bytes,{contentType:asset.type,upsert:false});
   if(upload.error) {
    const confirmed=await storage.download(asset.path);
    if(!confirmed.data||createHash('sha256').update(Buffer.from(await confirmed.data.arrayBuffer())).digest('hex')!==asset.sha256)throw new Error('asset_upload_unconfirmed');
   }
  }
 }
 const hotelPatch={...manifest.hotel};
 const logo=prepared.find(a=>a.slot==='logo');
 if(logo)hotelPatch.logo_url=storage.getPublicUrl(logo.path).data.publicUrl;
 const apply=async(payload)=>{
  const result=await client.rpc('apply_current_hotel_bootstrap',{p_hotel_id:manifest.hotelId,p_namespace:manifest.namespace,p_manifest:payload});
  if(result.error||!Array.isArray(result.data))throw new Error('database_result_unconfirmed');
  return result.data;
 };
 stage='content';
 const entries=await apply({hotel:hotelPatch,slug:manifest.slug,entries:manifest.entries});
 const mediaEntries=(manifest.media||[]).map(m=>{
  const asset=prepared.find(a=>a.slot===m.key);
  const values={...m.values,image_path:asset.path};
  if(m.key==='hero')values.mobile_image_path=asset.path;
  if(m.serviceKey) {
   const target=entries.find(e=>e.key===m.serviceKey&&e.domain==='service');
   if(!target?.id)throw new Error('missing_service_link');
   const publicOrigin=new URL(manifest.publicOrigin);
   if(publicOrigin.origin!==`https://${hotel.subdomain}.${PRIMARY_PRODUCT_ROOT_DOMAIN}`||publicOrigin.username||publicOrigin.password||publicOrigin.pathname!=='/'||publicOrigin.search||publicOrigin.hash)throw new Error('public_origin_mismatch');
   values.cta_url=new URL(`/servicos/${target.id}`,publicOrigin).href;
  }
  return {key:m.key,domain:'media',values};
 });
 stage='media';const media=await apply({entries:mediaEntries});
 stage='translations';
 const translationModule=await import('../lib/services/translation-service.ts');
 const translators={media:{fn:translationModule.translateExperienceMediaFields,fields:['title','description','alt_text','cta_label'],table:'hotel_public_experience_media_translations',fk:'slot'},service:{fn:translationModule.translateSectionFields,fields:['title','content','cta','category'],table:'hotel_section_translations',fk:'section_id'},department:{fn:translationModule.translateDepartmentFields,fields:['name','description','action'],table:'hotel_department_translations',fk:'department_id'},policy:{fn:translationModule.translatePolicyFields,fields:['title','description'],table:'hotel_policy_translations',fk:'policy_id'},tourism:{fn:translationModule.translateTourismFields,fields:['name','short_description','full_description','opening_hours','price_info','duration_info'],table:'hotel_tourism_item_translations',fk:'item_id'}};
 const translations=[];
 for(const entry of [...manifest.entries,...(manifest.media||[]).map(m=>({...m,domain:'media'}))]) {
  const config=translators[entry.domain];if(!config)continue;
  const record=[...entries,...media].find(e=>e.key===entry.key);
  const baseQuery=client.from(config.table).select(['language',...config.fields].join(',')).eq(config.fk,entry.domain==='media'?entry.key:record.id);
  const existing=await (entry.domain==='media'?baseQuery.eq('hotel_id',manifest.hotelId):baseQuery);
  if(existing.error)throw new Error('translation_read_failed');
  for(const language of ['en','es']) {
   const existingTranslation=existing.data.find(t=>t.language===language);
   if(existingTranslation){const complete=config.fields.every(k=>!entry.values[k]||Boolean(existingTranslation[k]?.trim()));translations.push({key:entry.key,language,status:complete?'preserved':'pending_existing_partial'});continue;}
   const fields=Object.fromEntries(config.fields.map(k=>[k,entry.values[k]??null]));
   const translated=await config.fn(fields,language);
   if(!translated){translations.push({key:entry.key,language,status:'pending_provider'});continue;}
   const persisted=await client.rpc('apply_current_hotel_bootstrap_translation',{p_hotel_id:manifest.hotelId,p_namespace:manifest.namespace,p_key:entry.key,p_language:language,p_fields:translated});
   translations.push({key:entry.key,language,status:persisted.error?'pending_persistence':persisted.data?'created':'pending_existing_review'});
  }
 }
 stage='verification';
 const readiness=await client.rpc('get_current_hotel_readiness');
 const current=await client.from('hotels').select('id,name,slug,subdomain,platform_status,brand_code,theme_preset').eq('id',manifest.hotelId).single();
 if(current.error||current.data.platform_status!==manifest.expectedStatus)throw new Error('final_verification_failed');
 const report={hotel:current.data,entries,media,assets:prepared.map(({slot,path,sha256,width,height})=>({slot,path,sha256,width,height})),translations,readiness:readiness.error?{status:'unconfirmed'}:readiness.data,previewUrl:`https://${PRIMARY_PRODUCT_ROOT_DOMAIN}/preview`,visualReview:'pending_human_preview',roomInventory:'Necessaria lista real de UHs; nenhum quarto criado'};
 mkdirSync('out',{recursive:true});writeFileSync(`out/bootstrap-${manifest.hotelId}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:'bootstrap_confirmed',hotel:current.data,entries:entries.length,media:media.length,translationsPending:translations.filter(t=>t.status.startsWith('pending')).length,report:`out/bootstrap-${manifest.hotelId}.json`},null,2));
} catch {
 console.error(JSON.stringify({status:'interrupted',stage,instruction:'Confira o estado por leitura antes de repetir. Nenhum arquivo foi excluido; o bootstrap preserva dados e detecta conflitos.'}));
 process.exitCode=1;
} finally {
 // Session exists in memory only. Logout removes the session without changing the account password.
 if(client)await client.auth.signOut({scope:'local'}).catch(()=>{});
}