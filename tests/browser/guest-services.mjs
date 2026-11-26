import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright');
const output=resolve('out/guest-experience-premium-services');mkdirSync(output,{recursive:true});
await build({entryPoints:['tests/browser/guest-services-fixture.tsx'],bundle:true,outfile:join(output,'fixture.js'),platform:'browser',loader:{'.png':'dataurl'},jsx:'automatic',tsconfig:'tsconfig.json',define:{'process.env':'{}','process.env.NODE_ENV':JSON.stringify('development')},alias:{'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx')}});
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
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+('fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4207,'127.0.0.1',r));

const browser=await chromium.launch({headless:true,channel:process.env.GUEST_BROWSER_CHANNEL||'msedge'}),rows=[];
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 for(const hotel of [4,0,1,2,3])for(const lang of ['pt','en','es'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(`http://127.0.0.1:4207/?hotel=${hotel}&lang=${lang}${hotel===0?'&volume=1':''}`);
  await page.locator('.guest-service-row').first().waitFor();
  await page.context().addCookies([{name:'guest_context_fixture',value:'synthetic-context-not-authorization',url:'http://127.0.0.1:4207',httpOnly:true,sameSite:'Lax'}]);
  assert.equal(await page.locator('.guest-service-row').count(),hotel===0?48:8,`${hotel}/${lang}`);
  assert.equal(await page.getByText('FOREIGN MUST NOT SHOW').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1440)assert.ok(await page.locator('nav').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).display!=='none').length===0));
  assert.equal(await page.locator('.guest-desktop-navigation').isVisible(),width===1440);
  assert.equal(await page.locator('.guest-service-row a').filter({hasText:'Room Service'}).count(),1);
  const roomHref=await page.locator('.guest-service-row a').filter({hasText:'Room Service'}).getAttribute('href');
  if(lang!=='pt')assert.ok(roomHref.includes('lang='+lang));
  assert.equal(roomHref,await page.evaluate(()=>window.fixtureRoomServiceHref));
  await page.screenshot({path:join(output,`services-${hotel}-${lang}-${width}.png`),fullPage:true});
  const input=page.getByRole('searchbox');await input.fill('zz-no-result');await page.locator('.guest-service-empty').waitFor();
  assert.equal(await page.locator('.guest-service-row').count(),0);
  await page.locator('.guest-service-empty button').click();assert.equal(await page.locator('.guest-service-row').count(),hotel===0?48:8);
  await page.locator('.guest-service-categories button').nth(1).click();assert.ok(await page.locator('.guest-service-row').count()>0);
  await page.screenshot({path:join(output,`filter-${hotel}-${lang}-${width}.png`),fullPage:true});
  await page.locator('.guest-service-categories button').first().click();
  await input.fill(lang==='en'?'Laundry':lang==='es'?'Lavadero':'Lavanderia');
  assert.equal(await page.locator('.guest-service-row').count(),1);
  const opener=page.locator('.guest-service-row button');await opener.click();
  await page.getByRole('dialog').waitFor();
  await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
  await page.keyboard.press('Tab');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
  const bounds=await page.getByRole('dialog').boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
  await page.screenshot({path:join(output,`detail-${hotel}-${lang}-${width}.png`),fullPage:true});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await input.inputValue(),lang==='en'?'Laundry':lang==='es'?'Lavadero':'Lavanderia');
  await opener.click();await page.getByRole('dialog').waitFor();await page.goBack();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.guest-service-row').count(),1);
  assert.equal((await page.context().cookies()).find(c=>c.name==='guest_context_fixture')?.value,'synthetic-context-not-authorization');
  assert.ok(await opener.evaluate(el=>el===document.activeElement));
  rows.push({hotel,lang,width,passed:true});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4207/?hotel=4&area=informacoes');await page.locator('h1').waitFor();await page.screenshot({path:join(output,'information-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4207/?admin=1');await page.locator('summary').click();await page.locator('input[name=guest_summary_pt]').waitFor();assert.equal(await page.locator('input[name=guest_summary_pt]').inputValue(),'Coleta e entrega de roupas');await page.locator('input[name=guest_summary_pt]').fill('Resumo editado na prévia');await page.getByText('Resumo editado na prévia',{exact:true}).waitFor();await page.screenshot({path:join(output,'admin-service-configuration.png'),fullPage:true});
 assert.deepEqual(errors,[]);writeFileSync(join(output,'browser-report.json'),JSON.stringify({scope:'Local actual components, historical safe copy and synthetic tenant identities; no production authorization or orders',rows,errors},null,2));console.log(`PASS ${rows.length} browser scenarios plus information/admin captures; ${output}`);
} finally { await browser.close();await new Promise(r=>server.close(r)); }

