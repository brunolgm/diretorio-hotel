import './bootstrap-runtime.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {tourismEditorialPlan,applyTourismEditorial} from './apply-tourism-editorial-core.mjs';
const args=process.argv.slice(2),path=args[args.indexOf('--manifest')+1];let client,stage='plan',operation='validate',writesAttempted=false;
try{
 const manifest=JSON.parse(readFileSync(path,'utf8'));tourismEditorialPlan(manifest);
 const resumeCheckpoint=args.includes('--resume')?JSON.parse(readFileSync('docs/bootstrap/bugan-tourism-v4-resume-20261029.json','utf8')):undefined;
 if(args.includes('--plan')){console.log(JSON.stringify({mode:resumeCheckpoint?'resume-plan':'plan',writes:false,newItems:resumeCheckpoint?0:manifest.entries.length,confirmedItems:resumeCheckpoint?.items.length,collections:manifest.destinations.filter(d=>d.kind==='collection').length,hotelId:manifest.hotelId,bootstrapPlanned:!resumeCheckpoint,googleUsed:false}));process.exit(0);}
 mkdirSync('out',{recursive:true});
 process.loadEnvFile('.env.local');if(process.env.NEXT_PUBLIC_SUPABASE_URL!==`https://${manifest.projectRef}.supabase.co`)throw {code:'PROJECT_MISMATCH'};
 stage='authentication';operation='auth.signInWithPassword';let input='';for await(const part of process.stdin){input+=part;if(input.length>16384)throw {code:'INPUT_INVALID'};}
 let credentials=JSON.parse(input);input='';if(credentials.email!=='libguestbugan@yahoo.com')throw {code:'ACCOUNT_MISMATCH'};
 client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await client.auth.signInWithPassword(credentials);credentials=null;if(signed.error)throw {code:'AUTH_FAILED'};
 const report=await applyTourismEditorial(client,manifest,state=>{stage=state.stage;operation=state.operation;writesAttempted=state.writesAttempted;},{resumeCheckpoint});
 writeFileSync(resumeCheckpoint?'out/bugan-tourism-v4-reconciled.json':'out/bugan-tourism-v4-applied.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){const allowed=['PT409','42501','22023','WRITE_UNCONFIRMED','LIFECYCLE_CONFLICT','MODULES_REQUIRED','AUTHORIZATION_REQUIRED','AUTH_REQUIRED','AUTH_FAILED','TRANSLATIONS_REQUIRED','PROJECT_MISMATCH','ACCOUNT_MISMATCH','INVALID_MANIFEST'];console.error(JSON.stringify({status:'interrupted',stage,operation,writesAttempted,origin:error?.origin==='executor_validation'?'executor_validation':'operation',code:allowed.includes(error?.code)?error.code:'UNCONFIRMED',message:'Operacao nao confirmada; confira por leitura antes de repetir. Nenhum segredo foi registrado.'}));process.exitCode=1;}
finally{if(client)await client.auth.signOut({scope:'local'}).catch(()=>{});}
