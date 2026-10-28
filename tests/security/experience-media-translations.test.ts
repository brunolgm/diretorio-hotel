import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const ts=createRequire(import.meta.url)('typescript') as typeof import('typescript');
type Helper=typeof import('../../lib/services/experience-media-translations.ts');
function harness(enabled=true,mode='complete'){
 const calls: {name:string;args:Record<string,unknown>}[]=[];
 let providerCalls=0;
 const compiledModule={exports:{}};
 const compiled=ts.transpileModule(readFileSync('lib/services/experience-media-translations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{module:compiledModule,exports:compiledModule.exports,require:(name:string)=>{
  if(name==='server-only')return {};
  if(name==='@/lib/admin-entitlements')return {hasHotelModule:async()=>enabled};
  if(name==='@/lib/services/translation-service')return {translateExperienceMediaFields:async(fields:object,language:string)=>{providerCalls++;return mode==='provider-failed'&&language==='es'?null:fields;}};
  throw new Error('Unexpected module');
 }});
 const client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});if(mode==='transport')throw new Error('private provider detail');return {data:mode!=='stale',error:null};}};
 return {run:()=> (compiledModule.exports as Helper).syncExperienceMediaTranslations({client:client as unknown as Parameters<Helper['syncExperienceMediaTranslations']>[0]['client'],slot:'hero',revision:7,fields:{title:'Source PT',description:'',alt_text:'Photo',cta_label:null}}),calls,providers:()=>providerCalls};
}
test('media save skips Google and writes when languages are disabled',async()=>{const h=harness(false);assert.equal(await h.run(),'skipped');assert.equal(h.providers(),0);assert.equal(h.calls.length,0);});
test('media save translates EN/ES using the confirmed source revision and only editorial fields',async()=>{const h=harness();assert.equal(await h.run(),'complete');assert.equal(h.calls.length,2);for(const call of h.calls){assert.equal(call.name,'save_current_hotel_experience_media_translation');assert.equal(call.args.p_expected_revision,7);assert.deepEqual(Object.keys(call.args).sort(),['p_expected_revision','p_fields','p_language','p_slot']);assert.equal((call.args.p_fields as {description:unknown}).description,null);}});
test('media save reports partial provider failure without rewriting PT',async()=>{const h=harness(true,'provider-failed');assert.equal(await h.run(),'failed');assert.equal(h.calls.length,1);});
test('media save never reports stale or uncertain persistence as success',async()=>{for(const mode of ['stale','transport']){const h=harness(true,mode);assert.equal(await h.run(),'failed');assert.equal(h.calls.length,2);}});
test('editorial localization falls back per field and never mutates PT, image or revision',async()=>{
 const {localizeExperienceMedia,experienceMediaHasFallback}=await import('../../lib/public-experience-media.ts');
 const source={title:'PT title',description:'PT description',alt_text:'PT photo',cta_label:'PT CTA',image_path:'owned/path',revision:7} as Parameters<typeof localizeExperienceMedia>[0];
 const translated=localizeExperienceMedia(source,{title:'EN title',description:null,alt_text:' ',cta_label:'EN CTA'});
 assert.equal(translated.title,'EN title');assert.equal(translated.description,source.description);assert.equal(translated.alt_text,source.alt_text);
 assert.equal(translated.image_path,source.image_path);assert.equal(translated.revision,7);assert.equal(source.title,'PT title');
 assert.equal(experienceMediaHasFallback(source,{title:'EN title'}),true);
 assert.equal(experienceMediaHasFallback(source,{title:'EN',description:'EN',alt_text:'EN',cta_label:'EN'}),false);
});