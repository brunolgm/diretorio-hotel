// Actual application + GoTrue sessions + PostgREST/RLS + Storage. No action stubs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createWriteStream,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {seedLab,rows,literal} from './fb-local-seed.mjs';
const checks=[];let browser,app;const contexts=[];const pageErrors=[];let externalRequests=0;
const actionRequests=new Map();
const focusCore=process.argv.includes('--focus-core');
function check(ok,label){assert.ok(ok,label);checks.push(label);}
const {s,platform,tenants,project}=await seedLab();
const directory=s.dir;
console.log('Real local Auth: 13 users created and password-authenticated.');
const env={...process.env};
for(const path of ['.env','.env.local','.env.development','.env.development.local'])if(existsSync(path))
 for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Za-z_]\w*)=/);if(match)env[match[1]]='';}
for(const key of Object.keys(env))if(/GOOGLE|AIRLABS|GOOMER|THEX|OPERA|OPENAI|RESEND|SENTRY|VERCEL|SUPABASE/i.test(key))env[key]='';
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:s.api,SUPABASE_URL:s.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon,SUPABASE_SERVICE_ROLE_KEY:s.service,NEXT_TELEMETRY_DISABLED:'1',NPM_CONFIG_UPDATE_NOTIFIER:'false',NODE_ENV:'development',NODE_OPTIONS:'--import='+pathToFileURL(resolve('scripts/fb-local-network-guard.mjs')).href});
const log=createWriteStream(join(directory,'application.log'));
app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4317'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
app.stdout.pipe(log);app.stderr.pipe(log);
async function rpc(actor,name,args){const r=await actor.client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.code+' '+r.error.message);return r.data;}
async function deny(actor,name,args,code,label){const r=await actor.client.rpc(name,args);check(r.error?.code===code,label+' ('+r.error?.code+')');}
const saved=(t,kind,id=null,values={},revision=0)=>rpc(t.operator,'save_current_hotel_fb',{p_kind:kind,p_id:id,p_expected_revision:revision,p_values:values});
const record=(kind,id)=>rows("select coalesce((select to_jsonb(t) from public.hotel_fb_"+({outlet:'outlets',menu:'menus',category:'categories',item:'items'}[kind])+" t where id="+literal(id)+"),'null'::jsonb)");
const auditCount=t=>rows("select count(*)::text from public.admin_audit_log where hotel_id="+literal(t.id));
async function login(actor,target){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&!u.hostname.endsWith('.localhost')){externalRequests++;return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto(s.app+'/login?next='+encodeURIComponent(target));await page.locator('input[type=email]').fill(actor.email);await page.locator('input[type=password]').fill(actor.password);await page.locator('button[type=submit]').click();
 await page.waitForURL(u=>u.pathname.startsWith(target.startsWith('/platform')?'/platform':'/admin'),{timeout:120000});
 await page.goto(s.app+target);await page.locator('h1').first().waitFor();
 check(new URL(page.url()).pathname===target.split('?')[0],'normal application password login '+target);
 return {context,page};
}
async function uiSave(page,kind,values,id){
 await page.goto(s.app+'/admin/cardapio?kind='+kind+(id?'&id='+id:''));
 const form=page.locator('form').filter({has:page.getByRole('button',{name:'Salvar conteúdo PT',exact:true})});
 for(const [key,value]of Object.entries(values)){
  const input=form.locator('[name="'+key+'"]');
  if(Array.isArray(value)){for(const id of value)await form.locator('[name="'+key+'"][value="'+id+'"]').check();}
  else if(typeof value==='boolean')await input.setChecked(value);
  else if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(value);
  else await input.fill(String(value));
 }
 const requestPromise=page.waitForRequest(r=>r.method()==='POST'&&Boolean(r.headers()['next-action']));
 await form.getByRole('button',{name:'Salvar conteúdo PT',exact:true}).click();
 const request=await requestPromise;
 actionRequests.set(page,{url:request.url(),headers:Object.fromEntries(['next-action','content-type','accept'].map(k=>[k,request.headers()[k]]).filter(([,v])=>v)),data:request.postDataBuffer()});
 await page.waitForURL(u=>u.searchParams.has('success')&&u.searchParams.get('kind')===kind,{timeout:120000});
 const result=record(kind,new URL(page.url()).searchParams.get('id'));
 check(Boolean(result?.id),'real UI persisted '+kind);return result;
}
async function platformToggle(page,t,enabled){
 await page.bringToFront();await page.goto(s.app+'/platform/hoteis/'+t.id);
 const article=page.locator('article').filter({has:page.getByText('Cardápio (F&B)',{exact:true})});
 if(enabled)await article.getByRole('button',{name:'Habilitar',exact:true}).click();
 else{
  const trigger=article.getByRole('button',{name:'Desabilitar',exact:true});
  await trigger.evaluate(button=>new Promise((resolve,reject)=>{const ready=()=>Object.keys(button).some(k=>k.startsWith('__reactProps$')&&typeof button[k]?.onClick==='function');if(ready())return resolve();const timeout=setTimeout(()=>{clearInterval(timer);reject(Error('Dialog trigger did not hydrate'));},10000);const timer=setInterval(()=>{if(ready()){clearInterval(timer);clearTimeout(timeout);resolve();}},20);}));
  await trigger.click();await page.getByRole('button',{name:'Confirmar desativação',exact:true}).click();
 }
 await page.waitForURL(u=>u.searchParams.has('success'),{timeout:120000});
 check(await rpc(platform,'is_hotel_module_enabled',{p_hotel_id:t.id,p_module_key:'fb.menu'})===enabled,'Platform UI fb.menu '+enabled+' '+t.name);
}
async function screenshot(page,name){
 await page.locator('h1').first().waitFor();
 if(new URL(page.url()).pathname==='/admin/cardapio')await page.locator('input[name=name]').waitFor();
 await page.screenshot({path:join(directory,name+'.png'),fullPage:true});
}
try{
 for(let i=0;i<180;i++){try{const r=await fetch(s.app+'/login',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}if(app.exitCode!==null)throw Error('Application exited; inspect application.log');await new Promise(r=>setTimeout(r,500));if(i===179)throw Error('Application startup timeout');}
 browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL||'chrome',args:['--host-resolver-rules=MAP *.localhost 127.0.0.1']});
 const root=await login(platform,'/platform');
 const anon={client:(await import('@supabase/supabase-js')).createClient(s.api,s.anon,{auth:{persistSession:false,autoRefreshToken:false}})};
 const publics=await browser.newContext();contexts.push(publics);
 await publics.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&!u.hostname.endsWith('.localhost')){externalRequests++;return route.abort();}return route.continue();});
 const publicPage=await publics.newPage();publicPage.on('pageerror',e=>pageErrors.push(e.message));
 const snapshots=new Map();
 async function snapshot(t,language='pt'){
  await publicPage.goto(s.app+'/hotel/'+t.slug+'?lang='+language);await publicPage.locator('h1').first().waitFor();
  await publicPage.waitForFunction(()=>[...document.querySelectorAll('main img')].every(img=>img.complete));
  return publicPage.evaluate(()=>{
   const stable=e=>{const copy=e.cloneNode(true);for(const img of [copy,...copy.querySelectorAll('img')]){if(img.tagName!=='IMG')continue;const src=img.getAttribute('src');if(src){const url=new URL(src,location.href);if(url.origin===location.origin)img.setAttribute('src',url.pathname+url.search);}}return copy.outerHTML;};
   return {title:document.querySelector('h1')?.textContent,hero:[...document.querySelectorAll('main picture,main img,.v3-headline')].map(stable),essentials:[...document.querySelectorAll('.public-v4-essentials')].map(stable),flights:[...document.querySelectorAll('[data-public-flight-home-card],a[href*="/voos"]')].map(stable),tourism:[...document.querySelectorAll('[data-public-tourism-home-card],a[href*="/turismo"]')].map(stable),alerts:[...document.querySelectorAll('[data-v4-alerts]')].map(stable),communications:[...document.querySelectorAll('[data-v4-communication-region],[data-v4-offers],[data-v4-updates]')].map(stable),dock:[...document.querySelectorAll('nav.fixed.bottom-0')].map(stable),theme:document.querySelector('[data-hotel-theme]')?.getAttribute('data-hotel-theme')};
  });
 }
 for(const t of tenants){
  check(await rpc(platform,'is_hotel_module_enabled',{p_hotel_id:t.id,p_module_key:'fb.menu'})===false,'no auto FB entitlement '+t.name);
  snapshots.set(t.id,await snapshot(t));check(Boolean(snapshots.get(t.id).title?.trim())&&snapshots.get(t.id).theme===(t.brand||'midnight-slate'),'DB public Home identity/theme '+t.name);
  if(!focusCore)for(const width of [390,1440])for(const language of ['pt','en','es']){
   await publicPage.setViewportSize({width,height:1000});snapshots.set(t.id+language+width,await snapshot(t,language));
   await screenshot(publicPage,t.slug+'-home-off-'+width+'-'+language);
  }
  await publicPage.goto(s.app+'/hotel/'+t.slug+'/explorar/cardapio');check(await publicPage.locator('h1').count()===1,'legacy menu without FB '+t.name);
  check(await publicPage.locator('[data-fb-native]').count()===0,'FB OFF legacy branch '+t.name);
  await platformToggle(root.page,t,true);
  const graph=await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'pt'});check(graph.outlets.length===0,'ON empty graph '+t.name);
  assert.deepEqual(await snapshot(t),snapshots.get(t.id));checks.push('Home protected regions ON empty '+t.name);
  if(!focusCore)for(const width of [390,1440])for(const language of ['pt','en','es']){
   await publicPage.setViewportSize({width,height:1000});assert.deepEqual(await snapshot(t,language),snapshots.get(t.id+language+width));
   checks.push('Home protected regions ON empty '+t.name+' '+language+' '+width);
   await screenshot(publicPage,t.slug+'-home-empty-'+width+'-'+language);
  }
  const op=await login(t.operator,'/admin/cardapio');t.ui=op;
  t.menu=await uiSave(op.page,'menu',{name:'Cardápio local',is_published:true});
  t.category=await uiSave(op.page,'category',{name:'Pratos',menu_id:t.menu.id,is_published:true});
  t.item=await uiSave(op.page,'item',{name:'Prato de fixture',category_id:t.category.id,price_amount_minor:'25,90',currency:'BRL',allergens_info:'Contém leite: informação cadastrada.',dietary_info:'Informação alimentar editorial.',is_available:true,is_published:true});
  const draftMenu=await saved(t,'menu',null,{name:'Menu rascunho',is_published:false});
  const draftCategory=await saved(t,'category',null,{name:'Categoria do menu rascunho',menu_id:draftMenu.id,is_published:true});
  await saved(t,'item',null,{name:'Oculto menu ancestral',category_id:draftCategory.id,is_published:true});
  t.outlet=await uiSave(op.page,'outlet',{name:'Restaurante Filipe',type:'restaurant',action_type:'service',service_id:t.services.filipe,menu_ids:[t.menu.id,draftMenu.id],is_published:true});
  check((await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'pt'})).outlets.length===1,'actual one-outlet graph '+t.name);
  t.room=await uiSave(op.page,'outlet',{name:'Room Service',type:'room_service',action_type:'service',service_id:t.services.external,menu_ids:[t.menu.id],is_published:true});
  const shared=await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'pt'});
  check(shared.menus.length===1&&shared.outlet_menus.length===2,'actual shared menu without duplication '+t.name);
  for(const type of ['bar','breakfast','cafe','other'])await saved(t,'outlet',null,{name:'Fixture '+type,type,menu_ids:[t.menu.id],is_published:true});
  const privateMenu=await saved(t,'menu',null,{name:'Menu do outlet rascunho',is_published:true});
  const privateCategory=await saved(t,'category',null,{name:'Categoria do outlet rascunho',menu_id:privateMenu.id,is_published:true});
  await saved(t,'item',null,{name:'Oculto outlet ancestral',category_id:privateCategory.id,is_published:true});
  await saved(t,'outlet',null,{name:'Outlet rascunho',type:'other',menu_ids:[privateMenu.id],is_published:false});
  t.zero=await saved(t,'item',null,{name:'Preço zero',category_id:t.category.id,price_amount_minor:0,is_published:true});
  t.request=await saved(t,'item',null,{name:'Sob consulta',category_id:t.category.id,price_on_request:true,price_amount_minor:null,is_published:true});
  await saved(t,'item',null,{name:'Oculto rascunho',category_id:t.category.id,is_published:false});
  await saved(t,'item',null,{name:'Oculto indisponível',category_id:t.category.id,is_published:true,is_available:false});
  const hiddenCategory=await saved(t,'category',null,{name:'Categoria rascunho',menu_id:t.menu.id,is_published:false});
  await saved(t,'item',null,{name:'Oculto ancestral',category_id:hiddenCategory.id,is_published:true});
  for(const language of ['en','es'])check(await rpc(t.operator,'save_current_hotel_fb_translation',{p_kind:'item',p_id:t.item.id,p_language:language,p_source_revision:t.item.source_revision,p_fields:{name:language==='en'?'Fixture dish':'Plato de fixture'}}),'real persisted partial translation '+language+' '+t.name);
  const viewer=await login(t.viewer,'/admin/cardapio?kind=item&id='+t.item.id);t.viewerUi=viewer;
  check(await viewer.page.getByRole('button',{name:'Salvar conteúdo PT',exact:true}).count()===0,'Viewer UI no save '+t.name);
  check(await viewer.page.locator('fieldset:disabled').count()>0,'Viewer actual detail read-only '+t.name);
  check(await viewer.page.locator('input[type=file]').count()===0,'Viewer no upload '+t.name);
  if(!focusCore)for(const [actorPage,role]of [[op.page,'operator'],[viewer.page,'viewer']])for(const width of [390,1440]){
   await actorPage.setViewportSize({width,height:1000});await actorPage.goto(s.app+'/admin/cardapio?kind=item&id='+t.item.id);
   check(await actorPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'actual Admin responsive '+t.name+' '+role+' '+width);
   await screenshot(actorPage,t.slug+'-admin-'+role+'-'+width);
  }
  const before=auditCount(t);
  const packet=actionRequests.get(op.page);
  const forged=await viewer.context.request.post(packet.url,{headers:{...packet.headers,origin:s.app},data:packet.data,maxRedirects:0});
  check((forged.headers()['x-action-redirect']||forged.headers().location||'').includes('acesso-negado'),'Viewer cannot forge actual application server action '+t.name);
  await deny(t.viewer,'save_current_hotel_fb',{p_kind:'outlet',p_id:null,p_expected_revision:0,p_values:{name:'Forbidden'}},'42501','Viewer no create '+t.name);
  for(const patch of [{name:'Forbidden'},{is_published:false}])await deny(t.viewer,'save_current_hotel_fb',{p_kind:'item',p_id:t.item.id,p_expected_revision:t.item.revision,p_values:patch},'42501','Viewer no edit/publish '+t.name);
  await deny(t.viewer,'delete_current_hotel_fb',{p_kind:'item',p_id:t.item.id,p_expected_revision:t.item.revision},'42501','Viewer no delete '+t.name);
  await deny(t.viewer,'reorder_current_hotel_fb',{p_kind:'item',p_parent_id:t.category.id,p_rows:[]},'42501','Viewer no reorder '+t.name);
  await deny(t.viewer,'set_current_hotel_fb_image',{p_kind:'item',p_id:t.item.id,p_expected_revision:t.item.revision,p_path:null},'42501','Viewer no image association '+t.name);
  check(auditCount(t)===before,'Viewer denied writes have no audit '+t.name);
  const projection=await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'en'});
  check(projection.outlets.length===6&&projection.items.length===3,'real public eligibility graph '+t.name);
  check(projection.items.some(i=>i.name==='Fixture dish'&&i.allergens_info===t.item.allergens_info),'real partial EN fallback '+t.name);
  check(!JSON.stringify(projection).includes('room_token')&&!JSON.stringify(projection).includes('restaurant_menu_url'),'no room identity in FB '+t.name);
  if(!focusCore)for(const width of [390,1440])for(const language of ['pt','en','es']){
   await publicPage.setViewportSize({width,height:1000});
   for(const subdomain of [false,true]){
    const url=subdomain?'http://'+t.slug+'.localhost:4317/explorar/cardapio':s.app+'/hotel/'+t.slug+'/explorar/cardapio';
    const response=await publicPage.goto(url+'?lang='+language);check(response.status()===200,'actual public route '+t.name+' '+width+' '+language+' '+subdomain);
    check(await publicPage.locator('[data-fb-native] > article').count()===6,'all outlet types from DB '+t.name+' '+language+' '+subdomain);
    const filipe=publicPage.locator('[data-fb-native] details').filter({has:publicPage.locator('summary').filter({hasText:'Restaurante Filipe'})});
    await filipe.locator('summary').click();
    check(await filipe.getByRole('heading',{name:'Cardápio local',exact:true}).isVisible(),'Filipe opens native menu detail '+t.name+' '+language);
    check(await filipe.getByRole('heading',{name:language==='en'?'Fixture dish':language==='es'?'Plato de fixture':'Prato de fixture',exact:true}).isVisible(),'actual localized item field '+t.name+' '+language);
    const text=await publicPage.locator('[data-fb-native]').innerText();check(!text.includes('Oculto '),'unpublished/unavailable ancestry hidden '+t.name+' '+language);
    const zero=filipe.locator('li').filter({has:publicPage.getByRole('heading',{name:'Preço zero',exact:true})});
    check(!/Alergênicos|Allergens|Alérgenos|sem alerg|allergen.free/i.test(await zero.innerText()),'missing allergens make no safety claim '+t.name+' '+language);
    check(await publicPage.locator('a[href="https://goomer.fixture.invalid/menu"]').count()===1,'Room Service external CTA preserved '+t.name);
    check(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'responsive actual DB '+t.name+' '+width);
   }
   await screenshot(publicPage,t.slug+'-catalog-'+width+'-'+language);
   assert.deepEqual(await snapshot(t,language),snapshots.get(t.id+language+width));checks.push('Home protected regions ON content '+t.name+' '+width+' '+language);
   await screenshot(publicPage,t.slug+'-home-content-'+width+'-'+language);
  }
  const count=rows("select count(*)::text from public.hotel_fb_outlets where hotel_id="+literal(t.id));
  await platformToggle(root.page,t,false);check(rows("select count(*)::text from public.hotel_fb_outlets where hotel_id="+literal(t.id))===count,'disable retains FB data '+t.name);
  const fallback=await publicPage.goto(s.app+'/hotel/'+t.slug+'/explorar/cardapio');
  check(fallback.status()===200&&await publicPage.locator('[data-fb-native]').count()===0,'existing content plus FB OFF still uses legacy route '+t.name);
  await platformToggle(root.page,t,true);check(rows("select count(*)::text from public.hotel_fb_outlets where hotel_id="+literal(t.id))===count,'reenable creates no content '+t.name);
  console.log('Actual app/Auth/DB/public matrix completed: '+t.name);
 }
 const {verifyAdversarial}=await import('./fb-local-adversarial.mjs');
 await verifyAdversarial({s,tenants,project,check,rpc,deny,saved,record,auditCount,uiSave,publicPage});
 for(const t of tenants){
  assert.deepEqual(rows("select json_agg(to_jsonb(x) order by id) from public.hotel_sections x where hotel_id="+literal(t.id)+" and id in("+Object.values(t.services).map(literal).join(',')+")"),t.legacyServices);
  assert.deepEqual(rows("select json_agg(to_jsonb(x) order by id) from public.hotel_room_links x where hotel_id="+literal(t.id)),t.legacyRooms);
  checks.push('original synthetic Services/room links unchanged '+t.name);
 }
 check(externalRequests===0,'zero browser external requests');
 assert.deepEqual(pageErrors,[]);checks.push('zero browser runtime errors');
 writeFileSync(join(directory,'report.json'),JSON.stringify({suite:'fb-authenticated',mode:focusCore?'core':'full',passed:checks.length,failed:0,externalRequests,authUsers:13,identities:6,checks},null,2));
 console.log(JSON.stringify({suite:'fb-authenticated',mode:focusCore?'core':'full',passed:checks.length,failed:0,externalRequests,directory}));
}catch(e){writeFileSync(join(directory,'failure.json'),JSON.stringify({passed:checks.length,error:e.message,stack:e.stack,checks},null,2));console.error(e.stack);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(app?.pid){if(process.platform==='win32'){const {execFileSync}=await import('node:child_process');try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}catch{}}else app.kill('SIGTERM');}
 log.end();
}
