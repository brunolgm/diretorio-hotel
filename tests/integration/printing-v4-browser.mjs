// Authenticated Admin -> actual Next routes -> owned disposable PostgreSQL only.
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {printingLab} from './fb-printing-lab.mjs';
import {rpc,rows,literal} from './fb-c1-fixture.mjs';
export async function verifyV4Browser(x,check){
 const lab=await printingLab(x.s,'v4-browser');
 try{
  for(const t of x.tenants){
   const {credential,destination,printer}=t.v4;
   await rpc(x.server,'heartbeat_fb_print_device',x.auth(credential,{p_software_version:'fixture-1.3.2',p_observed_state:'online'}));
   await rpc(x.server,'report_fb_print_queues',x.auth(credential,{p_queues:[{name:'V4 queue',driver:'V4 driver',state:'unknown'}]}));
   const pending=await rpc(t.admin,'create_current_hotel_fb_print_job',{p_kind:'test',p_destination_id:destination.id,p_sector_id:t.kitchen.id,p_original_job_id:null,p_reason_code:null,p_key:randomUUID()});
   let job=await x.claim(credential);job={...job,...await x.receipt(credential,job)};job={...job,...await x.dispatch(credential,job)};await x.result(credential,job);
   const {page,context}=await lab.login(t.admin);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(lab.base+'/admin/impressao');
   await page.locator('[data-print-status]').getByText('Impressão atualizada',{exact:true}).waitFor();
   check((await lab.api(page,'GET')).status===200,'Actual console HTTP authenticated '+t.slug);
   const c=await page.evaluate(async()=>{const r=await fetch('/api/admin/fb-printing/commissioning');return {status:r.status,data:await r.json()};});
   check(c.status===200&&c.data.tests.some(j=>j.job_id===pending.job_id),'Actual commissioning HTTP sees real PostgreSQL job '+t.slug);
   await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
   await page.getByRole('navigation',{name:'Etapas da implantação'}).getByRole('button',{name:'Testar impressão',exact:false}).click();
   const panel=page.locator('.fb-deploy-panel');
   await panel.getByText('O Spooler recebeu o trabalho. O papel está pendente.',{exact:true}).waitFor();
   check(await panel.getByText(pending.job_id,{exact:true}).count()===1,'Actual UI follows current single job '+t.slug);
   check(await page.getByRole('button',{name:'Continuar',exact:true}).isDisabled(),'Actual pending paper blocks advance '+t.slug);
   check((await panel.innerText()).includes('Homologação anterior preservada'),'Actual UI distinguishes prior proof '+t.slug);
   check(await page.getByLabel('Impressora em implantação').inputValue()===printer.id,'Actual UI selects existing printer without rewriting '+t.slug);
   await page.screenshot({path:join(lab.directory,t.slug+'-desktop-pending.png'),fullPage:true});
   await page.setViewportSize({width:320,height:932});
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Actual mobile 320 has no overflow '+t.slug);
   await page.screenshot({path:join(lab.directory,t.slug+'-mobile-pending.png'),fullPage:true});
   for(const input of await panel.locator('.fb-deploy-paper input').all())await input.check();
   await panel.getByRole('button',{name:'Confirmar papel observado',exact:true}).click();
   await panel.getByText('Evidência humana registrada para este job e esta revisão. Nenhum estado físico futuro é presumido.',{exact:true}).waitFor();
   check(await page.getByRole('button',{name:'Continuar',exact:true}).isEnabled(),'Explicit synthetic human confirmation unblocks actual UI '+t.slug);
   await page.getByRole('button',{name:'Continuar',exact:true}).click();
   await page.getByRole('button',{name:'Concluir implantação',exact:true}).click();
   await page.getByRole('button',{name:'Implantação concluída',exact:true}).waitFor();
   check(await page.getByRole('button',{name:'Implantação concluída',exact:true}).isDisabled(),'Actual explicit conclusion persists '+t.slug);
   await page.reload();
   await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
   await page.getByRole('button',{name:'Implantação concluída',exact:true}).waitFor();
   check((await page.locator('[data-print-deployment]').innerText()).includes('Jornada real ainda não homologada'),'Conclusion keeps ordering journey independent '+t.slug);
   await page.screenshot({path:join(lab.directory,t.slug+'-mobile-concluded.png'),fullPage:true});
   check(errors.length===0,'Actual browser has no runtime errors '+t.slug);
   await context.close();
  }
  check(lab.external===0,'Actual Admin browser makes zero external requests');
 }finally{await lab.stop();}
}

export async function openComputer(page){
 await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
 await page.getByRole('navigation',{name:'Etapas da implantação'}).getByRole('button',{name:'Conectar computador',exact:false}).click();
 for(const label of ['Administração avançada de computadores e credenciais','Gerenciar conexão e credenciais','Adicionar computador de impressão']){
  const summary=page.locator('.fb-deploy-panel').getByText(label,{exact:true});if(await summary.isVisible()&&!await summary.evaluate(e=>e.parentElement.open))await summary.click();
 }
}

export async function verifyMobileKeyboard(page,check,label,directory){
 await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
 await page.setViewportSize({width:320,height:932});
 await page.getByLabel('Navegar pelas etapas').selectOption('4');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.locator('#deployment-name').focus();
 await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 await page.waitForFunction(()=>{const e=document.querySelector('#deployment-name'),r=e.getBoundingClientRect(),f=document.querySelector('.fb-deploy-footer').getBoundingClientRect();return e===document.activeElement&&r.top>=0&&r.bottom<f.top;});
 check(await page.locator('#deployment-name').evaluate(e=>getComputedStyle(e).outlineStyle==='solid'),'Authenticated mobile keyboard retains visible focus '+label);
 check(await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return [...document.querySelectorAll('a')].filter(a=>a.textContent.includes('Pular para')).every(a=>{const s=a.getBoundingClientRect();return s.right<=r.left||s.left>=r.right||s.bottom<=r.top||s.top>=r.bottom;});}),'Authenticated skip link does not overlap focused field '+label);
 await page.screenshot({path:join(directory,label+'-mobile-keyboard-320.png')});
}

export async function verifyPartialRecovery(x,lab,t,page,check){
 const device=await x.cfg(t,'device',{name:'V4 partial recovery computer',active:true}),credential=await x.pair(t,device,'fixture-1.3.2');
 const sector=await rpc(t.admin,'execute_current_hotel_fb_commissioning',{p_operation:'sector',p_body:{name:'V4 isolated recovery sector'},p_key:randomUUID()});
 await rpc(x.server,'heartbeat_fb_print_device',x.auth(credential,{p_software_version:'fixture-1.3.2',p_observed_state:'online'}));
 await rpc(x.server,'report_fb_print_queues',x.auth(credential,{p_queues:[{name:'V4 recovery queue',driver:'V4 driver',state:'unknown'}]}));
 await page.setViewportSize({width:1440,height:1000});
 await page.reload();await page.locator('[data-print-status]').getByText('Impressão atualizada',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
 await page.getByLabel('Impressora em implantação').selectOption('');
 const stage=n=>page.getByRole('navigation',{name:'Etapas da implantação'}).getByRole('button').nth(n-1).click();
 await stage(2);await page.locator('.fb-deploy-panel > .fb-deploy-field select').selectOption(device.id);
 await stage(3);await page.getByRole('radio',{name:'Selecionar V4 recovery queue',exact:true}).check();
 await stage(4);await page.locator('.fb-deploy-panel').getByLabel('Setor').selectOption(sector.id);await page.locator('#deployment-name').fill('V4 recovered destination');
 let committed=null;
 const intercept=async route=>{const req=route.request();if(req.method()==='POST'){const b=req.postDataJSON();if(!committed&&b.operation==='config'&&b.body.kind==='route'){const response=await route.fetch();if(response.status()!==200)throw Error('Owned route did not commit');committed=await response.json();await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'});return;}}await route.continue();};
 await page.route('**/api/admin/fb-printing/console',intercept);
 await page.getByRole('button',{name:'Salvar configuração de impressão',exact:true}).click();
 await page.getByRole('button',{name:'Retomar mesma intenção',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-print-status]')?.textContent.includes('Confirmando'));
 check(Boolean(committed?.id),'Actual partial route committed before simulated lost response');
 await page.unroute('**/api/admin/fb-printing/console',intercept);
 await page.reload();await page.locator('[data-print-status]').getByText('Impressão atualizada',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Implantação',exact:true}).click();
 await page.getByRole('button',{name:'Retomar mesma intenção',exact:true}).click();
 await page.getByRole('button',{name:'Retomar mesma intenção',exact:true}).waitFor({state:'detached'});
 const route=rows('select to_jsonb(r) from fb_print_private.routes r where hotel_id='+literal(t.id)+' and id='+literal(committed.id));
 check(route.revision===1&&route.sector_id===sector.id,'Actual same-key route recovery preserves original ID and revision');
 check(rows('select count(*)::text from fb_print_private.destinations where hotel_id='+literal(t.id)+" and name='V4 recovered destination'")===1,'Actual partial recovery never duplicates confirmed destination');
 check(rows('select count(*)::text from fb_print_private.printers where hotel_id='+literal(t.id)+" and name='V4 recovered destination'")===1,'Actual partial recovery never duplicates confirmed printer');
 await page.screenshot({path:join(lab.directory,t.slug+'-partial-recovered.png'),fullPage:true});
}
