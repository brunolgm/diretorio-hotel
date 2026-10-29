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

const output=resolve('out/preview-navigation');mkdirSync(output,{recursive:true});
const buildOptions={entryPoints:['tests/browser/public-v3-fixture.tsx'],bundle:true,outfile:join(output,'fixture.js'),platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4183'),'process.env.NODE_ENV':JSON.stringify('development')},alias:{'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx')}};
await build(buildOptions);
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
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+(path==='/preview/before'?'/baseline.js':'/fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4183,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'});
const rows=[],errors=[];let apiRequests=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/'))apiRequests++;return u.hostname==='127.0.0.1'?route.continue():route.abort();});
 const root='http://127.0.0.1:4183';
 const properties=[['bugan','bugan'],['grand-mercure','grand-mercure'],['novotel-leme','deep-ocean'],['novotel-salvador','novotel'],['mercure','mercure'],['default','default']];
 async function ready(){await page.locator('h1').first().waitFor();assert.ok(!(await page.locator('h1').first().innerText()).includes('404'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 for(const [property,theme]of properties)for(const lang of ['pt','en','es'])for(const [width,height]of [[390,844],[430,932],[1440,900]]){
  await page.setViewportSize({width,height});
  const url=root+'/preview?'+new URLSearchParams({scope:'preview',experience:'v4',property,theme,lang});
  await page.goto(url);await ready();
  const actions=await page.locator('[data-v4-action]').evaluateAll(a=>a.map(el=>({key:el.dataset.v4Action,href:el.getAttribute('href')})));
  assert.equal(actions.length,4,property+' actions');for(const a of actions)assert.ok(a.href.startsWith('/preview/'));
  if(property==='bugan'){
   const editorials=await page.locator('.v3-editorial a').evaluateAll(a=>a.map(el=>el.getAttribute('href')));
   assert.equal(editorials.length,3);assert.ok(editorials[0].startsWith('/preview/servicos/'));assert.ok(editorials[1].startsWith('/preview/servicos/'));assert.ok(editorials[2].startsWith('https://'));
   assert.equal(await page.locator('.v3-tourism-cards>a').count(),4);
   await page.screenshot({path:join(output,`home-${width}-${lang}.png`),fullPage:true});
   for(const action of actions){
    await page.goto(root+action.href);await ready();
    assert.ok(page.url().includes('/preview/'));assert.deepEqual(await page.locator('a[href^="/hotel/"]').evaluateAll(a=>a.map(el=>el.getAttribute('href'))),[],action.key+" leaked public link");
    const home=page.locator('a').filter({hasText:lang==='en'?'Home':lang==='es'?'Inicio':'Início'});
    assert.ok(await home.count()||await page.locator('a[href="/preview'+(lang==='pt'?'':'?lang='+lang)+'"]').count());
    if(action.key==='flights'){
     assert.ok((await page.locator('body').innerText()).includes('REC'));
     await page.goto(root+'/preview/explorar/voos?tab=meu-voo&lang='+lang);await ready();assert.equal(await page.getByRole('status').count(),1);assert.equal(await page.locator('input').count(),0);
    }
   }
   for(const href of editorials.slice(0,2)){await page.goto(root+href);await ready();}
   await page.goto(root+'/preview/explorar/turismo?lang='+lang);await ready();
   const item=page.locator('[data-tourism-item]').first();if(await item.count()){await item.click();await ready();assert.ok(page.url().includes('/preview/explorar/turismo/'));}
   const homeHref='/preview'+(lang==='pt'?'':'?lang='+lang);await page.goto(root+homeHref);await ready();
   if(width<768){await page.locator('[data-v4-action="services"]').click();await ready();assert.ok(page.url().includes('/preview/explorar/servicos'));}
  }
  rows.push({property,theme,lang,width,height,passed:true});
 }
 assert.deepEqual(errors,[]);assert.equal(apiRequests,0);
 writeFileSync(join(output,'browser-report.json'),JSON.stringify({scope:'isolated renderers; authorization exercised separately by actual server route tests',rows,errors,apiRequests},null,2));
 console.log(`PASS ${rows.length} preview navigation scenarios; all Bugan cards/editorials/tourism; zero API calls`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
