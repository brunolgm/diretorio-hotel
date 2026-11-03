import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream,readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'node:net';
import {seedB23,rpc,config,saved,basket,fullIntent} from './fb-b23-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {literal,rows} from './fb-local-seed.mjs';
const {orderCopy}=await import('../../lib/fb/orders/journey.ts');
const checks=[],pageErrors=[],contexts=[];let lab,browser,app,externalRequests=0;
const progress=setInterval(()=>{if(lab)writeFileSync(join(lab.s.dir,'b23-progress.json'),JSON.stringify({passed:checks.length,lastCheck:checks.at(-1)},null,2));},5000);progress.unref();
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
try{
 lab=await seedB23();const {s}=lab;const base=s.app.replace('127.0.0.1','localhost');const directory=join(s.dir,'b23');mkdirSync(join(directory,'screenshots'),{recursive:true});
 console.log('B23: six synthetic tenants, 31 actual GoTrue users, isolated Storage and catalogue seeded.');
 for(const file of ['53_b1_foundation_matrix.sql','53_b23_journey_operations.sql']){const raw=labSql(readFileSync('supabase/tests/'+file,'utf8'));writeFileSync(join(directory,file+'.log'),raw);const line=raw.split('\n').find(l=>l.includes('"suite"'));const result=JSON.parse(line);check(result.failed===0,'actual SQL '+result.suite+' '+result.passed);console.log(JSON.stringify(result));}
 const env={...process.env};for(const path of ['.env','.env.local','.env.development','.env.development.local'])if(existsSync(path))for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Za-z_]\w*)=/);if(match)env[match[1]]='';}
 for(const key of Object.keys(env))if(/GOOGLE|AIRLABS|GOOMER|THEX|OPERA|OPENAI|RESEND|SENTRY|VERCEL|SUPABASE/i.test(key))env[key]='';
 Object.assign(env,{FB_LOCAL_LAB:'1',NEXT_PUBLIC_SUPABASE_URL:s.api,SUPABASE_URL:s.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon,SUPABASE_SERVICE_ROLE_KEY:s.service,NEXT_TELEMETRY_DISABLED:'1',NPM_CONFIG_UPDATE_NOTIFIER:'false',NODE_ENV:'development',NODE_OPTIONS:'--import='+pathToFileURL(resolve('scripts/fb-local-network-guard.mjs')).href});
 await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(Error('Local application port is occupied; refusing to replace another process')));probe.listen(4317,'127.0.0.1',()=>probe.close(resolve));});
 const production=process.env.FB_LOCAL_PRODUCTION==='1';if(production)env.NODE_ENV='production';
 const log=createWriteStream(join(directory,'application.log'));app=spawn(process.execPath,['node_modules/next/dist/bin/next',production?'start':'dev','--hostname','127.0.0.1','--port','4317'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});app.stdout.pipe(log);app.stderr.pipe(log);
 let ready=false;for(let n=0;n<180;n++){if(await fetch(base+'/login',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok,()=>false)){ready=true;break;}await new Promise(r=>setTimeout(r,500));}check(ready,'actual Next application ready with offline network guard');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--host-resolver-rules=MAP *.localhost 127.0.0.1']});
 async function context(options={}){const c=await browser.newContext({viewport:{width:1440,height:1000},...options});contexts.push(c);await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)&&!u.hostname.endsWith('.localhost')){externalRequests++;return r.abort();}return r.continue();});c.on('page',p=>p.on('pageerror',e=>pageErrors.push(e.message)));return c;}
 async function login(actor,target='/admin/pedidos'){const c=await context();const page=await c.newPage();await page.goto(base+'/login?next='+encodeURIComponent(target));await page.locator('input[type=email]').fill(actor.email);await page.locator('input[type=password]').fill(actor.password);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/admin'),{timeout:120000});await page.goto(base+target);await page.locator('h1').first().waitFor();check(new URL(page.url()).pathname===target,'normal application Auth session '+target);return {context:c,page};}
 async function api(page,path,method='GET',body){assert.ok(path.startsWith('/api/'));return page.evaluate(async({path,method,body})=>{const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:Object.fromEntries(r.headers)};},{path,method,body});}
 async function hydrated(locator){await locator.evaluate(el=>new Promise((resolve,reject)=>{const ready=()=>[el,el.form].filter(Boolean).some(node=>Object.keys(node).some(k=>k.startsWith('__reactProps$')&&(typeof node[k]?.onClick==='function'||typeof node[k]?.onSubmit==='function')));if(ready())return resolve();const timer=setInterval(()=>{if(ready()){clearInterval(timer);clearTimeout(timeout);resolve();}},20);const timeout=setTimeout(()=>{clearInterval(timer);reject(Error('Control did not hydrate'));},20000);}));}
 async function shot(page,name){await page.screenshot({path:join(directory,'screenshots',name+'.png'),fullPage:true,animations:'disabled'});checks.push('screenshot '+name);}
 const count=t=>rows('select count(*)::text from fb_order_private.orders where hotel_id='+literal(t.id));
 const resetAdmission=t=>labSql('delete from fb_order_private.admission_buckets where hotel_id='+literal(t.id));
 const shared={...lab,base,directory,check,context,login,api,hydrated,shot,count,resetAdmission,rpc,config,saved,basket,fullIntent,literal,rows,labSql,orderCopy};
 const {publicJourneyMatrix}=await import('./fb-b23-public.mjs');await publicJourneyMatrix(shared);
 const {operationalMatrix}=await import('./fb-b23-operations.mjs');await operationalMatrix(shared);
 const {adversarialJourneyMatrix}=await import('./fb-b23-adversarial.mjs');await adversarialJourneyMatrix(shared);
 if(process.env.FB_B4==='1'){const {verifyB4}=await import('./fb-b4.mjs');await verifyB4(shared);}
 check(pageErrors.length===0,'no actual browser runtime errors');check(externalRequests===0,'zero attempted external browser requests');
 const appLog=readFileSync(join(directory,'application.log'),'utf8');check(!appLog.includes('Homologação B23')&&!appLog.includes('Observação privada de fixture'),'no submitted identity or observations in application logs');
 const result={suite:'fb-b23-real-journey-operations',b4:process.env.FB_B4==='1',appMode:production?'production':'development',focus:process.env.FB_B23_FOCUS||null,passed:checks.length,failed:0,hotels:6,authUsers:31,languages:['pt','en','es'],viewports:[390,1440],migrations:readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).length,externalRequests,pageErrors,checks};writeFileSync(join(directory,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,checks:undefined,pageErrors:undefined,directory}));
}catch(error){if(lab){writeFileSync(join(lab.s.dir,'b23-failure.json'),JSON.stringify({passed:checks.length,error:error.message,checks},null,2));for(const [i,c]of contexts.entries())for(const [j,p]of c.pages().entries())if(!p.isClosed())await p.screenshot({path:join(lab.s.dir,'b23-failure-'+i+'-'+j+'.png'),fullPage:true,timeout:5000}).catch(()=>{});}console.error(error.stack);process.exitCode=1;}
finally{clearInterval(progress);for(const c of contexts)await c.close().catch(()=>{});await browser?.close();if(app?.pid){try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{app.kill();}}}
