// Isolated renderer regression. No session, remote API, provider or external request.
// TOOL_NODE_MODULES supplies temporary esbuild tooling, as in flight-center-compact.mjs.
import assert from 'node:assert/strict';

import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {build}=createRequire(join(process.env.TOOL_NODE_MODULES,'package.json'))('esbuild');
const {chromium}=require('playwright');
const sharp=require('sharp');
const output=resolve('out/v4-universal');mkdirSync(output,{recursive:true});
const buildOptions={entryPoints:['tests/browser/public-v3-fixture.tsx'],bundle:true,outfile:join(output,'fixture.js'),platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4183'),'process.env.NODE_ENV':JSON.stringify('development')},alias:{'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx')}};
await build(buildOptions);
const baseline=new Map(['components/public/hotel-public-page-content.tsx','components/public/public-experience-overview.tsx','components/public/grand-mercure/grand-mercure-public-home.tsx','components/public/novotel/novotel-public-home.tsx','components/public/mercure/mercure-public-home.tsx'].map(p=>[resolve(p),execFileSync('git',['show','0c0bda2:'+p],{encoding:'utf8'})]));
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
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+(path==='/preview/before'?'/baseline.js':'/fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4183,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.V3_BROWSER_CHANNEL?{channel:process.env.V3_BROWSER_CHANNEL}:{})});const rows=[];
try{
 const page=await browser.newPage();const errors=[];let apiRequests=0;
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/'))apiRequests++;return url.hostname==='127.0.0.1'?route.continue():route.abort();});
 await page.emulateMedia({reducedMotion:'reduce'});
 const sizes=[[360,800],[375,812],[390,844],[430,932],[1024,768],[1440,900],[1536,864]];
 async function visit(path,query){await page.goto('http://127.0.0.1:4183'+path+'?'+new URLSearchParams(query));await page.locator(query.editor?'form':'h1').first().waitFor();await page.evaluate(()=>Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;}))));}
 const layouts=new WeakMap();
 async function snapshot(){
  await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
  const layout=await page.evaluate(()=>[...document.querySelectorAll('h1,h2,h3,p,a,summary,img,nav')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,text:el.textContent,rect:[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100),font:s.font,color:s.color};}));
  const png=await page.screenshot({fullPage:true,animations:'disabled'});layouts.set(png,layout);return png;
 }
 async function equalVisual(a,b,label){
  assert.deepEqual(layouts.get(a),layouts.get(b),label+' text, typography and geometry');
  const x=await sharp(a).removeAlpha().raw().toBuffer(),y=await sharp(b).removeAlpha().raw().toBuffer();assert.equal(x.length,y.length,label+' image geometry');
  let delta=0,changed=0,total=0;for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-y[i]);delta=Math.max(delta,d);total+=d;if(d>4)changed++;}
  // Edge gradients/antialiasing vary by a few channels across identical navigations.
  // Layout/text above must match exactly; permit only sparse raster noise, never shifts.
  const mean=total/x.length,fraction=changed/x.length;
  if(delta>32||mean>0.1||fraction>0.001){writeFileSync(join(output,'comparison-current.png'),a);writeFileSync(join(output,'comparison-baseline.png'),b);}
  assert.ok(delta<=32&&mean<=0.1&&fraction<=0.001,JSON.stringify({label,delta,mean,fraction}));
 }
 const properties=[['bugan','bugan'],['grand-mercure','grand-mercure'],['novotel-leme','deep-ocean'],['novotel-salvador','novotel'],['mercure','mercure'],['default','default']];
 for(const [property,theme]of properties.filter(([p])=>!process.env.V4_BROWSER_FILTER||p===process.env.V4_BROWSER_FILTER))for(const lang of ['pt','en','es'])for(const [width,height]of sizes){
  await page.setViewportSize({width,height});const query={theme,property,lang};
  await visit('/preview',query);assert.equal(await page.locator('[data-public-v4-mobile]').count(),0,'V3 default must stay unchanged');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,property+'/'+lang+'/'+width+' overflow');
  const current=await snapshot();await visit('/preview/before',query);await equalVisual(current,await snapshot(),property+'/'+lang+'/'+width);
  rows.push({property,lang,width,height,mode:'V3 fallback',visualUnchanged:true});
 }
 for(const lang of ['pt','en','es'])for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await visit('/preview',{theme:'bugan',experience:'v4',lang});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const mobile=width<768;assert.equal(await page.locator('[data-public-v4-mobile]').isVisible(),mobile);
  if(mobile){
   assert.equal(await page.locator('[data-legacy-home-access]').isVisible(),false);assert.equal(await page.locator('[data-v4-action]').count(),4);
   for(const a of await page.locator('[data-v4-action]').all()){const b=await a.boundingBox();assert.ok(b.height>=44&&b.width>=44);assert.ok(await a.getAttribute('href'));}
   const wifi=page.locator('.public-v4-wifi');await wifi.locator('summary').click();assert.ok((await wifi.innerText()).includes('Bugan by Atlantica'));assert.ok((await wifi.innerText()).includes('sobrenome'));await wifi.locator('summary').click();
   const breakfast=page.locator('.public-v4-breakfast');await breakfast.locator('summary').click();
   assert.equal(await breakfast.locator('p').innerText(),'Seg–Sex 06:00–10:00; sábados, domingos e feriados 06:00–10:30');
   assert.equal(await breakfast.locator('p').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);await breakfast.locator('summary').click();
   assert.ok((await page.locator('.public-v4-stay-hours').innerText()).includes('14:00'));assert.ok((await page.locator('.public-v4-stay-hours').innerText()).includes('12:00'));
   await page.locator('.v3-menu-trigger').click();assert.equal(await page.getByRole('dialog').isVisible(),true);await page.keyboard.press('Escape');await page.locator('.v3-menu-trigger').evaluate(el=>el.blur());
   await page.locator('.v3-tourism-cards').evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'}));assert.equal(await page.locator('.v3-tourism-cards>a').last().evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right;}),true);
   await page.locator('.v3-tourism-cards').evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
   await page.locator('[data-v4-action]').first().focus();assert.notEqual(await page.locator('[data-v4-action]').first().evaluate(el=>getComputedStyle(el).outlineStyle),'none');await page.locator('[data-v4-action]').first().evaluate(el=>el.blur());
  }else{
   const v4=await snapshot();await visit('/preview/before',{theme:'bugan',experience:'v4',lang});await equalVisual(v4,await snapshot(),'Bugan desktop/tablet preserved '+width);await visit('/preview',{theme:'bugan',experience:'v4',lang});
  }
  assert.equal(await page.locator('.v3-tourism-cards>a').count(),4);assert.equal(await page.locator('.v3-editorial').count(),3);
  if(lang==='pt')writeFileSync(join(output,`bugan-v4-${width}x${height}.png`),await snapshot());
  rows.push({property:'bugan',lang,width,height,mode:'V4',passed:true});
 }
 for(const [property,theme]of properties)if(property!=='bugan'){
  await page.setViewportSize({width:390,height:844});await visit('/preview',{theme,property,experience:'v4'});assert.equal(await page.locator('[data-public-v4-mobile]').isVisible(),true);assert.equal(await page.locator('.public-experience-v3').count(),0,'V4 must not apply Bugan presentation to other presets');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);rows.push({property,mode:'future controlled V4',passed:true});
 }
 await visit('/preview',{experience:'v4',modules:'off'});assert.equal(await page.locator('[data-v4-action]').count(),0);assert.equal(await page.locator('[data-v3-tourism]').count(),0);
 await visit('/preview',{experience:'v4',missing:'essentials'});assert.equal(await page.locator('.public-v4-essentials').count(),0);
 await visit('/preview',{experience:'v4',editor:'1'});const select=page.getByLabel('Composição mobile');await select.selectOption('v4');await page.getByRole('button',{name:'Salvar apresentação'}).click();await page.waitForFunction(()=>!!document.body.dataset.editorialSaved);assert.equal(await page.evaluate(()=>JSON.parse(document.body.dataset.editorialSaved).configuration.experienceVersion),'v4');
 assert.deepEqual(errors,[]);assert.equal(apiRequests,0,'No provider/translation/analytics request during preview reads');
 writeFileSync(join(output,'browser-report.json'),JSON.stringify({scope:'local fixtures, not human production approval',checks:rows,errors,apiRequests},null,2));console.log(`PASS ${rows.length} V4/V3 browser scenarios + unavailable modules/fields + editor + zero API calls`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
