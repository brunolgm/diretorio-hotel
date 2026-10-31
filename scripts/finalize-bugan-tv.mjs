import './bootstrap-runtime.mjs';
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {finalizeBuganTv} from './finalize-bugan-tv-core.mjs';
let client,state={stage:'plan',operation:'manifest.read',writesAttempted:false};
try{
 const m=JSON.parse(readFileSync('docs/bootstrap/bugan-tv-editorial-final-20261030.json','utf8'));
 if(process.argv.includes('--plan'))console.log(JSON.stringify({status:'tv_editorial_plan',writes:false,hotelId:m.hotelId,expectedRevision:m.expectedRevision,steps:m.steps,publication:false}));
 else{
  process.loadEnvFile('.env.local');if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://'+m.projectRef+'.supabase.co')throw {code:'PROJECT_MISMATCH'};
  state={stage:'authentication',operation:'auth.signInWithPassword',writesAttempted:false};let raw='';for await(const part of process.stdin){raw+=part;if(raw.length>16384)throw {code:'INPUT_INVALID'};}let credentials=JSON.parse(raw);raw='';if(credentials.email!=='libguestbugan@yahoo.com')throw {code:'ACCOUNT_MISMATCH'};
  client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const auth=await client.auth.signInWithPassword(credentials);credentials=null;if(auth.error||!auth.data.session)throw {code:'AUTH_FAILED'};
  const result=await finalizeBuganTv(client,m,p=>{state=p;});mkdirSync('out',{recursive:true});writeFileSync('out/bugan-tv-editorial-final.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}catch(error){const allowed=['PT409','STEP_CONFLICT','MANIFEST_INVALID','READ_UNCONFIRMED','AUTH_REQUIRED','AUTHORIZATION_REQUIRED','LIFECYCLE_CONFLICT','MODULES_REQUIRED','ADMINISTRATOR_CONFLICT','SERVICE_STATE_CONFLICT','PUBLICATION_CONFLICT','PRESERVATION_CONFLICT','WRITE_UNCONFIRMED','RESPONSE_AMBIGUOUS','AUDIT_UNCONFIRMED','PROJECT_MISMATCH','ACCOUNT_MISMATCH','AUTH_FAILED','INPUT_INVALID'];console.error(JSON.stringify({status:'interrupted',...state,code:allowed.includes(error?.code)?error.code:'UNCONFIRMED',message:'Confira por leitura antes de repetir; nao envie senha ou token ao chat.'}));process.exitCode=1;}
finally{if(client)await client.auth.signOut({scope:'local'}).catch(()=>{});}
