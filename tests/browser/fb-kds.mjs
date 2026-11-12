// Real components with synthetic API fixtures. No network, authentication or physical I/O.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright'),postcss=require('postcss');
const output=resolve('out/kds-universal/browser');mkdirSync(output,{recursive:true});
await build({entryPoints:['tests/browser/fb-kds-fixture.tsx'],bundle:true,platform:'browser',jsx:'automatic',tsconfig:'tsconfig.json',outfile:join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"development"'},alias:{'@/app/admin/pedidos/actions':resolve('tests/browser/fb-kds-actions-stub.ts')}});
const css=await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});writeFileSync(join(output,'style.css'),css.css+'\n'+readFileSync(join(output,'fixture.css'),'utf8'));
const server=createServer((req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;if(['/fixture.js','/style.css'].includes(path)){res.setHeader('Content-Type',path.endsWith('js')?'application/javascript':'text/css');res.end(readFileSync(join(output,path.slice(1))));return;}if(path.startsWith('/api/')){res.writeHead(403);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');});
await new Promise(r=>server.listen(4205,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[],captures=[];let external=0;
const check=(v,label)=>{assert.ok(v,label);checks.push(label);};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():(external++,route.abort()));
 const visit=async(p={})=>{await page.goto('http://127.0.0.1:4205/?'+new URLSearchParams(p));await page.locator('h1').waitFor();};
 const shot=async name=>{await page.screenshot({path:join(output,name+'.png'),fullPage:true});captures.push(name);};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await visit({view:'orders',mobile:width<500?'1':'0'});await page.getByText('Lista atualizada',{exact:false}).waitFor();
  check(await page.locator('.fb-orders-queue button').count()===8,'all orders in queue '+width);check(await page.locator('[data-fb-operation-order]').count()===1,'one selected detail '+width);await shot('orders-'+width);
  await page.getByRole('searchbox').fill('suco');check(await page.locator('.fb-orders-queue button').count()===2,'search authorized item '+width);await page.getByRole('searchbox').fill('');
  await page.getByLabel('Status',{exact:true}).selectOption('preparing');check(await page.locator('.fb-orders-queue button').count()===2,'status filter '+width);await page.getByLabel('Status',{exact:true}).selectOption('');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'responsive orders '+width);
  page.once('dialog',d=>d.dismiss());await page.getByRole('checkbox',{name:'Confirmo o cancelamento deste pedido'}).check();await page.getByRole('button',{name:'Cancelar pedido pela equipe'}).click();check(!await page.evaluate(()=>document.body.dataset.fixtureAction),'dismissed cancellation sends nothing '+width);
 }
 await page.setViewportSize({width:1920,height:1080});await visit({view:'display'});await page.getByText('● Conectado').waitFor();check(await page.locator('[data-kds-ticket]').count()===8,'KDS renders groups');check(await page.getByRole('button',{name:'Aceitar',exact:true}).count()===0,'monitor has no transition actions');await shot('kds-monitor-tv');await shot('kds-multiple-sectors');
 await page.evaluate(()=>{document.body.dataset.fixtureOffline='1';window.dispatchEvent(new Event('offline'));});await page.getByText(/Conexão interrompida ou atualização pendente/).waitFor();await shot('kds-offline');await page.evaluate(()=>{delete document.body.dataset.fixtureOffline;window.dispatchEvent(new Event('online'));});await page.getByText('● Conectado').waitFor();checks.push('offline warning and online recovery');
 await visit({view:'display',mode:'operational'});await page.getByText('● Conectado').waitFor();await shot('kds-operational');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Aceitar',exact:true}).first().click();check(!await page.evaluate(()=>document.body.dataset.fixturePost),'sensitive action requires confirmation');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Aceitar',exact:true}).first().click();await page.getByText('Operação confirmada.',{exact:true}).waitFor();const command=await page.evaluate(()=>JSON.parse(document.body.dataset.fixturePost));check(command.operation==='transition'&&command.revision===1&&!('hotel_id' in command),'KDS action sends CAS without tenant authority');
 await page.evaluate(()=>{document.body.dataset.fixtureOffline='1';window.dispatchEvent(new Event('offline'));});check(await page.getByRole('button',{name:'Iniciar preparo',exact:true}).first().isDisabled(),'offline operational actions disabled');
 check((await page.getByRole('link',{name:'Detalhes autorizados'}).first().getAttribute('href')).startsWith('/admin/pedidos?q='),'authorized details reuse existing admin panel');
 await visit({view:'display',empty:'1'});await page.getByText('Nenhum pedido neste momento').waitFor();await shot('kds-empty');
 await visit({view:'display',pair:'1'});await page.getByRole('button',{name:'Parear tela'}).waitFor();await shot('kds-pairing');check(await page.locator('[data-kds-ticket]').count()===0,'unpaired screen exposes no tickets');
 for(const layout of ['compact','tickets']){await visit({view:'display',layout});await page.getByText('● Conectado').waitFor();await shot('kds-'+layout);}
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await visit({view:'admin'});await page.getByRole('button',{name:'Telas',exact:true}).click();await shot('admin-screens-'+width);await page.getByRole('button',{name:'Exibição',exact:true}).click();await shot('admin-settings-'+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'responsive admin '+width);
  await page.getByRole('button',{name:'Segurança',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Gerar código temporário'}).click();await page.locator('.kds-pair-code code').waitFor();await shot('admin-pairing-'+width);check(!page.url().includes('CODIGO'),'pair code absent from URL '+width);
  await page.getByRole('button',{name:'Telas',exact:true}).click();await page.getByRole('button',{name:'Nova tela',exact:true}).click();await page.getByRole('textbox',{name:'Nome',exact:true}).fill('Tablet novo SINTÉTICO');await page.getByRole('checkbox',{name:'Cozinha sintética',exact:true}).check();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Salvar tela e configurações'}).click();await page.getByText('Tela salva. Faça o pareamento em Segurança.').waitFor();const saved=await page.evaluate(()=>JSON.parse(document.body.dataset.fixturePost));check(saved.operation==='save'&&saved.screen.revision===0&&saved.screen.sector_ids.length===1&&!('hotel_id' in saved.screen),'new screen saves tenant-free payload '+width);
  await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement!==document.body),'keyboard focus remains available '+width);
 }
 check(errors.length===0,'no browser runtime errors: '+errors.join('; '));check(external===0,'no external requests');writeFileSync(join(output,'report.json'),JSON.stringify({passed:checks.length,checks,captures,errors,external,synthetic:true},null,2));console.log(JSON.stringify({passed:checks.length,captures:captures.length,output}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
