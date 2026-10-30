// Isolated renderer regression. No session, remote API, provider or external request.
// TOOL_NODE_MODULES supplies temporary esbuild tooling, as in flight-center-compact.mjs.
import assert from 'node:assert/strict';

import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';

const require=createRequire(import.meta.url);
const {build}=createRequire(join(process.env.TOOL_NODE_MODULES,'package.json'))('esbuild');
const {chromium}=require('playwright');

const output=resolve('out/tourism-v4');mkdirSync(output,{recursive:true});
const buildOptions={entryPoints:['tests/browser/public-v3-fixture.tsx'],bundle:true,outfile:join(output,'fixture.js'),platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4183'),'process.env.NODE_ENV':JSON.stringify('development')},alias:{'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx')}};
await build(buildOptions);
const css=await require('postcss')([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
writeFileSync(join(output,'style.css'),css.css);
const source='docs/references/bugan/public-v3/';
const assetMap=new Map([['/assets/logo.png',source+'bugan-logo-oficial.png'],['/assets/hero.webp',source+'hero-piscina-real.png']]);
for(const [slot,file] of [['hero','hero-piscina-real.png'],['about','fachada-bugan-real.png'],['restaurant','restaurante-filipe-real.png'],['accommodation','acomodacao-bugan-real.png']])assetMap.set(`/storage/v1/object/public/hotel-assets/5eb7d695-ccf7-4594-b9df-fc46aaa25695/hero/${slot}/52130000-0000-4000-8000-000000000001.webp`,source+file);
for(const [n,file]of [[1,'lg-smart-tv-remote.webp'],[2,'net-receiver-remote.webp']])assetMap.set('/storage/v1/object/public/hotel-assets/5eb7d695-ccf7-4594-b9df-fc46aaa25695/room-guides/52130000-0000-4000-8000-000000000001/52140000-0000-4000-8000-00000000000'+n+'.webp',source+'tv-manual/'+file);
const refinement=JSON.parse(readFileSync('docs/bootstrap/bugan-public-v3-refinement-20261028.json','utf8'));
for(const a of refinement.assets)assetMap.set('/storage/v1/object/public/hotel-assets/'+a.storagePath,a.path);
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 const file=assetMap.get(path)??(path==='/fixture.js'||path==='/baseline.js'||path==='/style.css'?join(output,path.slice(1)):path.startsWith('/brand/')&&!path.includes('..')?join('public',path):null);
 if(file&&existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/svg+xml');res.end(readFileSync(file));return;}
 if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+(path==='/preview/before'?'/baseline.js':'/fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4183,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'});const rows=[],errors=[];let apiRequests=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))apiRequests++;return u.hostname==='127.0.0.1'?r.continue():r.abort();});
 const origin='http://127.0.0.1:4183';
 const properties=[['bugan','bugan'],['grand-mercure','grand-mercure'],['novotel-leme','deep-ocean'],['novotel-salvador','novotel'],['mercure','mercure'],['default','default']];
 async function ready(){await page.locator('h1').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(!(await page.locator('h1').first().innerText()).includes('404'));}
 if(process.argv.includes('--guides')){const {runRoomGuides}=await import('./room-guides.mjs');rows.push(...await runRoomGuides({page,origin,output}));}
 else if(process.argv.includes('--communications')){const {runCommunicationsAndFlight}=await import('./public-communications.mjs');rows.push(...await runCommunicationsAndFlight({page,origin,output}));}
 else if(process.argv.includes('--languages')){const {runPublicLanguageSwitcher}=await import('./public-language-switcher.mjs');rows.push(...await runPublicLanguageSwitcher({page,origin,output}));}
 else if(process.argv.includes('--closure')){
  const {runV4Closure}=await import('./public-v4-closure.mjs');rows.push(...await runV4Closure({page,origin,output}));
 }else for(const [property,theme]of properties)for(const lang of ['pt','en','es'])for(const [width,height]of [[390,844],[430,932],[1440,900]]){
  await page.setViewportSize({width,height});const home=origin+'/preview?'+new URLSearchParams({scope:'preview',experience:'v4',tourism:'coherent',property,theme,lang});await page.goto(home);await ready();
  if(property==='bugan'){
   const cards=await page.locator('.v3-tourism-cards>a').evaluateAll(a=>a.map(el=>el.getAttribute('href')));assert.equal(cards.length,4);assert.equal(new Set(cards).size,4);
   for(const [i,href]of cards.entries()){
    await page.goto(origin+href);await ready();const text=await page.locator('body').innerText();
    if(i===0){assert.ok(text.includes('Praia de Boa Viagem'));assert.ok(!text.includes('Praça de Boa Viagem'));}
    else{assert.ok(await page.locator('[data-tourism-item]').count());assert.ok(!text.includes('Shopping Recife'));assert.ok(!text.includes('Praça de Boa Viagem'));assert.ok(await page.locator('a').filter({hasText:lang==='en'?'View all attractions':lang==='es'?'Ver todas las atracciones':'Ver todas as atrações'}).count());}
    assert.equal(await page.locator('option[value="EXPERIENCE"],option[value="GASTRONOMY"]').count(),0);
    if(i===2){assert.ok(text.includes('Paço do Frevo'));assert.ok(text.includes('Embaixada dos Bonecos Gigantes'));}
    if(lang==='pt')await page.screenshot({path:join(output,`tourism-${width}-card-${i}.png`),fullPage:true});
    if(i>0){await page.locator('[data-tourism-item]').first().click();await ready();assert.ok(page.url().includes('collection='));const description=await page.locator('article').innerText();assert.ok(description.trim().length>30);assert.ok(await page.locator('a[target="_blank"]').count());}
    const languageLinks=await page.locator('a[data-analytics-language]').evaluateAll(a=>a.map(el=>el.getAttribute('href')));assert.ok(languageLinks.every(h=>h.startsWith('/preview/')));if(i>0)assert.ok(languageLinks.every(h=>h.includes('collection=')));
   }
  }
  await page.goto(origin+'/preview/explorar/servicos?lang='+lang);await ready();assert.equal(await page.locator('main[data-public-internal-v4]').count(),1);
  const service=page.locator('a[href^="/preview/servicos/"]').first();if(await service.count()){await service.click();await ready();assert.ok(!(await page.locator('body').innerText()).includes('60 caracteres'));if(property==='bugan'&&lang==='pt')await page.screenshot({path:join(output,`service-${width}.png`),fullPage:true});}
  await page.goto(origin+'/preview/explorar/contato?lang='+lang);await ready();assert.equal(await page.locator('a[href^="tel:"]').count(),4);if(property==='bugan'&&lang==='pt')await page.screenshot({path:join(output,`contact-${width}.png`),fullPage:true});
  await page.goto(origin+'/preview/explorar/voos?lang='+lang);await ready();if(property==='bugan'&&lang==='pt')await page.screenshot({path:join(output,`flights-${width}.png`),fullPage:true});
  await page.goto(home);await ready();rows.push({property,lang,width,passed:true});
 }
 assert.deepEqual(errors,[]);assert.equal(apiRequests,0);writeFileSync(join(output,process.argv.includes('--guides')?'guides-report.json':process.argv.includes('--communications')?'communications-report.json':process.argv.includes('--languages')?'language-report.json':process.argv.includes('--closure')?'closure-report.json':'browser-report.json'),JSON.stringify({scope:'isolated renderer fixtures; not an authenticated production session',rows,errors,apiRequests},null,2));console.log(process.argv.includes('--languages')?`PASS ${rows.length} public language scenarios; zero API calls`:`PASS ${rows.length} V4 internal/Tourism scenarios; four coherent destinations; zero API calls`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
