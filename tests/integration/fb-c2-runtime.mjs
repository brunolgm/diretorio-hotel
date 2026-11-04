import{spawn,execFileSync}from'node:child_process';import{createWriteStream,readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync}from'node:fs';import{resolve,join}from'node:path';import{pathToFileURL}from'node:url';import{createServer}from'node:https';import{createServer as portProbe}from'node:net';
export const decode=path=>{const b=readFileSync(path);return b[0]===255&&b[1]===254?b.subarray(2).toString('utf16le'):b.toString('utf8');};
export const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function waitFor(predicate,label,timeout=45000){const at=Date.now();while(Date.now()-at<timeout){if(await predicate())return;await pause(100);}throw Error('C2 wait failed: '+label);}
export async function c2Runtime(s){
 const directory=join(s.dir,'c2');mkdirSync(directory,{recursive:true});const env={...process.env};for(const file of readdirSync('.').filter(f=>/^\.env(?:\.|$)/.test(f)))if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)=/);if(m)env[m[1]]='';}for(const k of Object.keys(env))if(/GOOGLE|AIRLABS|GOOMER|THEX|OPERA|OPENAI|RESEND|SENTRY|VERCEL|SUPABASE/i.test(k))env[k]='';Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:s.api,SUPABASE_URL:s.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon,SUPABASE_SERVICE_ROLE_KEY:s.service,NEXT_TELEMETRY_DISABLED:'1',FB_LOCAL_LAB:'1',NODE_ENV:'production',NODE_OPTIONS:'--import='+pathToFileURL(resolve('scripts/fb-local-network-guard.mjs')).href});
 await new Promise((resolve,reject)=>{const p=portProbe();p.once('error',()=>reject(Error('C2 lab application port occupied')));p.listen(4317,'127.0.0.1',()=>p.close(resolve));});
 const buildLog=createWriteStream(join(directory,'web-build.log'));const builder=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});builder.stdout.pipe(buildLog);builder.stderr.pipe(buildLog);await new Promise((resolve,reject)=>{builder.once('error',reject);builder.once('exit',code=>{buildLog.end();if(code===0)resolve();else reject(Error('C2 web build failed'));});});
 const appLog=createWriteStream(join(directory,'application.log')),app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4317'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});app.stdout.pipe(appLog);app.stderr.pipe(appLog);
 let proxy;
 try{
 await waitFor(()=>fetch(s.app+'/login',{signal:AbortSignal.timeout(2000)}).then(r=>r.ok,()=>false),'C1 application readiness',90000);
 const certificate=JSON.parse(decode('out/fb-c2-certificate.log').trim());const controls={offline:false,dropResult:false,dropped:0,mutateClaim:null,replayClaim:null,requests:[],claimTimes:[],failures:0};
 proxy=createServer({key:readFileSync('out/fb-c2-certificate/key.pem'),cert:readFileSync('out/fb-c2-certificate/certificate.pem')},async(req,res)=>{
  const op=req.url?.split('/').at(-1);if(req.method!=='POST'||req.url!=='/api/fb/printing/device/'+op||!['exchange','heartbeat','claim','receipt','dispatch','result'].includes(op)){res.writeHead(400);res.end();return;}
  controls.requests.push(op);if(op==='claim')controls.claimTimes.push(performance.now());if(controls.offline){controls.failures++;res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"unavailable"}');return;}
  try{
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('request limit');chunks.push(chunk);}const r=await fetch(s.app+req.url,{method:'POST',headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:Buffer.concat(chunks),signal:AbortSignal.timeout(20000)});let body=Buffer.from(await r.arrayBuffer());
   if(op==='result'&&r.ok&&controls.dropResult){controls.dropResult=false;controls.dropped++;res.destroy();return;}
   if(op==='claim'&&r.ok){const value=JSON.parse(body);if(value.job_id)controls.lastClaim=structuredClone(value);if(controls.replayClaim)body=Buffer.from(JSON.stringify(controls.replayClaim));else if(controls.mutateClaim&&value.job_id){controls.mutateClaim(value);body=Buffer.from(JSON.stringify(value));}}
   res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(body);
  }catch{res.destroy();}
 });
 await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(4318,'127.0.0.1',resolve);});
 const exe=resolve('out/fb-c2-publish/LibGuest.PrintingBridge.exe'),testExe=resolve('bridge/LibGuest.PrintingBridge.Tests/bin/Release/net10.0-windows/LibGuest.PrintingBridge.Tests.exe');let counter=0;const processes=new Set();
 function start(command,config,input){
  const child=spawn(exe,[command,'--config',config],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,DOTNET_ROOT:join(directory,'no-global-dotnet')}});processes.add(child);let stdout='',stderr='';const id=++counter;child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{processes.delete(child);writeFileSync(join(directory,'bridge-process-'+id+'.log'),stdout+stderr);resolve({code,signal,stdout,stderr});});});child.stdin.on('error',()=>{});child.stdin.end(input?input+'\n':undefined);return {child,completed,id};
 }
 async function run(command,config,input,expected=0){const p=start(command,config,input);let timer;try{const r=await Promise.race([p.completed,new Promise((_,reject)=>{timer=setTimeout(()=>{p.child.kill('SIGKILL');reject(Error('C2 child timeout '+command));},90000);})]);if(r.code!==expected)throw Error('C2 '+command+' exited '+r.code+' '+r.stderr.slice(0,200));return r;}finally{clearTimeout(timer);}}
 const inspect=data=>JSON.parse(execFileSync(testExe,['inspect',data],{encoding:'utf8',windowsHide:true,timeout:10000}));
 async function stop(){for(const p of processes)p.kill('SIGKILL');await Promise.allSettled([...processes].map(p=>new Promise(r=>p.once('exit',r))));await new Promise(r=>proxy.close(r));try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{app.kill();}appLog.end();}
 return {directory,certificate:certificate.sha256,controls,start,run,inspect,stop};
 }catch(error){if(proxy?.listening)await new Promise(r=>proxy.close(r));try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{app.kill();}appLog.end();throw error;}
}
