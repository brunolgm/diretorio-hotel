// Offline disposable Supabase: actual PostgreSQL, GoTrue, PostgREST, Storage, Kong.
// Every run creates its own resources; never connects to another project's stack.
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const stateFile=resolve(root,'out/fb-auth-local-state.json');
const images={
 db:'public.ecr.aws/supabase/postgres:17.6.1.158',
 auth:'public.ecr.aws/supabase/gotrue:v2.195.0',
 rest:'public.ecr.aws/supabase/postgrest:v14.16',
 storage:'public.ecr.aws/supabase/storage-api:v1.69.0',
 kong:'public.ecr.aws/supabase/kong:2.8.1'
};
let daemonVerified=false;
function docker(args,input){
 if(!daemonVerified){
  const context=JSON.parse(execFileSync('docker',['context','inspect'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
  const host=process.env.DOCKER_HOST||context.Endpoints.docker.Host;
  if(!/^(npipe|unix):\/\//.test(host))throw Error('Only a local Docker socket is allowed');
  daemonVerified=true;
 }
 return execFileSync('docker',args,{encoding:'utf8',input,stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024}).trim();
}
export function labState(){const s=JSON.parse(readFileSync(stateFile,'utf8'));if(!/^libguest-fb-auth-[a-f0-9]{8}$/.test(s.name)||s.database!=='fb_s53_auth'||s.dir!==resolve(root,'out',s.name)||s.api!=='http://127.0.0.1:54347'||s.app!=='http://127.0.0.1:4317')throw Error('Untrusted lab state');return s;}
export function labSql(sql,json=false){
 const s=labState();if(docker(['inspect','-f','{{index .Config.Labels "libguest.fb.lab"}}',s.containers.db])!==s.name)throw Error('Container ownership mismatch');
 const command=['exec','-i',s.containers.db,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',s.database];if(json)command.push('-t','-A');
 return docker(command,sql);
}
async function waitFor(name,probe){for(let n=0;n<120;n++){try{if(await probe())return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Local service did not become ready: '+name);}
function token(secret,role){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const value=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400});return value+'.'+createHmac('sha256',secret).update(value).digest('base64url');}
async function up(){
 try{readFileSync(stateFile);throw Error('A lab state already exists; inspect/down that owned lab first.');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const image of Object.values(images))docker(['image','inspect',image,'--format','{{.Id}}']); // Never pull.
 const name='libguest-fb-auth-'+randomUUID().slice(0,8),password=randomBytes(24).toString('hex'),secret=randomBytes(40).toString('hex');
 const dir=resolve(root,'out',name);mkdirSync(dir,{recursive:true});
 const state={name,dir,database:'fb_s53_auth',api:'http://127.0.0.1:54347',app:'http://127.0.0.1:4317',anon:token(secret,'anon'),service:token(secret,'service_role'),containers:{},files:[]};
 const persist=()=>writeFileSync(stateFile,JSON.stringify(state));
 docker(['network','create','--internal','--label','libguest.fb.lab='+name,name]);persist();
 docker(['network','create','--opt','com.docker.network.bridge.enable_ip_masquerade=false','--label','libguest.fb.lab='+name,name+'-ingress']);
 const run=(kind,env,extra=[])=>{
  const envFile=join(dir,kind+'.env');writeFileSync(envFile,Object.entries(env).map(([k,v])=>k+'='+v).join('\n'));state.files.push(envFile);persist();
  state.containers[kind]=docker(['run','--detach','--pull','never','--name',name+'-'+kind,'--label','libguest.fb.lab='+name,'--network',name,'--network-alias',kind,'--env-file',envFile,...extra,images[kind]]);persist();
 };
 try{
  run('db',{POSTGRES_PASSWORD:password,POSTGRES_DB:state.database,JWT_SECRET:secret});
  await waitFor('postgres',()=>spawnSync('docker',['exec',state.containers.db,'pg_isready','-h','127.0.0.1','-U','supabase_admin','-d',state.database],{stdio:'ignore'}).status===0);
  docker(['exec','-i',state.containers.db,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',state.database],
   "alter role authenticator password '"+password+"'; alter role supabase_auth_admin password '"+password+"'; alter role supabase_storage_admin password '"+password+"';");
  run('auth',{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:9999,API_EXTERNAL_URL:state.api+'/auth/v1',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:'postgres://supabase_auth_admin:'+password+'@db:5432/'+state.database,GOTRUE_SITE_URL:state.app,GOTRUE_DISABLE_SIGNUP:true,GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:3600,GOTRUE_JWT_SECRET:secret,GOTRUE_EXTERNAL_EMAIL_ENABLED:true,GOTRUE_MAILER_AUTOCONFIRM:true});
  run('rest',{PGRST_DB_URI:'postgres://authenticator:'+password+'@db:5432/'+state.database,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_DB_EXTRA_SEARCH_PATH:'public,extensions',PGRST_DB_MAX_ROWS:1000});
  run('storage',{ANON_KEY:state.anon,SERVICE_KEY:state.service,POSTGREST_URL:'http://rest:3000',PGRST_JWT_SECRET:secret,DATABASE_URL:'postgres://supabase_storage_admin:'+password+'@db:5432/'+state.database,FILE_SIZE_LIMIT:52428800,STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/var/lib/storage',TENANT_ID:'local',REGION:'local',GLOBAL_S3_BUCKET:'local',ENABLE_IMAGE_TRANSFORMATION:false});
  const kongFile=join(dir,'kong.json');
  writeFileSync(kongFile,JSON.stringify({_format_version:'2.1',consumers:[{username:'anon',keyauth_credentials:[{key:state.anon}]},{username:'service',keyauth_credentials:[{key:state.service}]}],services:[['auth','http://auth:9999/','/auth/v1/'],['rest','http://rest:3000/','/rest/v1/'],['storage','http://storage:5000/','/storage/v1/']].map(([name,url,path])=>({name,url,routes:[{name,paths:[path],strip_path:true}],plugins:[{name:'cors',config:{origins:['*'],headers:['authorization','x-client-info','apikey','content-type','x-supabase-api-version','x-upsert'],exposed_headers:['Content-Range'],credentials:true}},...(name==='storage'?[]:[{name:'key-auth',config:{key_names:['apikey'],hide_credentials:false}}])]}))}));state.files.push(kongFile);persist();
  run('kong',{KONG_DATABASE:'off',KONG_DECLARATIVE_CONFIG:'/home/kong/kong.json',KONG_PROXY_LISTEN:'0.0.0.0:8000',KONG_ADMIN_LISTEN:'off',KONG_DNS_ORDER:'LAST,A,CNAME',KONG_NGINX_WORKER_PROCESSES:1},['-p','127.0.0.1:54347:8000','--mount','type=bind,src='+kongFile+',dst=/home/kong/kong.json,readonly']);
  docker(['network','connect',name+'-ingress',state.containers.kong]);
  const request=async path=>{const r=await fetch(state.api+path,{headers:{apikey:state.anon,Authorization:'Bearer '+state.anon},signal:AbortSignal.timeout(3000)});await r.arrayBuffer();return r;};
  await waitFor('auth',async()=>(await request('/auth/v1/health')).ok);
  await waitFor('rest',async()=>(await request('/rest/v1/')).ok);
  await waitFor('storage',async()=>(await request('/storage/v1/status')).ok);
  labSql(readFileSync(join(root,'supabase/tests/53_fb_auth_baseline.sql'),'utf8'));
  let governanceBefore;
  const governanceState=()=>JSON.parse(labSql("select jsonb_build_object('oid',oid,'owner',pg_get_userbyid(proowner),'acl',proacl,'definer',prosecdef,'config',proconfig,'definition',pg_get_functiondef(oid)) from pg_proc where oid='public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure",true));
  const migrations=readdirSync(join(root,'supabase/migrations')).filter(p=>p.endsWith('.sql')).sort();
  const through=process.env.FB_LAB_THROUGH_MIGRATION;
  if(through&&!migrations.includes(through))throw Error('Unknown local migration checkpoint');
  const selected=migrations.filter(file=>!through||file<=through);
  for(const file of selected){
   if(file==='202608110002_45b_close_direct_analytics_insert.sql')labSql(readFileSync(join(root,'supabase/tests/53_fb_auth_legacy_transition.sql'),'utf8'));
   if(file.endsWith('_sprint_53_fb_governance_available.sql'))governanceBefore=governanceState();
   try{labSql(readFileSync(join(root,'supabase/migrations',file),'utf8'));}catch(e){writeFileSync(join(dir,'schema-error.log'),String(e.stderr||e));throw Error('Local migration failed: '+file);}
  }
  const governanceAfter=governanceState();
  const expectedDefinition=governanceBefore.definition.replace("p_enabled and p_module_key in('experience.seo','fb.menu',","p_enabled and p_module_key in('experience.seo',");
  if(governanceAfter.definition!==expectedDefinition)throw Error('Unexpected governance function change');
  for(const key of ['oid','owner','acl','definer','config'])if(JSON.stringify(governanceAfter[key])!==JSON.stringify(governanceBefore[key]))throw Error('Governance identity/security changed: '+key);
  const schemaAudit=JSON.parse(labSql("select jsonb_build_object('governanceOwner',pg_get_userbyid((select proowner from pg_proc where oid='public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure)),'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'hotel_fb_%' and c.relkind='r'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%hotel_fb%'),'legacyConstraint',pg_get_constraintdef((select oid from pg_constraint where conname='hotel_sections_id_hotel_id_key' and conrelid='public.hotel_sections'::regclass)))",true));
  writeFileSync(join(dir,'schema-audit.json'),JSON.stringify({...schemaAudit,governanceOidAclOwnerPreserved:true,onlyFbAvailabilityChanged:true},null,2));
  labSql("notify pgrst, 'reload schema';");
  state.ready=true;persist();
  console.log(JSON.stringify({status:'ready',name,api:state.api,app:state.app,migrations:selected.length,networkInternal:docker(['network','inspect',name,'-f','{{.Internal}}'])==='true'}));
 }catch(e){console.error(e.message);console.error('Owned lab preserved for inspection; use down after diagnosis.');process.exitCode=1;}
}
function down(){
 const s=labState();
 for(const id of Object.values(s.containers)){
  if(docker(['inspect','-f','{{index .Config.Labels "libguest.fb.lab"}}',id])!==s.name)throw Error('Cleanup ownership mismatch');
  docker(['rm','--force','--volumes',id]);
 }
 if(docker(['network','inspect',s.name,'-f','{{index .Labels "libguest.fb.lab"}}'])!==s.name)throw Error('Network ownership mismatch');
 docker(['network','rm',s.name]);
 try{if(docker(['network','inspect',s.name+'-ingress','-f','{{index .Labels "libguest.fb.lab"}}'])!==s.name)throw Error('Ingress ownership mismatch');docker(['network','rm',s.name+'-ingress']);}catch(e){if(!String(e.stderr).includes('not found'))throw e;}
 for(const file of s.files){if(dirname(resolve(file))!==resolve(s.dir))throw Error('Unsafe cleanup path');unlinkSync(file);}
 unlinkSync(stateFile);console.log(JSON.stringify({status:'removed',name:s.name,otherProjectsTouched:false}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const command=process.argv[2];if(command==='up'){const keep=setInterval(()=>{},1000);try{await up();}finally{clearInterval(keep);}}else if(command==='down')down();else throw Error('Use up or down; no remote URL accepted.');
}
