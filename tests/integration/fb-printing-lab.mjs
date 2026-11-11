// Shared local-only application harness. No printer submission or remote service.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,createWriteStream,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const nextEntry=createRequire(import.meta.url).resolve('next/dist/bin/next');
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function eventually(fn,label,timeout=45000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await pause(150);}throw Error('Printing lab wait: '+label);}
export async function printingLab(s,label){
 const directory=join(s.dir,label);mkdirSync(directory,{recursive:true});
 const env={...process.env};for(const file of readdirSync('.').filter(f=>/^\.env(?:\.|$)/.test(f)))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)=/);if(m)env[m[1]]='';}for(const key of Object.keys(env))if(/GOOGLE|AIRLABS|GOOMER|THEX|OPERA|OPENAI|RESEND|SENTRY|VERCEL|SUPABASE/i.test(key))env[key]='';
 Object.assign(env,{FB_LOCAL_LAB:'1',NEXT_PUBLIC_SUPABASE_URL:s.api,SUPABASE_URL:s.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon,SUPABASE_SERVICE_ROLE_KEY:s.service,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production',NODE_OPTIONS:'--import='+pathToFileURL(resolve('scripts/fb-local-network-guard.mjs')).href});
 await new Promise((r,j)=>{const probe=createServer();probe.once('error',j);probe.listen(4317,'127.0.0.1',()=>probe.close(r));});
 const buildLog=createWriteStream(join(directory,'build.log'));const build=spawn(process.execPath,[nextEntry,'build'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});build.stdout.pipe(buildLog);build.stderr.pipe(buildLog);await new Promise((r,j)=>{build.once('error',j);build.once('exit',code=>{buildLog.end();if(code===0)r();else j(Error('Printing local optimized build failed'));});});
 const appLog=createWriteStream(join(directory,'application.log'));const app=spawn(process.execPath,[nextEntry,'start','--hostname','127.0.0.1','--port','4317'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});app.stdout.pipe(appLog);app.stderr.pipe(appLog);let browser,external=0;
 const stop=async()=>{await browser?.close();try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{app.kill();}appLog.end();};
 const base=s.app.replace('127.0.0.1','localhost');
 try{
  await eventually(()=>fetch(base+'/login',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok,()=>false),'application');browser=await chromium.launch({channel:'chrome',headless:true});
  async function login(actor,width=1440){const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;if(!['localhost','127.0.0.1'].includes(host)&&!host.endsWith('.localhost')){external++;return route.abort();}return route.continue();});const page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(base+'/login?next=%2Fadmin');await page.locator('input[type=email]').fill(actor.email);await page.locator('input[type=password]').fill(actor.password);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/admin'),{timeout:60000});return {page,context};}
  const api=(page,method,body,query='')=>page.evaluate(async({method,body,query})=>{const r=await fetch('/api/admin/fb-printing/console'+query,{method,credentials:'same-origin',cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:Object.fromEntries(r.headers),data:await r.json()};},{method,body,query});
  return {base,directory,login,api,stop,get external(){return external;}};
 }catch(error){await stop();throw error;}
}
