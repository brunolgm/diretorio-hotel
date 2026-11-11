// Actual shared React components + HTTP transport and closed validators; synthetic persistence only.
// This is not a PostgreSQL or physical-print integration test.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {printingV4Fixture,printingId} from '../fixtures/printing-v4.ts';
import {commissioningCommand} from '../../lib/fb/printing/commissioning.ts';
import {validateConsoleCommand} from '../../lib/fb/printing/admin-validation.ts';
const require=createRequire(import.meta.url),{build}=require('esbuild'),{chromium}=require('playwright'),postcss=require('postcss');
const out=resolve('out/printing-v4'),origin='http://127.0.0.1:4224';mkdirSync(out,{recursive:true});
await build({entryPoints:['tests/browser/printing-v4-fixture.tsx'],bundle:true,platform:'browser',jsx:'automatic',format:'esm',tsconfig:'tsconfig.json',outfile:join(out,'fixture.js'),define:{'process.env':'{}','process.env.NODE_ENV':JSON.stringify('development')},alias:{'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/admin-fb-navigation-stub.ts'),'next/image':resolve('tests/browser/public-v3-next-stubs.tsx')}});
const css=await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
writeFileSync(join(out,'style.css'),css.css+'\n'+readFileSync('components/admin/fb-workspace.css','utf8')+'\n'+readFileSync('components/admin/fb-printing.css','utf8'));
let scenario='installed',fixture=printingV4Fixture(),requests=[],effects=[],counter=200,failOnce=false;
const remembered=new Map();const newId=()=>printingId(++counter);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,origin);res.setHeader('Cache-Control','no-store');
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/__reset'){scenario=url.searchParams.get('scenario')??'installed';fixture=printingV4Fixture(scenario);remembered.clear();requests=[];effects=[];failOnce=scenario==='partial';json({ok:true});return;}
 if(url.pathname==='/__fixture'){json(fixture.snapshot);return;}
 if(url.pathname.startsWith('/api/admin/fb-printing/')){
  const {snapshot:s,data:c}=fixture;
  if(req.method==='GET'){json(url.pathname.endsWith('/commissioning')?c:url.searchParams.has('job_id')?{job:s.jobs.find(j=>j.job_id===url.searchParams.get('job_id')),attempts:[],events:[]}:({...s,jobs:s.jobs.filter(j=>!url.searchParams.get('state')||j.state===url.searchParams.get('state'))}));return;}
  try{let raw='';for await(const chunk of req)raw+=chunk;const commissioning=url.pathname.endsWith('/commissioning'),v=(commissioning?commissioningCommand:validateConsoleCommand)(JSON.parse(raw));requests.push({...v,channel:commissioning?'commissioning':'console'});
   if(!s.access.configure){json({error:'forbidden'},403);return;}
   const fp=JSON.stringify(v.body),prior=remembered.get(v.key);if(prior){json(prior.fp===fp?prior.result:{error:'conflict'},prior.fp===fp?200:409);return;}
   const b=v.body;let result={};
   if(v.operation==='config'){
    const property={settings:'settings',device:'devices',destination:'destinations',route:'routes'}[b.kind];if(!property)throw Error('unsupported fixture configuration');
    const rows=s.config[property]??(s.config[property]=[]),existing=b.kind==='settings'?rows[0]:rows.find(r=>r.id===b.id);
    if((existing?.revision??0)!==b.revision){json({error:'conflict'},409);return;}
    result={...(existing??{}),id:existing?.id??newId(),...b.values,revision:(existing?.revision??0)+1};if(b.kind==='settings')result.enabled=existing?.enabled??false;
    if(b.kind==='device')Object.assign(result,{revoked_at:null,last_seen_at:null,software_version:null,protocol_version:null,observed_state:'unknown'});
    if(existing)Object.assign(existing,result);else rows.push(result);
    if(b.kind==='route')s.access.destinations.push({id:result.destination_id,name:s.config.destinations.find(d=>d.id===result.destination_id)?.name??'Destino',sector_id:result.sector_id});
   }else if(v.operation==='select_queue'){
    const q=c.queues.find(q=>q.queue_key===b.queue_key&&q.device_id===b.device_id),p=s.config.printers.find(p=>p.id===b.printer_id);
    if(!q?.present||q.revision!==b.queue_revision||(p?.revision??0)!==b.revision){json({error:'conflict'},409);return;}
    result={id:p?.id??newId(),name:b.name,device_id:b.device_id,destination_id:b.destination_id,active:true,adapter:'windows_spooler',config:{queue_name:q.queue_name,driver:q.driver_name},priority:0,revision:(p?.revision??0)+1,queue_key:q.queue_key,queue_fingerprint:q.fingerprint,observed_state:'unknown',observed_at:c.server_time};if(p)Object.assign(p,result);else s.config.printers.push(result);
   }else if(v.operation==='sector'){result={id:newId(),name:b.name,active:true,revision:1};s.access.sectors.push(result);c.sectors.push(result);}
   else if(v.operation==='test'){
    const p=s.config.printers.find(p=>p.destination_id===b.destination_id),pending=c.tests.find(t=>t.printer_id===p.id&&t.printer_revision===p.revision&&!c.human_verifications.some(v=>v.job_id===t.job_id));
    if(pending){json({error:'conflict'},409);return;}
    result={job_id:newId(),kind:'test',state:'queued'};c.tests.unshift({...result,state:'submitted',destination_id:b.destination_id,sector_id:b.sector_id,printer_id:p.id,printer_revision:p.revision,created_at:new Date().toISOString(),receipt_at:c.server_time,dispatch_at:c.server_time,revision:1});
   }else if(v.operation==='verify_test'){const t=c.tests.find(t=>t.job_id===b.job_id);if(t?.state!=='submitted'){json({error:'invalid_input'},400);return;}c.human_verifications.push({job_id:t.job_id,printer_id:t.printer_id,printer_revision:t.printer_revision,verified_by:c.actor_id,verified_at:new Date().toISOString()});result={human_verified:true,job_id:t.job_id};}
   else if(v.operation==='complete_deployment'){c.completed_reviews.push({...b,completed_at:new Date().toISOString()});result={completed:true};}
   else if(v.operation==='end_override'){if(b.revision!==s.config.settings[0].revision){json({error:'conflict'},409);return;}s.config.settings[0].revision++;c.override=null;result={revision:s.config.settings[0].revision,override_ended:true};}
   else if(v.operation==='reprint'){result={job_id:newId(),kind:'reprint',state:'queued',duplicate_risk:true};}
   else if(v.operation==='pairing')result={one_time_secret:'LG-SYNTHETIC-ONE-TIME',secret_kind:'pairing',expires_at:new Date(Date.now()+300000).toISOString()};
   else if(v.operation==='refresh')result={requested:true};
   else if(v.operation==='revoke'||v.operation==='rotate'){json({error:'forbidden'},403);return;}
   else throw Error('unsupported fixture command');
   effects.push({operation:v.operation,body:b,key:v.key});remembered.set(v.key,{fp,result});
   if(v.operation==='config'&&b.kind==='route'&&failOnce){failOnce=false;json({error:'unavailable'},503);return;}
   json(result);return;
  }catch(e){json({error:'invalid_input',fixture_error:e.message},400);return;}
 }
 if(['/fixture.js','/style.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');res.end(readFileSync(join(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');
});
await new Promise(r=>server.listen(4224,'127.0.0.1',r));
if(process.argv.includes('--serve')){console.log('Controlled preview: '+origin);await new Promise(()=>{});}
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[],external=[],captures=[];
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);};
let page;
try{
 page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
 const visit=async(params={},state='installed')=>{await fetch(origin+'/__reset?scenario='+state);await page.goto(origin+'/?'+new URLSearchParams(params));await page.getByText('Impressão atualizada',{exact:true}).waitFor();if(state!=='readonly')await page.waitForFunction(()=>document.querySelector('[data-print-deployment]')?.textContent.includes('ETAPA'));};
 const tab=label=>page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:label,exact:true});
 const stage=async n=>{if(await page.locator('.fb-deploy-mobile-step').isVisible())await page.locator('.fb-deploy-mobile-step select').selectOption(String(n));else await page.getByRole('navigation',{name:'Etapas da implantação'}).getByRole('button').nth(n-1).click();};
 const shot=async name=>{await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;});await page.screenshot({path:join(out,name+'.png'),fullPage:false});captures.push(name+'.png');};
 const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 for(const [theme,extra] of (process.argv.includes('--flow')?[]:[['bugan',''],['grand-mercure',''],['novotel',''],['novotel','salvador'],['mercure',''],['libguest-default','']])){
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await visit({theme,...(extra?{[extra]:'1'}:{})});
   check(await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button').count()===5,'Five areas '+theme+extra+width);
   check(await page.locator('[data-admin-theme]').getAttribute('data-admin-theme')===theme,'Inherited hotel theme '+theme+extra+width);
   check((await page.locator('.fb-print-overview').innerText()).includes('sem QR ativo'),'Missing room access diagnosed '+theme+extra+width);
   if(theme==='bugan'&&width===1440)await shot('desktop-overview-readiness');await tab('Implantação').click();await stage(5);
   check((await page.locator('.fb-deploy-panel-top').innerText()).includes('Papel pendente'),'Pending job label '+theme+extra+width);
   check(await page.locator('.fb-deploy-footer button').last().isDisabled(),'Pending paper blocks advancement '+theme+extra+width);
   check((await page.locator('.fb-deploy-panel').innerText()).includes('Ela não confirma o papel deste job'),'Historical proof is distinct '+theme+extra+width);
   check(await fits(),'No overflow '+theme+extra+width);check(requests.length===0,'Inspecting historical configuration makes no writes '+theme+extra+width);
   await shot(theme+extra+'-'+width+'-pending');
  }
 }
 await page.setViewportSize({width:320,height:932});await visit();await tab('Implantação').click();await stage(4);
 await page.locator('select').filter({visible:true}).count();await page.locator('#deployment-name').focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 check(await page.locator('#deployment-name').evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle==='solid'),'320 px real keyboard focus visible');
 await shot('mobile-320-keyboard');
 await stage(5);for(const input of await page.locator('.fb-deploy-paper input').all())await input.check();
 check(await page.locator('.fb-deploy-footer button').last().isDisabled(),'Checklist alone is not proof');
 await page.getByRole('button',{name:'Confirmar papel observado'}).click();await page.waitForFunction(()=>document.querySelector('.fb-deploy-panel-top')?.textContent.includes('Validada'));
 check(fixture.data.human_verifications.length===2,'Explicit verify preserves historical proof');check(effects.filter(e=>e.operation==='test').length===0,'Review never sends another test');
 await stage(6);check((await page.locator('.fb-deploy-panel-top').innerText()).includes('Pronta para concluir'),'Ready is not concluded');await shot('mobile-ready-to-complete');
 await page.getByRole('button',{name:'Concluir implantação',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.fb-deploy-panel-top')?.textContent.includes('Concluída'));check(fixture.data.completed_reviews.length===1,'Conclusion explicit once');
 check(fixture.data.mode==='ordering'&&fixture.snapshot.config.settings[0].enabled,'Conclusion preserves ordering and printing');await shot('mobile-concluded');
 // A committed route response is lost. Refresh must recover the same intent and exact IDs.
 await page.setViewportSize({width:1440,height:1000});await visit({},'partial');await tab('Implantação').click();
 await page.locator('.fb-deploy-context select').selectOption('');await stage(3);await page.getByRole('radio',{name:'Selecionar Bar',exact:true}).check();await stage(4);
 await page.locator('.fb-deploy-panel .fb-deploy-fields').first().getByRole('combobox').first().selectOption(printingId(22));await page.locator('#deployment-name').fill('Destino do bar');await page.getByRole('button',{name:'Salvar configuração de impressão',exact:true}).click();
 await page.getByRole('button',{name:'Retomar mesma intenção'}).waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Retomar mesma intenção')?.disabled===false);await page.waitForFunction(()=>!document.querySelector('[data-print-deployment]')?.textContent.includes('Verificação indisponível'));for(let attempt=0;attempt<3&&!effects.some(e=>e.body.kind==='route');attempt++){await page.getByRole('button',{name:'Retomar mesma intenção'}).click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Retomar mesma intenção')?.disabled===false);}
 const ids=fixture.snapshot.config.printers.map(p=>p.id);check(ids.length===2&&fixture.snapshot.config.destinations.length===2,'Confirmed partial save retained');
 await page.reload();await page.getByText('Impressão atualizada',{exact:true}).waitFor();await tab('Implantação').click();await page.getByRole('button',{name:'Retomar mesma intenção'}).click();await page.waitForFunction(()=>!document.querySelector('[data-print-deployment]')?.textContent.includes('Retomar mesma intenção'));
 check(JSON.stringify(fixture.snapshot.config.printers.map(p=>p.id))===JSON.stringify(ids),'Reload recovery preserves exact printer IDs');check(fixture.snapshot.config.routes.length===2,'Route replay creates no duplicate');
 const routeRequests=requests.filter(r=>r.body.kind==='route');check(routeRequests.length===2&&routeRequests[0].key===routeRequests[1].key,'Lost response reuses the same stable key');check(fixture.data.human_verifications.length===1,'Adding printer preserves original evidence');await shot('desktop-partial-recovered');
 await stage(5);await page.getByRole('button',{name:'Solicitar um teste autorizado'}).click();await page.waitForFunction(()=>document.querySelector('.fb-deploy-job')?.textContent.includes('Papel pendente'));check(effects.filter(e=>e.operation==='test').length===1,'Single new synthetic test intent');
 await page.reload();await page.getByText('Impressão atualizada',{exact:true}).waitFor();await tab('Implantação').click();check(await page.getByRole('button',{name:'Solicitar um teste autorizado'}).count()===0,'Reload tracks existing job without a new test');
 await visit({},'maintenance');await tab('Implantação').click();await stage(6);await page.getByText('Operação, modo do cardápio e manutenção supervisionada',{exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Encerrar manutenção',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-print-deployment]')?.textContent.includes('Nenhuma exceção técnica registrada.'));check(fixture.snapshot.config.settings[0].enabled&&fixture.data.mode==='ordering','Ending override preserves printing and ordering');check(effects.filter(e=>e.operation==='technical_override').length===0,'Ending does not renew override');
 // Existing queue, details, filters, reprint confirmation and contextual grants remain available.
 await visit();await tab('Fila').click();check(await page.locator('[data-print-job]').count()===2,'Existing queue cards retained');
 await page.getByRole('button',{name:'Resultados incertos',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-print-job]').length===1);check((await page.locator('[data-print-job]').innerText()).includes('Resultado incerto'),'Queue uncertainty filter retained');
 await page.getByRole('button',{name:'Detalhes técnicos',exact:true}).click();await page.locator('[data-print-detail]').waitFor();check((await page.locator('[data-print-detail]').innerText()).includes('Fence'),'Technical detail remains contextual');await shot('desktop-queue-detail');
 const reprint=page.locator('[data-print-detail] form');await reprint.getByRole('combobox').selectOption('ambiguous_review');await reprint.getByRole('checkbox').check();page.once('dialog',d=>d.dismiss());await reprint.getByRole('button',{name:'Salvar reimpressão autorizada'}).click();check(!effects.some(e=>e.operation==='reprint'),'Cancelled confirmation creates no copy');
 page.once('dialog',d=>d.accept());await reprint.getByRole('button',{name:'Salvar reimpressão autorizada'}).click();await page.waitForFunction(()=>document.querySelector('[data-print-status]')?.textContent==='Impressão atualizada');check(effects.some(e=>e.operation==='reprint'&&e.body.reason==='ambiguous_review'&&e.body.revision===3),'Reprint retains revision and controlled reason');
 await page.getByRole('button',{name:'Permissões e acesso',exact:true}).click();check(await page.getByRole('heading',{name:'Permissões de impressão',exact:true}).isVisible(),'Grant management remains available outside primary tabs');
 const grants=page.locator('[data-print-config] form').filter({has:page.getByRole('heading',{name:'Permissão',exact:true})});await grants.getByRole('combobox',{name:'Permissão',exact:true}).selectOption('printing.configure');check(await grants.getByRole('combobox',{name:'Usuário ativo',exact:true}).locator('option').count()===2,'Configure excludes operator role');check(await grants.getByRole('combobox',{name:'Setor (vazio: todos)',exact:true}).locator('option').count()===1,'Configure does not offer invalid sector grant');await shot('desktop-permissions');
 for(const width of [320,360,390,768,1024,1440]){await page.setViewportSize({width,height:932});await visit();await tab('Implantação').click();for(let n=1;n<=6;n++){await stage(n);check(await fits(),'All six stages responsive '+width+' '+n);}}
 // First installation uses canonical configuration commands before a one-time fictitious pairing code.
 await page.setViewportSize({width:390,height:932});await visit({},'new');await tab('Implantação').click();await stage(1);
 const policy=page.locator('.fb-deploy-panel form').filter({has:page.getByRole('heading',{name:'Política de impressão',exact:true})});await policy.getByRole('checkbox').last().check();await policy.getByRole('button').click();await page.waitForFunction(()=>document.querySelector('[data-print-status]')?.textContent==='Impressão atualizada');
 await page.getByText('Criar setor autorizado',{exact:true}).click();const sector=page.locator('.fb-deploy-panel form').filter({has:page.getByRole('heading',{name:'Setor',exact:true})});await sector.getByRole('textbox').fill('Setor sintético');await sector.getByRole('checkbox').check();await sector.getByRole('button').click();await page.waitForFunction(()=>document.querySelector('.fb-deploy-footer button:last-child')?.disabled===false);check(fixture.snapshot.access.sectors.length===1,'First sector created only through an authorized command');await shot('mobile-first-preparation');
 await stage(2);const computer=page.locator('.fb-deploy-panel form').filter({has:page.getByRole('heading',{name:'Computador de impressão',exact:true})}).first();await computer.getByRole('textbox').fill('PC de homologação');await computer.getByRole('checkbox').check();await computer.getByRole('button').click();await page.waitForFunction(()=>document.querySelector('.fb-deploy-resource')?.textContent.includes('PC de homologação'));
 check(await page.getByRole('button',{name:'Gerar código de pareamento',exact:true}).isDisabled(),'Pairing requires installation preparation');await page.getByLabel('Pacote oficial e instalação preparados no computador selecionado.').check();
 await page.clock.install();await page.getByRole('button',{name:'Gerar código de pareamento',exact:true}).click();await page.locator('[data-print-secret]').waitFor();check((await page.locator('[data-print-secret]').innerText()).includes('Uso único')&&(await page.locator('[data-print-secret]').innerText()).includes('60 segundos'),'One-time pairing has separate visibility and validity guidance');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.fixtureCopiedCode=text;}}}));await page.getByRole('button',{name:'Copiar código',exact:true}).click();check(await page.evaluate(()=>window.fixtureCopiedCode==='LG-SYNTHETIC-ONE-TIME'),'Copy contains only the fictitious code');
 check(await page.evaluate(()=>Object.values(sessionStorage).every(v=>!v.includes('LG-SYNTHETIC-ONE-TIME'))),'One-time secret is never persisted with resumable draft');await shot('mobile-pairing-fictitious');
 await page.clock.fastForward(61000);await page.waitForFunction(()=>!document.querySelector('[data-print-secret]'));check(await page.locator('[data-print-secret]').count()===0,'Pairing display is removed after sixty seconds');
 await visit({},'readonly');check(await tab('Implantação').count()===0,'Read-only access cannot configure');check(requests.length===0,'Read-only inspection writes nothing');
 check(errors.length===0,'Zero runtime errors');check(external.length===0,'Zero external requests');
 writeFileSync(join(out,'report.json'),JSON.stringify({passed:checks.length,failed:0,checks,errors,external,captures,limitations:['HTTP persistence is synthetic; PostgreSQL integration requires the local Docker daemon.','No real credentials, tenant, order, service or print I/O.']},null,2));writeFileSync(join(out,'index.html'),'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Impressão Premium V4 universal - evidências</title><style>body{font:15px/1.5 system-ui;background:#f3eee7;color:#2d2926;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;background:#fffdf9;border:1px solid #d6d2c4;border-radius:12px;padding:12px}img{width:100%;height:620px;object-fit:contain;object-position:top}a{color:#8f5028}</style><h1>Impressão Premium V4 universal</h1><p>Componentes reais, dados controlados. Sem tenant, pedido ou impressão real. '+checks.length+' checks browser aprovados. Integração PostgreSQL ainda depende de Docker local.</p><p><a href="report.json">Resultados detalhados</a></p><main>'+captures.map(n=>'<figure><a href="'+n+'"><img src="'+n+'" alt="'+n+'"></a><figcaption>'+n+'</figcaption></figure>').join('')+'</main></html>');console.log(JSON.stringify({passed:checks.length,failed:0,captures:captures.length}));
}catch(e){if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true});writeFileSync(join(out,'failure.json'),JSON.stringify({passed:checks.length,error:e.stack,errors,fixture,requests,effects},null,2));throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
