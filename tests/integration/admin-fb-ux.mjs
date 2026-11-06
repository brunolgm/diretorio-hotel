// Real local Auth/SSR/navigation. Synthetic tenants only; no Bridge or physical I/O.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {seedB23,rpc,config} from './fb-b23-seed.mjs';
import {literal,rows} from './fb-local-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {c2Runtime} from './fb-c2-runtime.mjs';
let runtime,browser;const contexts=[],checks=[];let external=0;const errors=[];
const x=await seedB23(),directory=join(x.s.dir,'admin-fb-ux');mkdirSync(directory,{recursive:true});
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
async function login(actor){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);
 await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));const base=x.s.app.replace('127.0.0.1','localhost');
 await page.goto(base+'/login?next=/admin/cardapio');await page.locator('button[type=submit]').evaluate(el=>new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{if(Object.keys(el.form).some(key=>key.startsWith('__reactProps'))){clearInterval(timer);resolve();}else if(Date.now()-started>30000){clearInterval(timer);reject(Error('Login hydration timeout'));}},50);}));
 await page.locator('input[type=email]').fill(actor.email);await page.locator('input[type=password]').fill(actor.password);await page.locator('button[type=submit]').click();await page.waitForURL(url=>url.pathname.startsWith('/admin'),{timeout:120000});return {page,context,base};
}
try{
 runtime=await c2Runtime(x.s);browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [index,t] of x.tenants.entries()){
  const priorGrant=rows('select coalesce((select to_jsonb(g) from fb_print_private.grants g where hotel_id='+literal(t.id)+' and user_id='+literal(t.admin.id)+" and capability='printing.configure' and sector_id is null),'null'::jsonb)");
  await rpc(t.admin,'grant_current_hotel_fb_print_capability',{p_user_id:t.admin.id,p_capability:'printing.configure',p_sector_id:null,p_active:true,p_expected_revision:priorGrant?.revision||0});
  const {page,base}=await login(t.admin);await page.goto(base+'/admin/cardapio');await page.locator('[data-fb-admin-workspace]').waitFor();
  check(await page.getByRole('heading',{name:'Gastronomia (F&B)',exact:true}).count()===1,'real authenticated workspace '+t.name);
  check(await page.getByText('Visualização + pedidos',{exact:true}).count()===1,'mode reflects actual enabled B setting '+t.name);
  check(await page.locator('[data-fb-sidebar]').first().evaluate(element=>element.open),'sidebar stays expanded '+t.name);
  await page.goto(base+'/admin/cardapio?kind=item&q='+encodeURIComponent('Prato de fixture'));check(await page.locator('[data-fb-admin-record]').count()===1,'real item search '+t.name);
  await page.goto(base+'/admin/cardapio?kind=item&id='+t.item.id);await page.getByRole('tab',{name:'Idiomas',exact:true}).click();check(await page.getByText('Idiomas do conteúdo salvo',{exact:true}).isVisible(),'integrated languages '+t.name);
  for(const path of ['/admin/pedidos','/admin/impressao']){await page.goto(base+path);await page.locator('[data-fb-workspace-nav]').waitFor();check(new URL(page.url()).pathname===path,'old operational route preserved '+t.name+' '+path);check(await page.locator('[data-fb-workspace-nav] [aria-current=page]').getAttribute('href')===path,'operational active item '+t.name+' '+path);}
  if(index===4){
   for(const path of ['/admin','/admin/experiencia','/admin/servicos','/admin/turismo','/admin/comunicados','/admin/voos','/admin/analytics','/admin/idiomas','/admin/hotel','/admin/apartamentos','/admin/configuracoes','/admin/usuarios','/admin/politicas','/admin/banners','/admin/departamentos']){
    const response=await page.goto(base+path);check(response.status()===200&&new URL(page.url()).pathname===path,'other Admin route remains accessible '+path);await page.locator('h1').first().waitFor();
   }
   const email='ui-capless-'+randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url');const created=await x.project.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw Error('Own fixture Auth creation failed');
   labSql('insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values('+[created.data.user.id,t.id,email,'Operador de fixture','operador'].map(literal).join(',')+',true)');
   const member=await login({email,password});await member.page.goto(member.base+'/admin/cardapio');await member.page.locator('[data-fb-admin-workspace]').waitFor();
   check(await member.page.locator('a[href="/admin/pedidos"],a[href="/admin/impressao"]').count()===0,'real capless operator has no operational links in sidebar or tabs');
   const denied=await member.page.evaluate(async()=>Promise.all(['/api/admin/fb-orders','/api/admin/fb-printing/console'].map(async path=>(await fetch(path,{credentials:'same-origin'})).status)));
   check(denied.every(status=>status===403),'existing backend denies operational APIs for capless operator');
   await config(t.admin,'hotel',{enabled:false},null,t.settings.revision);await page.goto(base+'/admin/cardapio');check(await page.getByText('Somente visualização',{exact:true}).count()===1,'catalog-only label reflects actual disabled B setting');
  }
  const viewer=await login(t.viewer);await viewer.page.goto(viewer.base+'/admin/cardapio?kind=item&id='+t.item.id);await viewer.page.locator('[data-fb-editor]').waitFor();
  check(await viewer.page.getByRole('button',{name:'Salvar alterações',exact:true}).count()===0,'real viewer cannot save '+t.name);
  check(await viewer.page.locator('a[href="/admin/pedidos"],a[href="/admin/impressao"]').count()===0,'real viewer operational links absent '+t.name);
 }
 check(external===0,'no external requests');check(errors.length===0,'no browser runtime errors');
 check(rows('select count(*)::int from fb_print_private.devices')===0,'no Bridge configured or physical print possible');
 const report={suite:'admin-fb-ux-real',passed:checks.length,failed:0,hotels:6,externalRequests:external,physicalPrinting:false,remoteWrites:0,checks};writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:undefined}));
}catch(error){writeFileSync(join(directory,'failure.json'),JSON.stringify({passed:checks.length,error:error.message,checks,errors},null,2));throw error;}finally{for(const context of contexts)await context.close();await browser?.close();await runtime?.stop();}
