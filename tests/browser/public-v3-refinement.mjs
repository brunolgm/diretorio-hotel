// Isolated renderer regression. No session, remote API, provider or external request.
// TOOL_NODE_MODULES supplies temporary esbuild tooling, as in flight-center-compact.mjs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {build}=createRequire(join(process.env.TOOL_NODE_MODULES,'package.json'))('esbuild');
const {chromium}=require('playwright');
const output=resolve('out/v3-refinement');mkdirSync(output,{recursive:true});
const buildOptions={entryPoints:['tests/browser/public-v3-fixture.tsx'],bundle:true,outfile:join(output,'fixture.js'),platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4183'),'process.env.NODE_ENV':JSON.stringify('development')},alias:{'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx')}};
await build(buildOptions);
const baseline=new Map(['components/public/hotel-public-page-content.tsx','components/public/public-experience-overview.tsx'].map(p=>[resolve(p),execFileSync('git',['show','b08d73f:'+p],{encoding:'utf8'})]));
await build({...buildOptions,outfile:join(output,'baseline.js'),plugins:[{name:'previous-renderer',setup(b){b.onLoad({filter:/\.tsx$/},args=>baseline.has(args.path)?{contents:baseline.get(args.path),loader:'tsx',resolveDir:resolve(args.path,'..')}:undefined);}}]});
const css=await require('postcss')([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
writeFileSync(join(output,'style.css'),css.css);
const source='docs/references/bugan/public-v3/';
const assetMap=new Map([['/assets/logo.png',source+'bugan-logo-oficial.png'],['/assets/hero.webp',source+'hero-piscina-real.png']]);
for(const [slot,file] of [['hero','hero-piscina-real.png'],['about','fachada-bugan-real.png'],['restaurant','restaurante-filipe-real.png'],['accommodation','acomodacao-bugan-real.png']])assetMap.set(`/storage/v1/object/public/hotel-assets/5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/${slot}/52130000-0000-4000-8000-000000000001.webp`,source+file);
const refinement=JSON.parse(readFileSync('docs/bootstrap/bugan-public-v3-refinement-20261028.json','utf8'));
for(const a of refinement.assets)assetMap.set('/storage/v1/object/public/hotel-assets/'+a.storagePath,a.path);
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 const file=assetMap.get(path)??(path==='/fixture.js'||path==='/baseline.js'||path==='/style.css'?join(output,path.slice(1)):path.startsWith('/brand/')&&!path.includes('..')?join('public',path):null);
 if(file&&existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/svg+xml');res.end(readFileSync(file));return;}
 if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+(path==='/before'?'baseline.js':'fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4183,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.V3_BROWSER_CHANNEL?{channel:process.env.V3_BROWSER_CHANNEL}:{})});const rows=[];
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message);});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 for(const theme of ['grand-mercure','novotel','mercure','bugan','default'])for(const lang of ['pt','en','es'])for(const [width,height] of theme==='bugan'?[[1440,900],[1536,864],[390,844],[430,932]]:[[1440,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:4183/preview?theme=${theme}&lang=${lang}`);await page.locator('h1').first().waitFor();
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;}))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${theme}/${lang}/${width}`);
  assert.equal(await page.locator('.public-experience-v3').count(),theme==='bugan'?1:0,'preset isolation');
  if(theme==='bugan'){
   assert.equal(await page.locator('h1').innerText(),'Bugan Recife');assert.equal(await page.locator('[data-access]').count(),6);
   assert.equal(await page.locator('.v3-tourism-cards>a').count(),4);assert.equal(await page.locator('.v3-amenities>div').count(),4);
   assert.equal(await page.locator('.v3-tourism-cards img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
   if(width<768){await page.locator('.v3-menu-trigger').click();assert.equal(await page.getByRole('dialog').isVisible(),true);await page.keyboard.press('Escape');await page.locator('.v3-menu-trigger').evaluate(el=>el.blur());}
   if(lang==='pt')await page.screenshot({path:join(output,`bugan-${width}x${height}.png`),fullPage:true});
  }else {
   const after=await page.screenshot({fullPage:true});
   if(lang==='pt')writeFileSync(join(output,`${theme}-${width}.png`),after);
   await page.goto(`http://127.0.0.1:4183/before?theme=${theme}&lang=${lang}`);await page.locator('h1').first().waitFor();
   await page.evaluate(()=>Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;}))));
   const before=await page.screenshot({fullPage:true});
   if(!before.equals(after)){writeFileSync(join(output,`${theme}-${lang}-${width}-before.png`),before);writeFileSync(join(output,`${theme}-${lang}-${width}-after.png`),after);}
   assert.equal(createHash('sha256').update(before).digest('hex'),createHash('sha256').update(after).digest('hex'),`unintended visual change: ${theme}/${lang}/${width}`);
  }
  rows.push({theme,lang,width,height,passed:true});
 }
 for(const count of [2,3,4,7])for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:4183/preview?cards=${count}`);await page.locator('.v3-tourism-cards>a').first().waitFor();assert.equal(await page.locator('.v3-tourism-cards>a').count(),count);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);rows.push({cards:count,width,passed:true});
 }
 await page.goto('http://127.0.0.1:4183/preview?tourism=off');await page.locator('h1').waitFor();assert.equal(await page.locator('[data-v3-tourism]').count(),0);
 await page.goto('http://127.0.0.1:4183/preview?editor=1');
 await page.getByRole('button',{name:'Salvar apresentação'}).waitFor();
 await page.locator('input[type=file]').nth(1).setInputFiles(refinement.assets[1].path);
 await page.getByRole('group',{name:'Card 2',exact:true}).getByRole('button',{name:'Mover para cima'}).click();
 await page.getByRole('button',{name:'Salvar apresentação'}).click();
 await page.waitForFunction(()=>Boolean(document.body.dataset.editorialSaved));
 const submitted=await page.evaluate(()=>JSON.parse(document.body.dataset.editorialSaved));
 assert.equal(submitted.configuration.tourism.cards[0].title.pt,'Centro Histórico');
 assert.deepEqual(submitted.files,[{key:'image_0',name:'centro-historico.webp'}]);
 rows.push({editor:'reorder preserves selected image association',passed:true});
 assert.deepEqual(errors,[]);writeFileSync(join(output,'browser-report.json'),JSON.stringify({scope:'local renderer fixtures; not authenticated production visual approval',checks:rows,errors},null,2));console.log(`PASS ${rows.length} local browser scenarios + tourism gate; screenshots in ${output}`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
