// Local UI matrix. All non-loopback requests are aborted. No live tenant/session.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.url)('esbuild');
const {chromium}=require('playwright');const postcss=require('postcss');
const output=resolve('out/fb-browser');mkdirSync(output,{recursive:true});
const aliases={'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx'),'@/app/admin/cardapio/actions':resolve('tests/browser/fb-actions-stub.ts')};
const options={entryPoints:['tests/browser/fb-fixture.tsx'],bundle:true,platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4193'),'process.env.NODE_ENV':JSON.stringify('development')},alias:aliases};
await build({...options,outfile:join(output,'fixture.js')});
const baselinePaths=['components/public/hotel-public-page-content.tsx','components/public/hotel-public-area-content.tsx','components/public/public-experience-overview.tsx','lib/public-experience-v4.ts'];
const baseline=new Map(baselinePaths.map(p=>[resolve(p),execFileSync('git',['show','e7b514620879f1feb91b2f62b5d27e9e529f843d:'+p],{encoding:'utf8'})]));
await build({...options,outfile:join(output,'baseline.js'),plugins:[{name:'baseline',setup(b){b.onLoad({filter:/\.[tj]sx?$/},args=>baseline.has(args.path)?{contents:baseline.get(args.path),loader:args.path.endsWith('.tsx')?'tsx':'ts',resolveDir:resolve(args.path,'..')}:undefined);}}]});
const css=await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});writeFileSync(join(output,'style.css'),css.css);
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path.startsWith('/storage/v1/object/public/hotel-assets/')){res.setHeader('Content-Type','image/png');res.end(readFileSync('docs/references/bugan/public-v3/restaurante-filipe-real.png'));return;}
 const file=['/fixture.js','/baseline.js','/style.css'].includes(path)?join(output,path.slice(1)):path.startsWith('/brand/')&&!path.includes('..')?join('public',path):null;
 if(file&&existsSync(file)){res.setHeader('Content-Type',extname(file)==='.js'?'application/javascript':extname(file)==='.css'?'text/css':'image/svg+xml');res.end(readFileSync(file));return;}
 if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="'+(path==='/baseline'?'/baseline.js':'/fixture.js')+'"></script></body></html>');
});
await new Promise(r=>server.listen(4193,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.V3_BROWSER_CHANNEL?{channel:process.env.V3_BROWSER_CHANNEL}:{})});
const results=[];const errors=[];let blockedExternal=0;
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'){blockedExternal++;return route.abort();}return route.continue();});
 async function visit(query,path='/'){await page.goto('http://127.0.0.1:4193'+path+'?'+new URLSearchParams(query));await page.locator('h1').first().waitFor();}
 for(let index=0;index<6;index++)for(const lang of ['pt','en','es'])for(const width of [390,1440])for(const enabled of ['0','1'])for(const content of ['0','1'])for(const destination of ['0','1'])for(const view of ['admin','home','gastronomy','menu','room']) {
  await page.setViewportSize({width,height:900});const query={index:String(index),lang,enabled,content,destination,view};await visit(query);
  if(['menu','room'].includes(view)&&enabled==='1'&&content==='1')await page.locator('[data-fb-native] details').first().click();
  if(view==='admin')assert.equal(await page.locator('form').count()>0,enabled==='1');
  if(['gastronomy','menu','room'].includes(view)&&enabled==='1')assert.equal(await page.locator('[data-fb-native]').count(),content==='1'?1:0);
  if(index===4&&view==='room'&&content==='1'&&destination==='1'){if(enabled==='1')await page.locator('[data-fb-native] details').nth(1).click();assert.ok(await page.locator('a[href="https://hotel-bugan.goomer.app/menu"]').count());}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+JSON.stringify(query)+' '+width);
  results.push({...query,width});
  if(lang==='pt'&&enabled==='1'&&content==='1'&&destination==='1'&&view==='menu')await page.screenshot({path:join(output,'hotel-'+index+'-'+width+'.png'),fullPage:true});
 }
 // All four editorial forms; viewer cannot mutate. Actions are test adapters only.
 for(let index=0;index<6;index++)for(const kind of ['outlet','menu','category','item']) {
  await visit({index:String(index),view:'admin',kind,viewer:'1'});assert.equal(await page.locator('fieldset:disabled').count()>0,true);assert.equal(await page.getByRole('button',{name:'Salvar conteúdo PT'}).count(),0);results.push({index,kind,viewer:true});
  await visit({index:String(index),view:'admin',kind});await page.getByRole('button',{name:'Salvar conteúdo PT'}).click();await page.waitForFunction(()=>document.body.dataset.fbLocalSave);results.push({index,kind,localSave:true});
 }
 // Module OFF must preserve baseline rendered output (both V3 and V4).
 for(let index=0;index<6;index++)for(const width of [390,1440]) {
  await page.setViewportSize({width,height:900});await visit({index:String(index),view:'menu',image:'1'});await page.locator('[data-fb-native] details').first().click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-fb-native] > article:first-child img')].length===2&&[...document.querySelectorAll('[data-fb-native] > article:first-child img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({index,width,images:true});
 }
 for(let index=0;index<6;index++)for(const version of ['v3','v4'])for(const view of ['home','gastronomy']) {
  const query={index:String(index),view,version,enabled:'0',content:'1',destination:'1',legacyRoom:'1'};
  await visit(query);const current=await page.locator('#root').innerHTML();await visit(query,'/baseline');assert.equal(await page.locator('#root').innerHTML(),current,'legacy DOM '+JSON.stringify(query));results.push({...query,baseline:true});
 }
 assert.deepEqual(errors,[]);assert.equal(blockedExternal,0);
 writeFileSync(join(output,'report.json'),JSON.stringify({passed:results.length,failed:0,externalRequests:blockedExternal,results},null,2));console.log(JSON.stringify({passed:results.length,failed:0,externalRequests:blockedExternal,screenshots:12}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
