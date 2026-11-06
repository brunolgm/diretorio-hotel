// Layout V1: official service, own offline tenant, maximum ONE order + ONE cancellation.
// Physical submissions require a separate interactive command, never a default test run.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {seedLab,identities,literal,rows} from './fb-local-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {rpc,config,saved,fullIntent} from './fb-b23-seed.mjs';
import {c2Runtime,waitFor,pause,decode} from './fb-c2-runtime.mjs';

const directory=resolve('out/fb-ticket-layout-lab');mkdirSync(directory,{recursive:true});
if(existsSync(join(directory,'report.json'))&&JSON.parse(readFileSync(join(directory,'report.json'),'utf8')).physical?.length)throw Error('Prior physical intent exists: preserve evidence; no rerun');
const report={suite:'fb-ticket-layout-lab',passed:0,failed:0,checks:[],physical:[],human:'not_requested'};
report.name_policy='authorized_projection_only';report.physical_limit=2;report.physical_test=false;report.physical_reprint=false;
const record=()=>writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));
function check(value,label){assert.ok(value,label);report.passed++;report.checks.push(label);record();}
function stage(value){console.log(JSON.stringify(value));record();}
if(!process.env.FB_BRIDGE_PACKAGE)throw Error('Explicit freshly verified package required');
const packageRoot=resolve(process.env.FB_BRIDGE_PACKAGE);
const selectedQueue=process.env.FB_LAB_PRINTER;
if(!selectedQueue)throw Error('Supply the explicitly authorized LAB queue; no product default');
const gates=JSON.parse(readFileSync('out/fb-ticket-layout-report.json','utf8'));
assert.equal(gates.tests.native.failed,0,'native renderer gate');
assert.equal(gates.tests.security.failed,0,'security gate');
for(const suite of ['directed','commissioning','c1','c2','c3','c4','c5'])assert.ok(gates.tests.regressions.some(r=>r.suite===suite&&r.failed===0&&r.passed>0),'required green regression '+suite);
assert.equal(gates.scope.protected_application_and_schema_unchanged,true,'protected scope gate');
assert.equal(gates.git.staged,false,'no staging authorized');
report.required_gates_verified=true;
const ps=(file,args=[])=>new Promise((resolve,reject)=>{const p=spawn('powershell',['-NoProfile','-File',join(packageRoot,file),...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',error='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>error+=b);p.once('error',reject);p.once('exit',code=>{if(code!==0)reject(Error('Official installer '+file+' failed: '+error.slice(0,1500)));else resolve(out.replace(/^\uFEFF/,''));});});
function freeze(){const files=[];function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){if(['bin','obj'].includes(entry.name))continue;const f=join(path,entry.name);if(entry.isDirectory())walk(f);else files.push(f);}}for(const root of ['app','components','lib','bridge','supabase/migrations'])walk(root);return createHash('sha256').update(files.sort().map(f=>f+':'+createHash('sha256').update(readFileSync(f)).digest('hex')).join('\n')).digest('hex');}
let runtime,browser,installed=false,page,t,x;
try{
 const probe=randomUUID();installed=true;
 await ps('Install-LibGuestPrintingBridge.ps1',['-CloudUrl','https://localhost:4318/','-DeviceId',probe,'-Laboratory','-LaboratoryCertificateSha256',JSON.parse(decode('out/fb-c2-certificate.log')).sha256,'-SimulatedSpooler','-NoPair']);
 check(true,'official installer creates and starts passwordless virtual-account service');
 await ps('Uninstall-LibGuestPrintingBridge.ps1');installed=false;check(true,'official uninstaller preserves nonsecret config and device data');
 identities.push(['Hotel Layout V1 LAB','ticket-layout',null]);x=await seedLab();t=x.tenants.at(-1);
 const email='deployment-'+randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url');
 const created=await x.project.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw Error('Own Auth fixture failed');const id=created.data.user.id;
 labSql('insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values('+[id,t.id,email,'Administrador sintetico','administrador'].map(literal).join(',')+',true)');
 const client=createClient(x.s.api,x.s.anon,{auth:{persistSession:false,autoRefreshToken:false}});if((await client.auth.signInWithPassword({email,password})).error)throw Error('Own fixture login failed');t.admin={id,email,password,client};
 check(rows('select count(*)::int from fb_order_private.hotel_settings where hotel_id='+literal(t.id))===0,'new seventh tenant has no ordering configuration');
 check(rows('select count(*)::int from fb_print_private.devices where hotel_id='+literal(t.id))===0,'new tenant has no bridge or routing');
 report.code_freeze=freeze();report.hotel={id:t.id,slug:t.slug};stage({stage:'fresh_flow_started',hotel:t.slug,code_freeze:report.code_freeze});
 await rpc(x.platform,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:true});
 for(const capability of ['orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read','orders.configure'])await config(t.admin,'grant',{user_id:id,capability,active:true});
 for(const cap of ['printing.configure','printing.test','printing.reprint'])await rpc(t.admin,'grant_current_hotel_fb_print_capability',{p_user_id:id,p_capability:cap,p_sector_id:null,p_active:true,p_expected_revision:0});
 t.kitchen=await config(t.admin,'sector',{name:'Setor LAB novo',active:true,sort_order:1});
 t.settings=await config(t.admin,'hotel',{enabled:false,timezone:'America/Recife',cancel_auto:false,cancel_free:false,cancel_minutes:0});
 t.menu=await saved(t,'menu',{name:'Menu sintetico de implantacao',is_published:true});t.category=await saved(t,'category',{name:'Categoria LAB',menu_id:t.menu.id,is_published:true});
 t.item=await saved(t,'item',{name:'Prato sintético de layout',category_id:t.category.id,is_published:true,price_amount_minor:100,currency:'BRL'});
 t.outlet=await saved(t,'outlet',{name:'Ponto sintetico LAB',type:'restaurant',sort_order:0,is_published:true,action_type:'service',service_id:t.services.filipe,menu_ids:[t.menu.id]});
 await config(t.admin,'outlet',{mode:'native',accepting:true,pickup:true,room_delivery:true,default_sector_id:t.kitchen.id},t.outlet.id);
 await config(t.admin,'availability',{outlet_id:t.outlet.id,always_open:true});
 await config(t.admin,'fulfilment',{outlet_id:t.outlet.id,item_id:t.item.id,sector_id:t.kitchen.id});
 t.modifier=await config(t.admin,'modifier_group',{item_id:t.item.id,name:'Escolha LAB',selection:'single',min_selected:0,max_selected:1,active:true});
 t.option=await config(t.admin,'modifier_option',{group_id:t.modifier.id,name:'Adicional sintético',amount_minor:0,currency:'BRL',active:true});
 runtime=await c2Runtime(x.s,{allowSpooler:true});
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const base=x.s.app.replace('127.0.0.1','localhost');
 const profileProbe=await client.from('profiles').select('hotel_id,role,is_active').eq('id',id).maybeSingle();const hotelProbe=await client.from('hotels').select('id,platform_status').eq('id',t.id).maybeSingle();report.auth_probe={profile_error:profileProbe.error?.code??null,profile:profileProbe.data,hotel_error:hotelProbe.error?.code??null,hotel:hotelProbe.data};record();
 report.auth_http=[];context.on('response',async response=>{const url=new URL(response.url());if(url.pathname==='/rest/v1/profiles'||url.pathname==='/rest/v1/hotels'||url.pathname==='/rest/v1/rpc/get_current_platform_access'){const data=await response.json().catch(()=>null);report.auth_http.push({path:url.pathname,status:response.status(),code:data?.code??null,rows:Array.isArray(data)?data.length:null});record();}});
 page=await context.newPage();await page.goto(base+'/login?next=/admin/impressao');await page.locator('button[type=submit]').evaluate(el=>new Promise((resolve,reject)=>{const at=Date.now();const timer=setInterval(()=>{if(Object.keys(el.form).some(k=>k.startsWith('__reactProps'))){clearInterval(timer);resolve();}else if(Date.now()-at>30000){clearInterval(timer);reject(Error('Login hydration timed out'));}},50);}));await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/admin'),{timeout:120000});stage({stage:'normal_admin_login'});
 async function api(path,method='GET',body){return page.evaluate(async({path,method,body})=>{const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};},{path,method,body});}
 async function comm(operation,body,expected=200){const r=await api('/api/admin/fb-printing/commissioning','POST',{operation,body,key:randomUUID(),confirmed:true});assert.equal(r.status,expected,'commission '+operation+' '+JSON.stringify(r.data));return r.data;}
 async function consoleCommand(operation,body){const r=await api('/api/admin/fb-printing/console','POST',{operation,body,key:randomUUID(),confirmed:true});assert.equal(r.status,200,'console '+operation+' '+JSON.stringify(r.data?.error));return r.data;}
 const cfg=(kind,values,id=null,revision=0)=>consoleCommand('config',{kind,id,revision,values});
 const commissioning=async()=>{const r=await api('/api/admin/fb-printing/commissioning');assert.equal(r.status,200);return r.data;};
 let pre=await commissioning();check(pre.mode==='catalog_only'&&pre.blockers>0,'catalog only explicit with commissioning blockers');
 await comm('mode',{mode:'ordering',revision:pre.order_revision},409);check(true,'normal ordering activation blocked before commissioning');
 await comm('mode',{mode:'catalog_only',revision:pre.order_revision});
 for(const language of ['pt','en','es']){const offer=await api('/api/fb/hotel/'+t.slug+'/offer?lang='+language);check(offer.status===200&&offer.data.outlets.length===0,'catalog-only has no public ordering offer '+language);const catalog=await context.newPage();await catalog.goto(base+'/hotel/'+t.slug+'/explorar/cardapio?lang='+language);check(await catalog.locator('[data-fb-native]').count()===1&&await catalog.locator('[data-fb-order-outlet]').count()===0,'published catalogue remains visible without native cart or checkout '+language);await catalog.screenshot({path:join(directory,'catalog-only-'+language+'.png'),fullPage:true});await catalog.close();}
 await cfg('settings',{ticket_minutes:15,allow_room:true,allow_notes:true,allow_name:true,fan_out:false});
 const device=await cfg('device',{name:'Bridge de implantacao LAB',active:true});t.device=device;
 const destination=await cfg('destination',{name:'Destino LAB unico',device_id:device.id,backup_device_id:null,priority:1,active:true,allow_room:true,allow_notes:true,allow_name:true});t.destination=destination;
 const pairing=await consoleCommand('pairing',{device_id:device.id,revision:device.revision});
 await ps('Install-LibGuestPrintingBridge.ps1',['-CloudUrl','https://localhost:4318/','-DeviceId',device.id,'-Laboratory','-LaboratoryCertificateSha256',runtime.certificate,'-SimulatedSpooler','-NoPair']);installed=true;
 const installation=JSON.parse(readFileSync(join(process.env.ProgramData,'LibGuest/PrintingBridge/installation.json'),'utf8').replace(/^\uFEFF/,''));
 const serviceConfig=()=>JSON.parse(readFileSync(installation.config,'utf8').replace(/^\uFEFF/,''));
 check(serviceConfig().environment==='laboratory'&&serviceConfig().laboratory_spooler===true,'commissioning TESTE is constrained to simulated transport');
 const provision=spawn(installation.executable,['provision','--config',installation.config],{windowsHide:true,stdio:['pipe','pipe','pipe']});let provisionOut='',provisionError='';provision.stdout.on('data',b=>provisionOut+=b);provision.stderr.on('data',b=>provisionError+=b);provision.stdin.end(pairing.one_time_secret+'\n');pairing.one_time_secret=null;
 await new Promise((resolve,reject)=>{provision.once('error',reject);provision.once('exit',c=>c===0?resolve():reject(Error('Local provisioning failed '+c+' '+provisionError.slice(0,250))));});
 const identity=JSON.parse(provisionOut);check(identity.status==='paired'&&identity.dpapi==='CurrentUser','pairing executed under actual service DPAPI identity');
 await ps('Complete-LibGuestBridgePairing.ps1');
 const status=async()=>JSON.parse(await ps('Get-LibGuestBridgeStatus.ps1'));
 let local=await status();check(local.credential_readable&&local.identity===identity.identity,'normal service decrypts credential with same virtual account');report.installation={device_id:device.id,identity:local.identity,dpapi:local.dpapi,package:JSON.parse(readFileSync(join(packageRoot,'manifest.json'),'utf8').replace(/^\uFEFF/,'')).version};
 await waitFor(async()=>{pre=await commissioning();return pre.queues.some(q=>q.device_id===device.id&&q.queue_name===selectedQueue&&q.present);},'actual Windows queue discovery',90000);
 let queue=pre.queues.find(q=>q.device_id===device.id&&q.queue_name===selectedQueue);report.queue=queue;check(queue.driver_name.length>0,'real queue driver metadata discovered without print');
 await page.goto(base+'/admin/impressao');await page.getByText('Configuração e permissões',{exact:true}).click();const selectionForm=page.locator('form').filter({has:page.getByRole('heading',{name:'Impressora detectada',exact:true})});await selectionForm.getByLabel('Nome operacional',{exact:true}).fill('Impressora do LAB');await selectionForm.getByLabel('Destino lógico',{exact:true}).selectOption(destination.id);await selectionForm.getByLabel('Fila detectada e Bridge',{exact:true}).selectOption(device.id+'|'+queue.queue_key);await selectionForm.getByLabel('Confirmo esta alteração de impressão.').check();
 const selectionResponse=page.waitForResponse(r=>r.url().endsWith('/api/admin/fb-printing/commissioning')&&r.request().method()==='POST');await selectionForm.getByRole('button',{name:'Salvar impressora detectada',exact:true}).click();const selectedResponse=await selectionResponse;assert.equal(selectedResponse.status(),200,'normal Admin detected-queue form');const selected=(await api('/api/admin/fb-printing/console')).data.config.printers.find(p=>p.name==='Impressora do LAB');check(Boolean(selected?.id)&&selected.config.queue_name===selectedQueue,'Admin form persists discovered queue without queue-name text input');
 t.printer=selected;
 await cfg('route',{sector_id:t.kitchen.id,destination_id:destination.id,role:'primary',copy_number:1,active:true});
 pre=await commissioning();check(pre.blockers>0&&pre.checks.some(c=>c.code==='test'&&c.status==='BLOCKER'),'preflight blocks missing submitted test');
 const simulated=await consoleCommand('test',{destination_id:destination.id,sector_id:t.kitchen.id});
 async function submitted(jobId){let detail;await waitFor(async()=>{const r=await api('/api/admin/fb-printing/console?job_id='+jobId);detail=r.data;return detail.job?.state==='submitted'||detail.state==='submitted';},'cloud submitted '+jobId,120000);return detail;}
 t.simulatedTest=simulated.job_id;await submitted(simulated.job_id);local=await status();check(local.submissions.some(s=>s.job_id===simulated.job_id),'simulated test crossed service journal, adapter and Cloud result');
 pre=await commissioning();check(pre.ready&&pre.blockers===0,'normal preflight ready after configured native menu, route, device, detected queue and test');
 check(pre.warnings>0&&pre.human_verifications.length===0,'physical confirmation remains a warning; never fabricated');
 await comm('mode',{mode:'ordering',revision:pre.order_revision});check((await commissioning()).mode==='ordering','catalog plus ordering activated through normal preflight');
 await page.goto(base+'/admin/impressao');await page.getByText('Configuração e permissões',{exact:true}).click();await page.locator('[data-print-commissioning]').waitFor();await page.screenshot({path:join(directory,'admin-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(directory,'admin-mobile.png'),fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'commissioning console mobile has no horizontal overflow');
 check(freeze()===report.code_freeze,'no product code changed during fresh official-surface flow');report.fresh_hotel='APPROVED';stage({stage:'fresh_hotel_approved',passed:report.passed});
 async function physicalOrder(){
  assert.equal(report.physical.length,0,'physical order cap is one');local=await status();check(local.pending===0&&!local.operator_required,'no unresolved work before two-ticket round');await ps('Set-LibGuestBridgeLabTransport.ps1',['-Transport','Physical']);check(serviceConfig().laboratory_spooler===false,'only the two-ticket round uses actual Windows Spooler transport');
  const guest=await browser.newContext();await guest.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());const publicPage=await guest.newPage();await publicPage.goto(base+'/r/'+t.roomTokens.valid);check((await guest.cookies()).some(c=>c.name==='lg_room_ctx'),'normal QR established room context without fixture cookie injection');await publicPage.goto(base+'/hotel/'+t.slug+'/explorar/cardapio');
  const guestApi=(operation,body)=>publicPage.evaluate(async({path,body})=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},{path:'/api/fb/hotel/'+t.slug+'/'+operation,body});
  const intent=fullIntent(t,{lines:[{kind:'item',id:t.item.id,menu_id:t.menu.id,quantity:2,options:[t.option.id],note:'Sem cebola. Café, ação e coração.'}],fulfilment:'room_delivery',first_name:'Pessoa',last_name:'Laboratório',note:'Rodada controlada de layout V1.'});const priced={lines:intent.lines,fulfilment:intent.fulfilment,language:intent.language};
  const quote=await guestApi('quote',{outlet_id:t.outlet.id,intent:priced});assert.equal(quote.status,200,'normal guest quote');
  report.physical.push({kind:'order',phase:'requested'});record();
  const confirmed=await guestApi('confirm',{outlet_id:t.outlet.id,quote_id:quote.data.quote_id,quote_reference:quote.data.quote_reference,key:randomUUID(),intent});assert.equal(confirmed.status,200,'normal guest confirmation');t.orderId=confirmed.data.order_id;report.physical[0].order_id=t.orderId;record();
  let panel=(await api('/api/admin/fb-orders')).data.orders.find(o=>o.order_id===t.orderId);check(panel?.status==='registered'&&panel.groups.length===1,'physical order is registered without staff acceptance');
  let original;await waitFor(async()=>{const console=(await api('/api/admin/fb-printing/console')).data;original=console.jobs.find(j=>j.order_id===t.orderId&&j.kind==='order');return original?.state==='submitted';},'physical order prints on registration',120000);
  const detail=(await api('/api/admin/fb-printing/console?job_id='+original.job_id)).data;local=await status();const spool=local.submissions.find(s=>s.job_id===original.job_id);check(spool?.queue===selectedQueue&&Number(spool.spool_job_id)>0,'registered order submitted to authorized queue');Object.assign(report.physical[0],{phase:'submitted',job_id:original.job_id,destination_id:destination.id,attempts:detail.attempts,...spool,cloud_status:original.state,result:local.jobs.find(j=>j.job_id===original.job_id)?.result});record();
  panel=(await api('/api/admin/fb-orders')).data.orders.find(o=>o.order_id===t.orderId);check(panel.status==='registered','print submission does not accept order');
  await rpc(t.admin,'transition_current_hotel_fb_order_group_v2',{p_group_id:panel.groups[0].id,p_expected_revision:panel.groups[0].revision,p_status:'accepted'});await consoleCommand('reconcile',{batch:100});await pause(5000);
  const after=(await api('/api/admin/fb-printing/console')).data.jobs.filter(j=>j.order_id===t.orderId&&j.kind==='order');local=await status();check(after.length===1&&local.submissions.filter(s=>s.job_id===original.job_id).length===1,'staff acceptance emits no duplicate original or spool submission');report.accept_no_duplicate=true;await publicPage.goto(base+confirmed.data.tracking_href);await publicPage.locator('[data-fb-order-tracking] [data-cancellation-contact]').waitFor();await publicPage.screenshot({path:join(directory,'physical-order-tracking.png'),fullPage:true});await guest.close();stage({stage:'physical_order_submitted',ticket:report.physical[0],accept_no_duplicate:true});
 }
 async function physicalCancellation(){
  assert.equal(report.physical.length,1,'physical cancellation cap is one');assert.ok(report.accept_no_duplicate);
  const panel=(await api('/api/admin/fb-orders')).data.orders.find(o=>o.order_id===t.orderId);report.physical.push({kind:'cancellation',phase:'requested',order_id:t.orderId});record();
  await rpc(t.admin,'cancel_current_hotel_fb_order_v1',{p_order_id:t.orderId,p_expected_revision:panel.revision,p_reason_code:'operational'});
  let notice;await waitFor(async()=>{notice=(await api('/api/admin/fb-printing/console')).data.jobs.find(j=>j.order_id===t.orderId&&j.kind==='cancellation');return notice?.state==='submitted';},'independent physical cancellation notice',120000);
  const detail=(await api('/api/admin/fb-printing/console?job_id='+notice.job_id)).data;local=await status();const spool=local.submissions.find(s=>s.job_id===notice.job_id);check(spool?.queue===selectedQueue&&spool.printer_id===report.physical[0].printer_id&&Number(spool.spool_job_id)>0,'cancellation uses original printer and queue');check(notice.destination_id===report.physical[0].destination_id||detail.job.destination_id===report.physical[0].destination_id,'cancellation preserves original destination');
  Object.assign(report.physical[1],{phase:'submitted',job_id:notice.job_id,attempts:detail.attempts,...spool,cloud_status:notice.state,result:local.jobs.find(j=>j.job_id===notice.job_id)?.result});
  await waitFor(async()=>{local=await status();return local.pending===0&&report.physical.every(p=>local.jobs.some(j=>j.job_id===p.job_id&&j.local_state==='terminal'&&j.cloud_state==='submitted'));},'both physical result ACKs are durable and terminal',60000);
  for(const ticket of report.physical)ticket.local_state=local.jobs.find(j=>j.job_id===ticket.job_id).local_state;
  check(new Set(report.physical.map(p=>p.spool_job_id)).size===2&&report.physical.every(p=>p.cloud_status==='submitted'&&p.result==='submitted'),'two distinct physical spool IDs have matching local and Cloud submitted states');
  check(local.submissions.length===3&&local.submissions.every(s=>[t.simulatedTest,...report.physical.map(p=>p.job_id)].includes(s.job_id)),'journal contains exactly one simulated TESTE plus the two authorized physical jobs');
  report.local_submissions=local.submissions;report.local_jobs=local.jobs;report.physical_gate='TECHNICAL_SUBMITTED_HUMAN_PENDING';report.human='pending';report.reprint='not_needed_not_submitted';stage({stage:'physical_cancellation_submitted',ticket:report.physical[1],physical_gate:report.physical_gate});
 }
 if(process.argv.includes('--interactive')){
  stage({stage:'awaiting_command',commands:['physical_pair','close']});
  async function command(value){if(value==='physical_pair'){await physicalOrder();await physicalCancellation();check(report.physical.length===2&&report.physical.every(p=>p.phase==='submitted'),'exactly two physical tickets and no physical TESTE or reprint');return false;}if(value==='close')return false;throw Error('Unsupported layout LAB command');}
  if(process.env.FB_DEPLOYMENT_CONTROL){const path=resolve(process.env.FB_DEPLOYMENT_CONTROL);assert.equal(path,join(directory,'control.json'));let sequence=0;for(;;){await pause(250);if(!existsSync(path))continue;let next;try{next=JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));}catch{continue;}if(next.sequence<=sequence)continue;assert.equal(next.sequence,sequence+1);sequence=next.sequence;if(!await command(next.command,next.evidence))break;}}
  else {const input=createInterface({input:process.stdin,crlfDelay:Infinity});for await(const line of input)if(!await command(line.trim())){input.close();break;}}
 }
 check(freeze()===report.code_freeze,'product code still frozen at end');
}catch{report.failed++;report.fresh_hotel='BLOCKED';report.failure='layout_lab_step_failed';report.last_check=report.checks.at(-1);if(installed)try{report.failure_local=JSON.parse(await ps('Get-LibGuestBridgeStatus.ps1'));}catch{}if(page){report.browser_path=new URL(page.url()).pathname.replace(/^\/r\/[^/]+$/,'/r/[redacted]');report.browser_errors=await page.locator('[role=alert]').allTextContents().catch(()=>[]);await page.screenshot({path:join(directory,'failed.png'),fullPage:true}).catch(()=>{});}stage({stage:'failed',error:'layout_lab_step_failed',last_check:report.last_check});process.exitCode=1;}
finally{if(installed)try{await ps('Uninstall-LibGuestPrintingBridge.ps1');report.service_cleanup='uninstalled_data_preserved';}catch(e){report.service_cleanup=e.message;}await browser?.close();await runtime?.stop();record();stage({stage:'finished',passed:report.passed,failed:report.failed});}
