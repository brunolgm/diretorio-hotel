// Isolated visual fixtures; no live Auth, remote tenant, or physical printing.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright'),postcss=require('postcss');
const output=resolve('out/admin-fb-ux-v1/browser');mkdirSync(output,{recursive:true});
await build({entryPoints:['tests/browser/admin-fb-ux-fixture.tsx'],bundle:true,platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',loader:{'.png':'dataurl'},outfile:join(output,'fixture.js'),define:{'process.env':'{}','process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4194'),'process.env.NODE_ENV':JSON.stringify('development')},alias:{'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/admin-fb-navigation-stub.ts'),'node:crypto':resolve('tests/browser/public-v3-crypto-stub.ts'),'@/app/admin/cardapio/actions':resolve('tests/browser/fb-actions-stub.ts')}});
const css=await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});writeFileSync(join(output,'style.css'),css.css+'\n'+readFileSync('components/admin/fb-workspace.css','utf8'));
const server=createServer((req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;if(path.startsWith('/storage/v1/object/public/hotel-assets/')){res.setHeader('Content-Type','image/png');res.end(readFileSync('docs/references/bugan/public-v3/restaurante-filipe-real.png'));return;}const file=['/fixture.js','/style.css'].includes(path)?join(output,path.slice(1)):path.startsWith('/brand/')&&!path.includes('..')?join('public',path):null;if(file&&existsSync(file)){res.setHeader('Content-Type',extname(file)==='.js'?'application/javascript':extname(file)==='.css'?'text/css':'image/svg+xml');res.end(readFileSync(file));return;}if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');});
await new Promise(resolve=>server.listen(4194,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];let external=0;
try{
 const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():(external++,route.abort()));
 const visit=async(params={})=>{await page.goto('http://127.0.0.1:4194/admin/cardapio?'+new URLSearchParams(params));await page.locator('h1').waitFor();};
 const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);};
 if(process.argv.includes('--reorder-only')||process.argv.includes('--reorder-mobile-only')){
  const mobile=process.argv.includes('--reorder-mobile-only');
  if(mobile)for(const width of [390,768,1280,1536]){await page.setViewportSize({width,height:1024});await visit({hotel:'4'});check(await page.locator('form.fb-workspace-reorder').count()===0,'no permanent overview reorder form at '+width);check(await page.getByRole('button',{name:'Organizar ordem',exact:true}).count()===1,'one shared organization action at '+width);}
  await page.setViewportSize({width:mobile?390:1536,height:1024});await visit({hotel:'4'});
  check(await page.locator('form.fb-workspace-reorder').count()===0,'overview has no permanent technical reorder form');
  const originalNames=await page.locator('[data-fb-admin-record] h3').allTextContents();
  if(mobile){
   const cta=page.getByRole('link',{name:'Novo estabelecimento',exact:true});
   check(await cta.evaluate(el=>getComputedStyle(el).whiteSpace==='nowrap'&&el.getBoundingClientRect().height>=44&&el.scrollWidth<=el.clientWidth),'mobile CTA stays legible in one line with 44px touch target');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overview has no horizontal overflow');
   check(await page.locator('[data-fb-admin-workspace]>nav').last().getAttribute('aria-label')==='Paginação gastronômica','overview finishes with pagination');
  }
  await page.screenshot({path:join(output,mobile?'bugan-overview-390.png':'bugan-overview-1536.png'),fullPage:true});
  const trigger=page.getByRole('button',{name:'Organizar ordem',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Organizar ordem',exact:true});await dialog.waitFor();
  if(mobile)check(await dialog.evaluate(el=>{const box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&el.scrollWidth<=el.clientWidth;}),'shared dialog fits mobile viewport');
  check(JSON.stringify(await dialog.locator('form span').allTextContents())===JSON.stringify(originalNames),'dialog lists outlets in current order');
  check(await dialog.locator('select').count()===0,'organization uses clear row arrows without technical selector');
  check(await page.evaluate(()=>getComputedStyle(document.querySelector('[role=dialog]')).backgroundColor===getComputedStyle(document.querySelector('[data-admin-theme]')).getPropertyValue('--admin-surface').trim()) || await dialog.evaluate(el=>el.style.getPropertyValue('--admin-surface').length>0),'dialog inherits current hotel theme');
  const forms=dialog.locator('form');const payload=await forms.first().evaluate(form=>Object.fromEntries(new FormData(form)));
  const snapshot=JSON.parse(payload.rows);check(snapshot.length===originalNames.length&&snapshot.every(row=>row.id&&row.revision>0),'complete revisions/CAS snapshot preserved');
  check(payload.kind==='outlet'&&payload.id===snapshot[0].id&&Number(payload.revision)===snapshot[0].revision,'same kind identity and selected revision');
  check(await forms.first().getByRole('button',{name:'Mover conteúdo para cima',exact:true}).isDisabled(),'first outlet cannot move above boundary');
  check(await forms.last().getByRole('button',{name:'Mover conteúdo para baixo',exact:true}).isDisabled(),'last outlet cannot move below boundary');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});check(await trigger.evaluate(el=>el===document.activeElement),'Escape closes and returns focus');
  check(!await page.evaluate(()=>document.body.dataset.fbLocalMove),'cancel performs no write');
  await trigger.click();await dialog.getByRole('button',{name:'Voltar à Visão Geral',exact:true}).click();await dialog.waitFor({state:'hidden'});check(await page.locator('form.fb-workspace-reorder').count()===0,'return restores clean overview');
  await trigger.click();await dialog.locator('form').first().getByRole('button',{name:'Mover conteúdo para baixo',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.fbLocalMovePayload);
  const moved=JSON.parse(await page.evaluate(()=>document.body.dataset.fbLocalMovePayload));check(moved.direction==='down'&&moved.id===payload.id&&moved.rows===payload.rows&&moved.revision===payload.revision,'existing action receives unchanged CAS fields and direction');
  await visit({hotel:'4',viewer:'1'});check(await page.getByRole('button',{name:'Organizar ordem',exact:true}).count()===0,'viewer organization access remains disabled');
  await visit({hotel:'4',empty:'1'});check(await page.getByRole('button',{name:'Organizar ordem',exact:true}).count()===0,'empty list has no reorder action');
  await visit({hotel:'4',q:'Room'});check(await page.getByRole('button',{name:'Organizar ordem',exact:true}).count()===0,'filtered list retains existing reorder restriction');
 }else{
 for(let hotel=0;hotel<6;hotel++)for(const width of [390,768,1280,1536])for(const view of ['overview','menu','item','editor']){
  await page.setViewportSize({width,height:1024});await visit({hotel:String(hotel),...(view==='overview'?{}:{kind:view==='editor'?'item':view}),...(view==='editor'?{id:'first'}:{})});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow '+hotel+' '+width+' '+view);
  check(await page.locator('[data-fb-workspace-nav] [aria-current=page]').count()===1,'one active contextual section '+hotel+' '+width+' '+view);
  if(width>=1024)check(await page.locator('[data-fb-sidebar]').first().evaluate(el=>el.open),'sidebar expanded '+hotel+' '+view);
  if(hotel===4)await page.screenshot({path:join(output,'bugan-'+view+'-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await visit();await page.getByLabel('Buscar estabelecimento',{exact:true}).fill('Room');await page.getByRole('button',{name:'Filtrar',exact:true}).click();await page.locator('h1').waitFor();check(await page.locator('[data-fb-admin-record]').count()===1,'overview search is functional');check(await page.locator('[data-fb-workspace-nav] a[aria-current=page]').getAttribute('href')==='/admin/cardapio','overview filters preserve selected section');
 await visit({kind:'item',q:'missing-content'});check(await page.getByText('Nenhum resultado para estes filtros',{exact:true}).count()===1,'filtered empty state');
 await visit({empty:'1'});check(await page.getByText('Tudo pronto para começar',{exact:true}).count()===1,'clean initial empty state');
 await visit({kind:'item',large:'1'});check(await page.locator('[data-fb-admin-record]').count()===24,'5000 items render only 24 rich rows');
 await visit({viewer:'1',kind:'item',id:'first'});check(await page.getByRole('button',{name:'Salvar alterações',exact:true}).count()===0,'viewer cannot save');check(await page.locator('[data-fb-workspace-nav] a[href="/admin/pedidos"]').count()===0,'viewer has no orders');check(await page.locator('[data-fb-workspace-nav] a[href="/admin/impressao"]').count()===0,'viewer has no printing');check(await page.locator('fieldset:disabled').count()>0,'viewer fields disabled');
 await visit({orders:'0',printing:'0'});check(await page.locator('[data-fb-workspace-nav] a[href="/admin/pedidos"],[data-fb-workspace-nav] a[href="/admin/impressao"]').count()===0,'capability omissions respected');
 await visit({kind:'item'});await page.getByLabel('Mais ações do conteúdo',{exact:true}).first().click();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Excluir definitivamente',exact:true}).first().click();check(!await page.evaluate(()=>document.body.dataset.fbLocalDelete),'delete cancellation preserves content');page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Excluir definitivamente',exact:true}).first().click();await page.waitForFunction(()=>document.body.dataset.fbLocalDelete==='confirmed');check(true,'delete requires explicit confirmation in isolated action adapter');
 await visit({kind:'item',id:'first'});await page.getByRole('tab',{name:'Preço e disponibilidade',exact:true}).click();check(await page.getByLabel('Moeda (ex.: BRL)',{exact:true}).isVisible(),'segmented pricing panel');await page.getByRole('tab',{name:'Idiomas',exact:true}).click();check(await page.getByText('Pendente · fallback em PT',{exact:true}).count()>0,'revision-safe language state');await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.fbLocalSave);check(true,'existing save action receives hidden panel fields');
 await page.getByRole('tab',{name:'Conteúdo',exact:true}).focus();await page.keyboard.press('ArrowRight');check(await page.getByRole('tab',{name:'Preço e disponibilidade',exact:true}).getAttribute('aria-selected')==='true','keyboard changes editor tab');await page.keyboard.press('Home');check(await page.getByRole('tab',{name:'Conteúdo',exact:true}).getAttribute('aria-selected')==='true','keyboard returns to first editor tab');
 await visit({kind:'item',new:'1'});await page.getByLabel('Nome',{exact:true}).fill('Criação sintética');await page.getByRole('button',{name:'Criar item',exact:true}).click();check(await page.getByRole('tab',{name:'Publicação',exact:true}).getAttribute('aria-selected')==='true','validation reveals the hidden required category panel');check(!await page.evaluate(()=>document.body.dataset.fbLocalSave),'invalid new item does not invoke save');
 await visit({kind:'category',parent:'53030000-0000-4000-8000-000000000005'});check(await page.locator('[data-fb-workspace-nav] a[aria-current=page]').getAttribute('href')==='/admin/cardapio?kind=menu','legacy category URL activates menus');
 await page.setViewportSize({width:390,height:844});await visit();await page.getByRole('button',{name:/menu/i}).first().click();check(await page.getByRole('dialog').count()===1,'existing mobile drawer reused');
 }
 check(errors.length===0,'no browser runtime errors: '+errors.join(';'));check(external===0,'no external requests');
 writeFileSync(join(output,process.argv.includes('--reorder-mobile-only')?'reorder-mobile-report.json':process.argv.includes('--reorder-only')?'reorder-report.json':'report.json'),JSON.stringify({passed:checks.length,failed:0,externalRequests:external,checks},null,2));console.log(JSON.stringify({passed:checks.length,failed:0,externalRequests:external}));
}catch(error){writeFileSync(join(output,'failure.json'),JSON.stringify({passed:checks.length,error:error.message,errors},null,2));throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
