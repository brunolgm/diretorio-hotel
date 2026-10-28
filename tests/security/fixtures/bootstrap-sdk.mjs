// Isolated CLI contract test. All network access is rejected before the entry point loads.
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(process.argv[process.argv.indexOf('--manifest')+1],'utf8'));
const objects=new Map();let rows=[];
const airport={id:'52190000-0000-4000-8000-000000000001',...manifest.airport};
const hotel={id:manifest.hotelId,name:'Synthetic Bootstrap Hotel',subdomain:'bootstraptest',slug:'bugan',platform_status:'suspended',brand_code:null,theme_preset:null};
const query=(table)=>{
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='airports'?airport:null,error:null}),single:async()=>({data:table==='profiles'?{hotel_id:manifest.hotelId,role:'administrador',is_active:true}:hotel,error:null}),then:(resolve)=>Promise.resolve({data:[],error:null}).then(resolve)};
 return q;
};
globalThis.__bootstrapSdk=()=>({
 auth:{signInWithPassword:async credentials=>credentials.password?{data:{user:{id:'52110000-0000-4000-8000-000000000002'}},error:null}:{error:{}},signOut:async options=>{if(options.scope!=='local')throw new Error('global logout forbidden');}},
 from:query,
 rpc:async(name,args)=>{
  if(name==='get_current_hotel_readiness')return {data:[],error:null};
  if(name!=='apply_current_hotel_bootstrap')throw new Error('unexpected RPC');
  rows=args.p_manifest.entries.map((e,i)=>({key:e.key,domain:e.domain,id:e.domain==='media'||e.domain==='flights'?null:`52130000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,status:'created'}));
  if(args.p_manifest.slug)hotel.slug=args.p_manifest.slug.value;
  return {data:rows,error:null};
 },
 storage:{from:()=>({download:async path=>({data:objects.has(path)?new Blob([objects.get(path)]):null,error:null}),upload:async(path,bytes,options)=>{if(options.upsert!==false)throw new Error('upsert forbidden');objects.set(path,bytes);return {error:null};},getPublicUrl:path=>({data:{publicUrl:'https://assets.example.invalid/'+path}})})},
});
globalThis.fetch=async()=>{throw new Error('network forbidden in isolated bootstrap test');};
registerHooks({resolve(s,c,next){if(s==='@supabase/supabase-js')return {url:'data:text/javascript,export const createClient = globalThis.__bootstrapSdk;',shortCircuit:true};return next(s,c);}});