import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {seedC1,rpc,rows,literal} from './fb-c1-fixture.mjs';
import {printingLab} from './fb-printing-lab.mjs';
import {openComputer,verifyMobileKeyboard,verifyPartialRecovery} from './printing-v4-browser.mjs';
import {verifyC3Polling} from './fb-c3-polling.mjs';
const checks=[],check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};let x,lab;
const query=sql=>rows("select coalesce(jsonb_agg(to_jsonb(t)),'[]') from ("+sql+')t');
const command=(actor,operation,body,key=randomUUID())=>rpc(actor,'execute_current_hotel_fb_print_admin',{p_operation:operation,p_body:body,p_key:key});
const consoleRpc=(actor,args={})=>rpc(actor,'get_current_hotel_fb_print_console',args);
try{
 x=await seedC1();const {tenants,grant,order,accept,materialize}=x;
 for(const t of tenants){
  const initial=await consoleRpc(t.admin);check(initial.access.manage_grants&&!initial.access.configure&&!initial.config.settings,'administrator bootstraps explicit capabilities, no enabled settings '+t.name);
  for(const cap of ['printing.configure','printing.test','printing.reprint']){const prior=query('select revision from fb_print_private.grants where hotel_id='+literal(t.id)+' and user_id='+literal(t.admin.id)+' and capability='+literal(cap)+' and sector_id is null')[0];await command(t.admin,'grant',{user_id:t.admin.id,capability:cap,sector_id:null,active:true,revision:prior?.revision??0});}
  const denied=await t.viewer.client.rpc('get_current_hotel_fb_print_console');check(denied.error?.code==='42501','viewer denied at actual RPC '+t.name);
  const setup=(await consoleRpc(t.admin)).config.settings?.[0];await command(t.admin,'config',{kind:'settings',id:null,revision:setup?.revision??0,values:{ticket_minutes:120}});let setting=(await consoleRpc(t.admin)).config.settings[0];check(!setting.enabled&&!setting.allow_name&&!setting.fan_out,'printing/name/fan-out default OFF '+t.name);
  const normal=await t.admin.client.rpc('execute_current_hotel_fb_print_admin',{p_operation:'activate',p_body:{enabled:true,revision:setting.revision},p_key:randomUUID()});check(normal.error?.code==='PT409','normal activation requires commissioning '+t.name);
  await rpc(t.admin,'execute_current_hotel_fb_commissioning',{p_operation:'technical_override',p_body:{enabled:true,revision:setting.revision,reason:'isolated_contract_validation'},p_key:randomUUID()});
  t.c3device=await command(t.admin,'config',{kind:'device',id:null,revision:0,values:{name:'C3 bridge '+t.name}});t.c3backup=await command(t.admin,'config',{kind:'device',id:null,revision:0,values:{name:'C3 backup'}});
  t.c3dest=await command(t.admin,'config',{kind:'destination',id:null,revision:0,values:{name:'Destino Cozinha/Bar',device_id:t.c3device.id,backup_device_id:t.c3backup.id}});
  await command(t.admin,'config',{kind:'printer',id:null,revision:0,values:{name:'C3 LAB metadata only',device_id:t.c3device.id,destination_id:t.c3dest.id,adapter:'windows_spooler',config:{queue_name:'LIBGUEST_LAB_NO_SUBMISSION'}}});
  for(const sector of [t.kitchen,t.bar])await command(t.admin,'config',{kind:'route',id:null,revision:0,values:{sector_id:sector.id,destination_id:t.c3dest.id}});
  const current=await consoleRpc(t.admin);check(current.config.devices.length===2&&current.config.routes.length===2,'same C3 configuration domain '+t.name);check(!/digest|credential|pairing_token|first_name|line_notes/.test(JSON.stringify(current)),'console includes no device secrets or guest payload '+t.name);
  const changed=await command(t.admin,'config',{kind:'device',id:t.c3device.id,revision:1,values:{name:'C3 primary'}});const stale=await t.admin.client.rpc('execute_current_hotel_fb_print_admin',{p_operation:'config',p_body:{kind:'device',id:t.c3device.id,revision:1,values:{name:'STALE'}},p_key:randomUUID()});check(stale.error?.code==='PT409','two admin revisions cannot overwrite current config '+t.name);t.c3device=changed;
  const created=await order(t,x.combo(t));t.c3order=created;for(const group of created.groups)await accept(t,group);await materialize(t);
  const printJobs=(await consoleRpc(t.admin)).jobs;check(printJobs.length===2&&printJobs.every(j=>j.sector_name&&j.destination_name&&j.can_reprint),'queue shows separate accepted group metadata '+t.name);
  const credential=await x.pair(t,t.c3device);let job=await x.claim(credential);job=await x.receipt(credential,job);job=await x.dispatch(credential,job);await x.result(credential,job,'ambiguous');t.c3ambiguous=job.job_id;
  const detail=await rpc(t.admin,'get_current_hotel_fb_print_detail',{p_job_id:job.job_id});check(detail.job.state==='ambiguous'&&detail.attempts.length===1&&detail.events.some(e=>e.action==='dispatch_authorized'),'detail shows attempts/events/ambiguity without payload '+t.name);check(!/snapshot_canonical|line_notes|room_label|C1PrivateLineNote/.test(JSON.stringify(detail)),'detail contains no transient PII '+t.name);
  const count=Number(rows('select count(*)::text from fb_order_private.orders where hotel_id='+literal(t.id)));const key=randomUUID(),body={destination_id:t.c3dest.id,sector_id:t.kitchen.id};const test1=await command(t.admin,'test',body,key),test2=await command(t.admin,'test',body,key);check(test1.job_id===test2.job_id&&Number(rows('select count(*)::text from fb_order_private.orders where hotel_id='+literal(t.id)))===count,'test has one logical job and no fabricated order '+t.name);
  const latest=await rpc(t.admin,'get_current_hotel_fb_print_detail',{p_job_id:job.job_id});const rekey=randomUUID(),rebody={destination_id:t.c3dest.id,original_job_id:job.job_id,reason:'ambiguous_review',revision:latest.job.revision};const copies=await Promise.all([command(t.admin,'reprint',rebody,rekey),command(t.admin,'reprint',rebody,rekey)]);check(copies[0].job_id===copies[1].job_id&&copies[0].duplicate_risk,'concurrent human reprint is independent/idempotent '+t.name);
  const staleCopy=await t.admin.client.rpc('execute_current_hotel_fb_print_admin',{p_operation:'reprint',p_body:rebody,p_key:randomUUID()});check(staleCopy.error?.code==='PT409','independent reprint cannot reuse consumed source revision '+t.name);
  const foreign=await tenants[(tenants.indexOf(t)+1)%tenants.length].admin.client.rpc('get_current_hotel_fb_print_detail',{p_job_id:job.job_id});check(foreign.error?.code==='42501','cross tenant detail refused '+t.name);
  await grant(t,t.operator,'printing.test',t.kitchen.id);const scoped=await consoleRpc(t.operator);check(scoped.jobs.every(j=>j.sector_id===t.kitchen.id),'order-read scope filters jobs '+t.name);check(!scoped.config.devices,'test-only operator cannot read device configuration '+t.name);
  const wrongSector=await t.operator.client.rpc('execute_current_hotel_fb_print_admin',{p_operation:'test',p_body:{destination_id:t.c3dest.id,sector_id:t.bar.id},p_key:randomUUID()});check(wrongSector.error?.code==='42501','cross-sector printing.test denied '+t.name);
  console.log('C3 real RPC/config/CAS/queue/ambiguity/roles: '+t.name);
 }
 const load=tenants[5];
 // Each historical test belongs to a different frozen printer revision. V4 must
 // still refuse a second pending test in the current revision.
 const pending=await load.admin.client.rpc('execute_current_hotel_fb_print_admin',{p_operation:'test',p_body:{destination_id:load.c3dest.id,sector_id:load.kitchen.id},p_key:randomUUID()});check(pending.error?.code==='PT409','pagination fixture cannot bypass the V4 single pending test gate');
 const loadPrinter=(await consoleRpc(load.admin)).config.printers[0];
 for(let n=0;n<112;n++){await x.cfg(load,'printer',{name:'C3 historical revision '+n},loadPrinter.id);await command(load.admin,'test',{destination_id:load.c3dest.id,sector_id:load.kitchen.id});}const seen=[];let cursor={};for(let p=0;p<20;p++){const page=await consoleRpc(load.admin,{p_limit:25,...cursor});check(page.jobs.length<=25,'bounded C3 queue page '+p);seen.push(...page.jobs.map(j=>j.job_id));if(!page.next)break;cursor={p_after_created:page.next.created_at,p_after_id:page.next.id};}check(seen.length>100&&seen.length===new Set(seen).size,'over 100 jobs paginate without loss/duplication');
 lab=await printingLab(x.s,'c3');
 const secrets=[];for(const t of tenants){
  const {page,context}=await lab.login(t.admin);await page.goto(lab.base+'/admin/impressao');await page.locator('[data-print-status]').getByText('Impressão atualizada',{exact:true}).waitFor();await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Fila',exact:true}).click();check(await page.getByRole('heading',{name:'Impressão',exact:true}).count()===1,'existing Admin renders C3 '+t.name);check(await page.locator('[data-print-job]').count()<=25,'browser renders only one queue page '+t.name);
  const noConfirm=await lab.api(page,'POST',{operation:'activate',body:{enabled:false,revision:1},key:randomUUID()});check(noConfirm.status===400,'HTTP action requires confirmation '+t.name);
  const invalid=await lab.api(page,'POST',{operation:'test',body:{destination_id:t.c3dest.id,sector_id:t.kitchen.id,hotel_id:t.id},key:randomUUID(),confirmed:true});check(invalid.status===400,'HTTP rejects forged tenant field '+t.name);
  await openComputer(page);
  const create=page.locator('form').filter({has:page.getByRole('heading',{name:'Novo computador de impressão',exact:true})});await create.getByLabel('Nome',{exact:true}).fill('UI C3 bridge');await create.getByLabel('Confirmo esta alteração de impressão.').check();await create.getByRole('button',{name:'Salvar novo computador de impressão',exact:true}).click();await page.getByRole('heading',{name:'UI C3 bridge · Habilitado',exact:true}).waitFor();check(query('select id from fb_print_private.devices where hotel_id='+literal(t.id)+" and name='UI C3 bridge'").length===1,'actual browser form creates audited device '+t.name);
  page.on('dialog',dialog=>dialog.accept());await page.locator('.fb-deploy-panel > .fb-deploy-field select').selectOption(query('select id from fb_print_private.devices where hotel_id='+literal(t.id)+" and name='UI C3 bridge'")[0].id);await page.getByLabel('Pacote oficial e instalação preparados no computador selecionado.').check();await page.getByRole('button',{name:'Gerar código de pareamento',exact:true}).click();await page.locator('[data-print-secret] code').waitFor();const secret=await page.locator('[data-print-secret] code').innerText();secrets.push(secret);check(secret.length===80&&!page.url().includes(secret),'pairing appears once outside URL '+t.name);await page.getByRole('button',{name:'Ocultar código',exact:true}).click();check(await page.locator('[data-print-secret]').count()===0&&!await page.evaluate(s=>JSON.stringify([localStorage,sessionStorage]).includes(s),secret),'pairing not persisted in browser '+t.name);
  await page.getByRole('navigation',{name:'Seções de impressão'}).getByRole('button',{name:'Fila',exact:true}).click();await page.getByRole('button',{name:'Resultados incertos',exact:true}).click();await page.locator('[data-print-status]').getByText('Impressão atualizada',{exact:true}).waitFor();check(await page.getByText('O sistema não consegue confirmar se houve envio físico.',{exact:false}).count()>0&&!await page.getByRole('button',{name:'Tentar novamente',exact:true}).count(),'ambiguous UX explains no automatic retry '+t.name);
  await page.locator('[data-print-job]').first().getByRole('button',{name:'Detalhes técnicos'}).click();await page.locator('[data-print-detail]').waitFor();check(await page.getByRole('heading',{name:'Tentativas',exact:true}).count()===1,'browser job detail uses actual authorized RPC '+t.name);
  await page.getByRole('button',{name:'Fechar detalhe',exact:true}).click();await openComputer(page);
  await page.screenshot({path:join(lab.directory,t.slug+'-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile C3 no horizontal overflow '+t.name);await page.screenshot({path:join(lab.directory,t.slug+'-mobile.png'),fullPage:true});
  await verifyMobileKeyboard(page,check,t.slug,lab.directory);
  await page.goto(lab.base+'/admin/pedidos');await page.getByText('Lista atualizada',{exact:false}).waitFor();check(await page.locator('[data-group-printing]').getByText('Resultado incerto',{exact:false}).count()>0,'orders panel separates printing from commercial status '+t.name);
  await context.close();console.log('C3 authenticated Admin desktop/mobile: '+t.name);
 }
 const recovery=await lab.login(tenants[0].admin);await recovery.page.goto(lab.base+'/admin/impressao');await verifyPartialRecovery(x,lab,tenants[0],recovery.page,check);await recovery.context.close();
 await verifyC3Polling({lab,t:tenants[0],check,grant:x.grant});
 check(!secrets.some(s=>readFileSync(join(lab.directory,'application.log'),'utf8').includes(s)),'server logs exclude one-time secrets');check(lab.external===0,'zero external browser requests');
 const report={suite:'fb-c3',passed:checks.length,failed:0,hotels:6,externalRequests:0,physicalPrinting:false,checks};writeFileSync(join(lab.directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:undefined,directory:lab.directory}));
}catch(e){console.error(e.stack);process.exitCode=1;}
finally{await lab?.stop();}
