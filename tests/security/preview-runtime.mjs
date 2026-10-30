// Isolated synthetic SDK/session. No real cookies, Auth, database or network.
import '../../scripts/bootstrap-runtime.mjs';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
/** @type {{user:boolean,role:string,active:boolean,status:string,modules:string[],tables:Record<string,unknown[]>,queries:unknown[],failTable:string|null}} */
export const state={user:true,role:'administrador',active:true,status:'suspended',modules:[],tables:{},queries:[],failTable:null};
const moduleUrl=source=>'data:text/javascript,'+encodeURIComponent(source);
const self=new URL('./preview-runtime.mjs',import.meta.url).href;
export const client={auth:{getUser:async()=>({data:{user:state.user?{id:'admin'}:null}})},rpc:async(name,args)=>{
 if(name==='get_current_hotel_modules')return {data:state.modules.map(module_key=>({module_key,is_enabled:true})),error:null};
 if(name==='is_hotel_module_enabled')return {data:state.modules.includes(args.p_module_key),error:null};
 if(name==='get_current_hotel_experience_layout')return {data:[],error:null};
 if(name==='get_current_hotel_service_guide'){state.queries.push({rpc:name,serviceId:args.p_service_id});const g=state.tables.hotel_service_guides?.find(g=>g.service_id===args.p_service_id&&g.hotel_id==='own');return {data:g?[g]:null,error:g?null:{code:'42501'}};}
 if(name==='get_current_hotel_published_service_guides')return {data:[],error:null};
 throw Error('Unexpected RPC '+name);
},from(table){let filters=[],single=false,limit=Infinity;const q={
 select(){return q;},eq(k,v){filters.push(r=>r[k]===v);state.queries.push({table,k,v});return q;},
 in(k,values){filters.push(r=>values.includes(r[k]));return q;},order(){return q;},limit(n){limit=n;return q;},
 maybeSingle(){single=true;return q;},single(){single=true;return q;},
 then(resolve){if(state.failTable===table)return Promise.resolve({data:null,error:{code:'XX000'}}).then(resolve);let rows=table==='profiles'?[{id:'admin',hotel_id:'own',role:state.role,is_active:state.active}]:table==='hotels'?[{id:'own',slug:'own',subdomain:'own',name:'Synthetic',platform_status:state.status}]:state.tables[table]??[];
 rows=rows.filter(r=>filters.every(f=>f(r))).slice(0,limit);return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);}
};return q;}};
registerHooks({resolve(spec,ctx,next){
 if(spec==='@/lib/supabase/server')return {url:moduleUrl(`import {client} from ${JSON.stringify(self)};export const createClient=async()=>client;`),shortCircuit:true};
 if(spec==='@/lib/supabase/public')return {url:moduleUrl('export const createPublicClient=()=>{throw Error("Public client forbidden in private preview")};'),shortCircuit:true};
 if(spec==='@/lib/supabase/admin')return {url:moduleUrl('export const createAdminClient=()=>{throw Error("Service role forbidden")};'),shortCircuit:true};
 if(spec==='next/navigation')return {url:moduleUrl('export const redirect=p=>{throw Error("REDIRECT:"+p)};export const notFound=()=>{throw Error("NOT_FOUND")};'),shortCircuit:true};
 if(spec==='@/lib/domain-context')return {url:moduleUrl('export const getRequestDomainContext=async()=>({kind:"product-root",productRootDomain:"libguest.digital"});export const isHotelSubdomainContext=()=>false;'),shortCircuit:true};
 if(spec.startsWith('@/components/public/')){
  const exports=['HotelPublicAreaContent','HotelServiceDetailContent','HotelPublicFlightCenter','PublicTourismContent'];
  return {url:moduleUrl(exports.map(n=>`export function ${n}(){return null}`).join(';')),shortCircuit:true};
 }
 if(spec.startsWith('.')&&!spec.endsWith('.ts')&&!spec.endsWith('.mjs')&&ctx.parentURL?.startsWith('file:')){const url=new URL(spec+'.ts',ctx.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};}
 return next(spec,ctx);
},load(url,ctx,next){if((url.includes('/lib/')&&url.endsWith('.ts'))||url.endsWith('/app/preview/[...path]/page.tsx')||url.includes('/app/preview/%5B...path%5D/page.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,ctx);}});
