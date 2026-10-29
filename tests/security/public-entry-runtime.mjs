// Execute actual public page adapters with synthetic loader results. No real auth/network.
import '../../scripts/bootstrap-runtime.mjs';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
/** @type {{data:unknown,subdomain:boolean,room:unknown,queries:unknown[]}} */
export const state={data:null,subdomain:true,room:null,queries:[]};
const self=new URL('./public-entry-runtime.mjs',import.meta.url).href;
const moduleUrl=s=>'data:text/javascript,'+encodeURIComponent(s);
registerHooks({resolve(spec,ctx,next){
 const modules={
  '@/lib/public-hotel-data':`import {state} from ${JSON.stringify(self)};export const getPublicHotelPageDataBySlug=async(slug,lang)=>{state.queries.push({slug,lang});return state.data};export const getPublicHotelPageDataBySubdomain=async(subdomain,lang)=>{state.queries.push({subdomain,lang});return state.data};`,
  '@/lib/domain-context':`import {state} from ${JSON.stringify(self)};export const getRequestDomainContext=async()=>({kind:state.subdomain?'hotel-subdomain':'product-root',subdomain:'buganrecife'});export const isHotelSubdomainContext=c=>c.kind==='hotel-subdomain';`,
  '@/lib/room-context':`import {state} from ${JSON.stringify(self)};export const readRoomContext=async()=>state.room;`,
  '@/lib/room-links':'export const resolveActiveRoomContextForHotel=async()=>{throw Error("Unexpected room lookup")};',
  '@/lib/public-theme-preview':'export const resolveDevelopmentThemePreview=()=>null;',
  '@/components/public/hotel-public-page-content':'export function HotelPublicPageContent(){return null}',
  '@/components/public/hotel-experience-unavailable':'export function HotelExperienceUnavailable(){return null}',
 };
 if(modules[spec])return {url:moduleUrl(modules[spec]),shortCircuit:true};return next(spec,ctx);
},load(url,ctx,next){
 if(url.endsWith('/app/page.tsx')||/\/app\/hotel\/(?:\[slug\]|%5Bslug%5D)\/page.tsx/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,ctx);
}});
