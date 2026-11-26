// Explicit localhost-only Admin journey. Never accepts a remote URL or production credentials.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, openSync, closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';

const output=resolve('out/guest-experience-premium-services');mkdirSync(output,{recursive:true});
const container='supabase_db_libguest-45b-lab';
const inspect=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(inspect.Config.Labels['com.supabase.cli.project'],'libguest-45b-lab');
const status=JSON.parse(execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','--workdir','C:/Users/bruno/libguest-45b-lab','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const sql=(query)=>execFileSync('docker',['exec','-i',container,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const service=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const actor=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const hotel=randomUUID(),foreignHotel=randomUUID(),section=randomUUID(),foreignSection=randomUUID();
const email='guest-services-'+randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url');
let userId,server,browser;const checks=[];
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const app='http://127.0.0.1:4328';
try {
  const before=sql("select relrowsecurity::text||':'||(select count(*) from pg_policies where schemaname='public' and tablename='hotel_sections') from pg_class where oid='public.hotel_sections'::regclass");
  sql('begin;'+readFileSync('supabase/migrations/20261126031405_guest_service_presentation.sql','utf8')+'commit;');
  check(sql("select relrowsecurity::text||':'||(select count(*) from pg_policies where schemaname='public' and tablename='hotel_sections') from pg_class where oid='public.hotel_sections'::regclass")===before,'migration preserves local RLS and policy count');
  sql("notify pgrst, 'reload schema'");
  const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);userId=created.data.user.id;
  for(const id of [hotel,foreignHotel]) sql("insert into public.hotels(id,name,slug,platform_status,theme_preset) values("+[id,'Guest services synthetic lab','guest-services-'+id,'active','midnight-slate'].map(lit).join(',')+")");
  sql("insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values("+[userId,hotel,email,'Synthetic guest services admin','administrador'].map(lit).join(',')+",true)");
  const login=await actor.auth.signInWithPassword({email,password});assert.ifError(login.error);
  const modules=await actor.rpc('get_current_hotel_modules');assert.ifError(modules.error);
  if(!modules.data.some(m=>m.module_key==='content.services'&&m.is_enabled)) {
    sql("insert into public.platform_users(user_id,role,is_active) values("+lit(userId)+",'platform_admin',true)");
    for(const moduleKey of ['core.directory','content.services']) { const enabled=await actor.rpc('update_platform_hotel_module',{p_hotel_id:hotel,p_module_key:moduleKey,p_enabled:true});assert.ifError(enabled.error); }
    sql('delete from public.platform_users where user_id='+lit(userId));
  }
  for(const [id,tenant]of[[section,hotel],[foreignSection,foreignHotel]]) sql("insert into public.hotel_sections(id,hotel_id,title,content,category,icon,enabled,service_action_type) values("+[id,tenant,'Lavanderia de homologação','Instruções sintéticas completas para conferir a apresentação, sem pedidos ou canais operacionais.','Lavanderia','Shirt'].map(lit).join(',')+",true,'standard')");
  sql("insert into public.hotel_section_translations(section_id,language,title,content,category) values("+[section,'en','Manual translation preserved','Manual text preserved','Laundry'].map(lit).join(',')+")");
  const denied=await actor.from('hotel_sections').update({guest_presentation:{area:'information'}}).eq('id',foreignSection).select('id');assert.ifError(denied.error);check(denied.data.length===0,'authenticated foreign-tenant update returns no rows');
  const preload=resolve(output,'local-fetch-only.mjs');
  writeFileSync(preload,"const original=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('Non-local fetch blocked in Admin lab');return original(input,init)};\n");
  const log=openSync(resolve(output,'admin-local-server.log'),'w');
  server=spawn(process.execPath,['--import',pathToFileURL(preload).href,'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4328'],{windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,GOOGLE_CLOUD_TRANSLATION_API_KEY:'',FB_LOCAL_LAB:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',log,log]});closeSync(log);
  for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Local server exited; inspect the ignored local server log');try{if((await fetch(app+'/login',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}if(i===119)throw Error('Local Admin server did not become ready');await new Promise(r=>setTimeout(r,500));}
  console.log('Local Auth and isolated synthetic tenants ready; checking real Admin UI');
  browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();});
  await page.goto(app+'/login');await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password);await page.locator('button[type=submit]').click();
  await page.waitForURL(u=>u.pathname.startsWith('/admin'),{timeout:60000});check(true,'real application password login succeeds');
  await page.goto(app+'/admin/servicos/'+section);await page.locator('input[name=title]').waitFor();
  await page.getByText('Apresentação ao hóspede',{exact:true}).click();
  await page.locator('input[name=guest_summary_pt]').fill('Coleta e entrega em laboratório');
  await page.locator('input[name=guest_hours_pt]').fill('Coleta até 14h');
  await page.locator('select[name=guest_group]').selectOption('comfort');
  await page.locator('select[name=guest_interaction]').selectOption('detail');
  await page.locator('.guest-service-row').getByText('Coleta e entrega em laboratório',{exact:true}).waitFor();check(true,'authenticated Admin preview reacts to form edits');
  await page.screenshot({path:resolve(output,'admin-authenticated.png'),fullPage:true});
  await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.waitForURL(u=>u.searchParams.has('success'),{timeout:60000});
  const saved=await actor.from('hotel_sections').select('guest_presentation').eq('id',section).single();assert.ifError(saved.error);
  check(saved.data.guest_presentation.summary.pt==='Coleta e entrega em laboratório','real Server Action persists presentation metadata under tenant RLS');
  const manual=await service.from('hotel_section_translations').select('title,content').eq('section_id',section).eq('language','en').single();assert.ifError(manual.error);check(manual.data.title==='Manual translation preserved','existing manual translation remains unchanged');
  const foreign=await service.from('hotel_sections').select('guest_presentation').eq('id',foreignSection).single();assert.ifError(foreign.error);check(foreign.data.guest_presentation===null,'foreign tenant metadata remains untouched');
  writeFileSync(resolve(output,'authenticated-report.json'),JSON.stringify({scope:'Local Supabase Auth, actual Next Admin and Server Action; synthetic tenants only; no orders or printing',checks,passed:checks.length},null,2));
  console.log('PASS '+checks.length+' authenticated local Admin checks');
} finally {
  if(browser)await browser.close();
  if(server?.pid){try{execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
  if(userId){sql('delete from public.platform_users where user_id='+lit(userId)+';delete from public.hotel_sections where hotel_id in ('+[hotel,foreignHotel].map(lit).join(',')+');delete from public.profiles where id='+lit(userId)+';delete from public.hotels where id in ('+[hotel,foreignHotel].map(lit).join(',')+") and slug like 'guest-services-%';");await service.auth.admin.deleteUser(userId);}
}
