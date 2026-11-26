// Two small requests with synthetic text only. Never reads a hotel or writes a database.
import '../../scripts/bootstrap-runtime.mjs';
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const out=resolve('out/guest-experience-premium-final-admin');mkdirSync(out,{recursive:true});
const report={provider:'Google Cloud Translation v2, real provider',scope:'Synthetic editorial text only; two batches; no hotel data or database writes',languages:{}};
if(!process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY){report.status='skipped: no configured credential';}
else{
 const url=new URL(process.env.GOOGLE_CLOUD_TRANSLATION_API_URL||'https://translation.googleapis.com/language/translate/v2');assert.equal(url.hostname,'translation.googleapis.com');
 const {translateSectionFields}=await import('../../lib/services/translation-service.ts');
 const source={title:'Lavanderia de teste',content:'Consulte a recepção pelo ramal *1. Preço de referência R$ 50,00. UH 203.',category:'Lavanderia',cta:'Ver orientações',summary:'Coleta de roupas',hours:'Coleta até 14h',location:'Piso L',conditions:'Consulte a recepção do Hotel Exemplo.'};
 for(const language of ['en','es']){
  const result=await translateSectionFields(source,language,['Hotel Exemplo']);assert.ok(result,'Real provider must return complete usable text');
  assert.equal(Object.keys(result).length,8);assert.notEqual(result.title,source.title);
  for(const literal of ['*1','R$ 50,00','UH 203'])assert.ok(result.content.includes(literal));
  assert.ok(result.conditions.includes('Hotel Exemplo'));assert.ok(result.location.includes('L'));assert.ok(result.hours.includes('14h'));
  report.languages[language]=result;
 }
 report.status='passed';
}
writeFileSync(resolve(out,'google-real-provider-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,provider:report.provider,languages:Object.keys(report.languages),fieldsPerLanguage:8}));
