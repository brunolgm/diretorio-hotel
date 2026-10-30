import test from 'node:test';
import assert from 'node:assert/strict';
import {publicLanguageHref} from '../../lib/public-language-href.ts';
for(const path of ['/explorar/voos?tab=meu-voo','/preview/explorar/turismo?collection=recife-antigo','/hotel/bugan-recife/servicos/service-0?lang=pt#details']){
 test('language navigation preserves scope/path/query/hash: '+path,()=>{
  const before=new URL(path,'https://example.test');for(const lang of ['pt','en','es'] as const){const href=publicLanguageHref(path,lang),after=new URL(href,'https://example.test');assert.equal(after.pathname,before.pathname);assert.equal(after.hash,before.hash);assert.equal(after.searchParams.get('lang'),lang);assert.equal(after.searchParams.getAll('lang').length,1);for(const [key,value]of before.searchParams)if(key!=='lang')assert.equal(after.searchParams.get(key),value);}
 });
}
