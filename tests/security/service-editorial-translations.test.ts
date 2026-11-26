import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as fields from '../../lib/services/service-editorial-fields.ts';
import * as tourism from '../../lib/tourism/translations.ts';
const ts=createRequire(import.meta.url)('typescript') as typeof import('typescript');
function compile(path:string,imports:Record<string,unknown>,globals:Record<string,unknown>={}){
 const compiledModule={exports:{}};runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiledModule,exports:compiledModule.exports,AbortSignal,URLSearchParams,...globals,require:(name:string)=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];}});return compiledModule.exports;
}
const source={id:'own-service',hotel_id:'own',updated_at:'2026-11-26T01:00:00Z',title:'Lavanderia',content:'Orientações',category:'Conveniência',cta:'Consultar',guest_presentation:{summary:{pt:'Coleta de roupas'},hours:{pt:'Até 14h'},location:{pt:'Piso L'},conditions:{pt:'Consulte a recepção'}}};
test('reviewing one field protects only that value and keeps other automatic fields eligible',()=>{
 const row:fields.ServiceTranslationRow={language:'en',title:'Laundry',guest_fields:{summary:'Collection',hours:'Until 14h'},editorial_state:{title:{origin:'auto',status:'current'},summary:{origin:'auto',status:'current'},hours:{origin:'auto',status:'stale'}}};
 const changes=fields.serviceManualReviewChanges(source,row,'en',{title:'Laundry',summary:'Reviewed collection',hours:'Until 14h'});
 assert.deepEqual(changes,{summary:'Reviewed collection'});
 row.editorial_state={...row.editorial_state as object,summary:{origin:'manual',status:'current'}};
 assert.ok(fields.eligibleServiceTranslationFields(source,row,'en').includes('hours'));
 assert.ok(!fields.eligibleServiceTranslationFields(source,row,'en').includes('summary'));
 assert.deepEqual(fields.serviceManualReviewChanges(source,row,'en',{summary:'Collection'},['summary']),{summary:'Collection'});
});
type Row=fields.ServiceTranslationRow;
function harness(rows:Row[]=[],fail=false,stale=false){
 const calls:{language:string;fields:Record<string,string|null>}[]=[],writes:Record<string,unknown>[]=[],filters:unknown[]=[];
 const helper=compile('lib/services/service-translation-sync.ts',{'server-only':{},'@/lib/admin-entitlements':{hasHotelModule:async()=>true},'./service-editorial-fields':fields,'./translation-service':{translateSectionFields:async(values:Record<string,string|null>,language:string)=>{calls.push({fields:values,language});return fail?null:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,language+':'+v]));}}}) as typeof import('../../lib/services/service-translation-sync.ts');
 const client={from(table:string){const q={select(){return q;},eq(k:string,v:string){filters.push([table,k,v]);return q;},single:async()=>({data:table==='hotels'?{name:'Hotel Teste',city:'Recife'}:structuredClone(source),error:null}),then(resolve:(r:unknown)=>unknown){return Promise.resolve({data:rows,error:null}).then(resolve);}};return q;},rpc:async(_name:string,args:Record<string,unknown>)=>{writes.push(args);return {data:!stale,error:null};}};
 return {run:(extra:object={})=>helper.syncServiceEditorialTranslations({supabase:client as never,sectionId:source.id,hotelId:'own',...extra}),calls,writes,filters};
}
test('PT-only source sends exactly all eight editorial fields to the existing provider, one batch per language',async()=>{
 const h=harness(),result=await h.run();assert.equal(result.status,'complete');assert.equal(h.calls.length,2);assert.equal(h.writes.length,2);
 for(const request of h.calls)assert.deepEqual(Object.keys(request.fields).sort(),[...fields.SERVICE_EDITORIAL_FIELDS].sort());
 for(const write of h.writes){assert.equal(write.p_expected_source_version,source.updated_at);assert.equal(write.p_expected_translation_version,null);assert.equal(write.p_origin,'auto');}
 assert.ok(h.filters.some(f=>JSON.stringify(f)===JSON.stringify(['hotel_sections','hotel_id','own'])));
});
test('unchanged fields cause zero requests; a single stale automatic field sends only that field',async()=>{
 const complete=(language:string)=>({language,title:'Name',content:'Text',category:'Category',cta:'Open',guest_fields:{summary:'Summary',hours:'Hours',location:'Location',conditions:'Terms'},editorial_state:Object.fromEntries(fields.SERVICE_EDITORIAL_FIELDS.map(f=>[f,{origin:'auto',status:'current'}]))}) as Row;
 const rows=[complete('en'),complete('es')],a=harness(rows);assert.equal((await a.run()).status,'complete');assert.equal(a.calls.length,0);
 rows[0].editorial_state={...rows[0].editorial_state as object,hours:{origin:'auto',status:'stale'}};const b=harness(rows);await b.run();assert.equal(b.calls.length,1);assert.deepEqual(Object.keys(b.calls[0].fields),['hours']);
});
test('manual and legacy translations survive automatic refresh; stale manual source is marked for review and falls back to PT',async()=>{
 const row:Row={language:'en',title:'Reviewed name',content:'Legacy content',guest_fields:{summary:'Reviewed summary'},editorial_state:{title:{origin:'manual',status:'stale'},summary:{origin:'manual',status:'current'}}};
 const h=harness([row]);await h.run({languages:['en'],force:true});assert.ok(h.calls.every(c=>!('title'in c.fields)&&!('content'in c.fields)&&!('summary'in c.fields)));
 assert.equal(fields.serviceLanguageStatus(source,row,'en').status,'review');assert.equal(fields.localizeServiceEditorial(source,row,'en').title,source.title);
 const localized=fields.localizeServiceEditorial(source,row,'en') as fields.ServiceEditorialSource;
 assert.equal((localized.guest_presentation as {summary:{en:string}}).summary.en,'Reviewed summary');
});
test('provider failure persists a retryable failure without writing source; failed fields retry and stale commits never report success',async()=>{
 const failed=harness([],true);assert.equal((await failed.run()).status,'failed');assert.equal(failed.writes[0].p_origin,'failed');
 assert.equal((await harness([],false,true).run()).status,'failed');
 const retry=harness([{language:'en',guest_fields:{hours:'Old hours'},editorial_state:{hours:{origin:'auto',status:'failed'}}}]);await retry.run({languages:['en']});assert.ok('hours'in retry.calls[0].fields);
});
test('legacy guest maps remain readable; missing required fields never make an entire language complete',()=>{
 const legacy={...source,guest_presentation:{...source.guest_presentation,summary:{pt:'Resumo',en:'Legacy summary'}}};
 assert.equal(fields.serviceTranslationValue(legacy,undefined,'summary','en'),'Legacy summary');assert.equal(fields.serviceLanguageStatus(legacy,{language:'en',title:'Name'},'en').status,'pending');
 assert.equal(fields.localizeServiceEditorial(legacy,undefined,'pt'),legacy);
});
test('the real Google adapter masks numeric/technical literals, preserves hotel identity, and skips numeric-only fields',async()=>{
 const requests:{q:string[]}[]=[];
 const service=compile('lib/services/translation-service.ts',{'server-only':{},'@/lib/env':{getRequiredEnvVar:()=> 'SYNTHETIC_KEY',logWarningOnce:()=>{}},'@/lib/services/operational-logger':{logOperationalError:()=>{}},'@/lib/tourism/translations':tourism},{process:{env:{}},fetch:async(_url:string,init:{body:string})=>{const req=JSON.parse(init.body);requests.push(req);return {ok:true,json:async()=>({data:{translations:req.q.map((q:string)=>({translatedText:q.replace('Piso','Floor').replace('Coleta até','Collection until')}))}})};}}) as typeof import('../../lib/services/translation-service.ts');
 const translated=await service.translateSectionFields({location:'Piso L',hours:'Coleta até 14h',content:'Hotel Exemplo · UH 203 · R$ 50,00 · ramal *1 · https://example.invalid/path'},'en',['Hotel Exemplo']);
 assert.ok(translated);assert.equal(translated.location,'Floor L');assert.equal(translated.hours,'Collection until 14h');assert.ok(translated.content?.includes('Hotel Exemplo · UH 203 · R$ 50,00 · ramal *1 · https://example.invalid/path'));
 await service.translateSectionFields({hours:'14:00–23:00',location:'203'},'es');assert.equal(requests.length,1);
 assert.ok(requests[0].q.every(q=>!q.includes('Hotel Exemplo')&&!q.includes('https://example.invalid')&&!q.includes('50,00')));
});
