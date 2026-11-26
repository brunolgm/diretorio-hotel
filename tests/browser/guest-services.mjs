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
 const file=assetMap.get(path)??(path==='/fixture.js'||path==='/fixture.css'||path==='/baseline.js'||path==='/style.css'?join(output,path.slice(1)):path.startsWith('/brand/')&&!path.includes('..')?join('public',path):null);
 if(file&&existsSync(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/svg+xml');res.end(readFileSync(file));return;}
 if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="'+('fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4207,'127.0.0.1',r));

const browser=await chromium.launch({headless:true,channel:process.env.GUEST_BROWSER_CHANNEL||'msedge'}),rows=[],folds=[];
async function firstFold(page,height){
 await page.setViewportSize({width:390,height});await page.goto('http://127.0.0.1:4207/?hotel=4');await page.locator('.guest-service-row').first().waitFor();
 const measurement=await page.locator('.guest-service-row').evaluateAll(nodes=>{const region=document.querySelector('[data-public-internal-body]').getBoundingClientRect();return {complete:nodes.filter(node=>{const r=node.getBoundingClientRect();return r.top>=region.top&&r.bottom<=Math.min(innerHeight,region.bottom);}).length,total:nodes.length,rows:nodes.map(node=>({title:node.querySelector('strong').textContent,height:node.getBoundingClientRect().height,bottom:node.getBoundingClientRect().bottom})),contentBottom:region.bottom};});
 assert.ok(measurement.complete>=7,`first fold ${height}: ${measurement.complete}`);folds.push({width:390,height,...measurement});await page.screenshot({path:join(output,`services-4-pt-390${height===900?'':'-844'}.png`),fullPage:true,animations:'disabled'});
}
async function fullListing(page,filename){
 await page.evaluate(()=>{const main=document.querySelector('[data-public-internal-v4]');main.style.height='auto';main.style.overflow='visible';main.style.display='block';const body=document.querySelector('[data-public-internal-body]');body.style.height='auto';body.style.overflow='visible';for(const nav of main.querySelectorAll(':scope>nav')){nav.style.position='static';nav.style.inset='auto';}});
 await page.screenshot({path:join(output,filename),fullPage:true,animations:'disabled'});
}
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 if(process.env.GUEST_DENSITY_ONLY==='1'){
  await firstFold(page,900);await firstFold(page,844);writeFileSync(join(output,'density-report.json'),JSON.stringify({scope:'Approved shared renderer; safe historical Bugan copy and synthetic identities',folds,errors},null,2));console.log('PASS density: '+folds.map(f=>f.height+': '+f.complete+'/'+f.total).join(', '));
 }else{
 for(const hotel of [4,0,1,2,3])for(const lang of ['pt','en','es'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(`http://127.0.0.1:4207/?hotel=${hotel}&lang=${lang}${hotel===0?'&volume=1':''}`);
  await page.locator('.guest-service-row').first().waitFor();
  await page.context().addCookies([{name:'guest_context_fixture',value:'synthetic-context-not-authorization',url:'http://127.0.0.1:4207',httpOnly:true,sameSite:'Lax'}]);
  assert.equal(await page.locator('.guest-service-row').count(),hotel===0?48:8,`${hotel}/${lang}`);
  assert.equal(await page.getByText('FOREIGN MUST NOT SHOW').count(),0);
  const languageContrast=await page.locator('.public-area-hero .hotel-theme-language-trigger').evaluate(el=>{const s=getComputedStyle(el);const luminance=value=>{const c=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert.ok(languageContrast>=4.5,`language contrast ${hotel}/${lang}/${width}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1440)assert.ok(await page.locator('nav').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).position==='fixed'&&getComputedStyle(n).display!=='none').length===0));
  assert.equal(await page.locator('.guest-desktop-navigation').isVisible(),width===1440);
  assert.equal(await page.locator('.guest-service-row a').filter({hasText:'Room Service'}).count(),1);
  const roomHref=await page.locator('.guest-service-row a').filter({hasText:'Room Service'}).getAttribute('href');
  if(lang!=='pt')assert.ok(roomHref.includes('lang='+lang));
  assert.equal(roomHref,await page.evaluate(()=>window.fixtureRoomServiceHref));
  if(hotel===4&&lang==='pt')await page.screenshot({path:join(output,`services-${hotel}-${lang}-${width}.png`),fullPage:true,animations:'disabled'});
  const input=page.getByRole('searchbox');await input.fill('zz-no-result');await page.locator('.guest-service-empty').waitFor();
  assert.equal(await page.locator('.guest-service-row').count(),0);
  await page.locator('.guest-service-empty button').click();assert.equal(await page.locator('.guest-service-row').count(),hotel===0?48:8);
  if(hotel===0){await page.locator('.guest-service-categories button').nth(1).click();assert.ok(await page.locator('.guest-service-row').count()>0);await page.locator('.guest-service-categories button').first().click();}
  else assert.equal(await page.locator('.guest-service-categories').count(),0);
  await input.fill(lang==='en'?'Laundry':lang==='es'?'Lavadero':'Lavanderia');
  assert.equal(await page.locator('.guest-service-row').count(),1);
  if(hotel===4&&lang==='pt'&&width===390)await page.screenshot({path:join(output,`filter-${hotel}-${lang}-${width}.png`),fullPage:true,animations:'disabled'});
  const opener=page.locator('.guest-service-row button');await opener.click();
  await page.getByRole('dialog').waitFor();
  await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
  await page.keyboard.press('Tab');await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
  const bounds=await page.getByRole('dialog').boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.x>=0&&bounds.x+bounds.width<=width+1);
  if(hotel===4&&lang==='pt'&&width===390)await page.screenshot({path:join(output,`detail-${hotel}-${lang}-${width}.png`),fullPage:true,animations:'disabled'});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await input.inputValue(),lang==='en'?'Laundry':lang==='es'?'Lavadero':'Lavanderia');
  await opener.click();await page.getByRole('dialog').waitFor();await page.goBack();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.guest-service-row').count(),1);
  assert.equal((await page.context().cookies()).find(c=>c.name==='guest_context_fixture')?.value,'synthetic-context-not-authorization');
  assert.ok(await opener.evaluate(el=>el===document.activeElement));
  rows.push({hotel,lang,width,passed:true});
 }
 await firstFold(page,900);await firstFold(page,844);
 await fullListing(page,'services-complete-mobile.png');await page.goto('http://127.0.0.1:4207/?hotel=4');await page.locator('.guest-service-row').first().waitFor();
 await page.getByRole('button',{name:'Informações sobre Room Service',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('Atendimento 24 horas.'));await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/Academia/}).click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished)));assert.ok((await page.locator('[role=dialog] .guest-service-metadata').innerText()).includes('Piso L'));await page.screenshot({path:join(output,'detail-hours-location-mobile.png'),fullPage:true,animations:'disabled'});await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4207/?hotel=4&area=informacoes');await page.locator('h1').waitFor();assert.equal(await page.locator('[data-essential=breakfast]').count(),1);const stay=await page.locator('[data-essential=stay] dl>div').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));assert.equal(stay[0],stay[1]);await page.screenshot({path:join(output,'information-mobile.png'),fullPage:true,animations:'disabled'});await fullListing(page,'information-complete-mobile.png');
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4207/?admin=1');await page.locator('summary').click();await page.locator('input[name=guest_summary_pt]').waitFor();assert.equal(await page.locator('input[name=guest_summary_pt]').inputValue(),'Coleta e entrega de roupas');await page.locator('input[name=guest_summary_pt]').fill('Resumo editado na prévia');await page.getByText('Resumo editado na prévia',{exact:true}).waitFor();await page.screenshot({path:join(output,'admin-service-configuration.png'),fullPage:true,animations:'disabled'});

 // Verify editorial survives the F&B shell even with no service links.
 await page.goto('http://127.0.0.1:4207/?hotel=4&area=cardapio&supplement=1');await page.locator('[data-guest-dining-supplement]').waitFor();assert.ok(await page.locator('[data-guest-dining-supplement]').getByText('Restaurante Filipe',{exact:true}).isVisible());
 for(const hotel of [0,1,2,3]){await page.setViewportSize({width:390,height:844});await page.goto(`http://127.0.0.1:4207/?hotel=${hotel}&metadata=1`);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(output,`metadata-${hotel}-mobile.png`),fullPage:true,animations:'disabled'});if(hotel===0){const total=await page.locator('.guest-service-row').count();assert.ok(total>12);await fullListing(page,'grand-services-complete-mobile.png');await page.locator('.guest-service-categories button').filter({hasText:'Mobilidade'}).click();assert.ok(await page.locator('.guest-service-row').count()<total);await page.screenshot({path:join(output,'grand-filter-mobile.png'),fullPage:true,animations:'disabled'});}if(hotel===2)await fullListing(page,'novotel-services-complete-mobile.png');}
 // Preview uses the same interaction contract: inline, detail, direct page, external and assistance.
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4207/?admin=1');await page.locator('summary').click();
 for(const mode of ['inline','detail','page','external','assistance']){await page.locator('select[name=guest_interaction]').selectOption(mode);const row=page.locator('.guest-service-row');assert.equal(await row.getAttribute('data-interaction'),mode==='inline'?'inline':mode==='detail'||mode==='assistance'?'detail':'page');if(['page','external','guide'].includes(mode)){await row.locator('a').click();assert.ok((await page.getByRole('status').last().innerText()).includes('https://example.invalid/configured-channel'));assert.ok(page.url().includes('admin=1'));}}
 await page.locator('select[name=guest_interaction]').selectOption('detail');await page.locator('input[name=title]').fill('Lavanderia revisada');await page.getByText('Lavanderia revisada',{exact:true}).waitFor();await page.screenshot({path:join(output,'admin-service-configuration.png'),fullPage:true,animations:'disabled'});
 await page.goto('http://127.0.0.1:4207/?admin=1&guidePreview=1');await page.locator('summary').first().click();await page.locator('select[name=guest_interaction]').selectOption('inline');assert.equal(await page.locator('.guest-service-row').getAttribute('data-interaction'),'page');assert.ok((await page.locator('.guest-service-row a').getAttribute('href')).includes('/servicos/'));
 assert.deepEqual(errors,[]);writeFileSync(join(output,'browser-report.json'),JSON.stringify({scope:'Local actual components, historical safe copy and synthetic tenant identities; configured test booking/breakfast; metadata previews use actual audited titles with synthetic descriptions; no production authorization or orders',rows,folds,errors},null,2));console.log(`PASS ${rows.length} browser scenarios plus information/admin captures; first fold ${folds.map(f=>f.height+': '+f.complete+'/'+f.total).join(', ')}; ${output}`);
 }
} finally { await browser.close();await new Promise(r=>server.close(r)); }
