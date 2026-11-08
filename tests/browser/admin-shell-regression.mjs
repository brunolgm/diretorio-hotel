// Compares the exact pre-extraction shell with AdminShell using the same real pages and mocked reads.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),{build}=require('esbuild'),postcss=require('postcss'),{chromium}=require('playwright');
const root=process.cwd(),out=resolve('out/admin-printing-premium-v3'),origin='http://127.0.0.1:4212';mkdirSync(out,{recursive:true});
const base=execFileSync('git',['show','31f97db:app/admin/layout.tsx'],{encoding:'utf8'});
const markup=base.slice(base.indexOf('  return (')).replaceAll('hotel?.logo_url || null','hotelLogoUrl').replaceAll('profile.normalizedRole','userRole');
const candidate=readFileSync('components/admin/admin-shell.tsx','utf8');
const props=candidate.slice(candidate.indexOf('export function AdminShell'),candidate.indexOf('  return ('));
const baseline="import {AdminSidebar} from '@/components/admin/admin-sidebar';\nimport {AdminThemeProvider} from '@/components/admin/admin-theme-provider';\nimport {MobileMenu} from '@/components/admin/mobile-menu';\nimport {getAdminThemeStyle} from '@/lib/admin-theme';\n"+props+markup;
writeFileSync(join(out,'baseline-shell.tsx'),"import type {ReactNode} from 'react';\nimport type {AdminTheme} from '@/lib/admin-theme';\nimport type {AdminNavigationGroup} from '@/lib/admin-navigation';\n"+baseline);
writeFileSync(join(out,'navigation-stub.ts'),readFileSync('tests/browser/admin-fb-navigation-stub.ts','utf8')+"\nexport function notFound():never{throw Error('Local fixture route not found');}\n");
const dataAdapter=`
 import {fbFixture} from '@/tests/fixtures/fb';
 import {HOTEL_READINESS_CHECK_CATALOG} from '@/lib/hotel-readiness';
 export {hasMinimumRole} from '@/lib/app-roles';
 import {fbWorkspaceLinks} from '@/lib/fb/admin-workspace';
 const fixture=fbFixture(4),graph=fixture.fb;
 const hotel={...fixture.hotel,platform_status:'active',checkin_time:'14:00',checkout_time:'12:00'};
 export const requireAdminAccess=async()=>({profile:{hotel_id:hotel.id,normalizedRole:'visualizador'}});
 export const getAdminHotel=async()=>hotel;
 export const hasHotelModule=async()=>false;
 export const requireHotelModule=async()=>{};
 export const getCurrentHotelAnalytics=async()=>{throw Error('Analytics disabled in local fixture');};
 export const getCurrentHotelReadiness=async()=>({hotelId:hotel.id,platformStatus:'active',readyToActivate:true,blockingCount:0,warningCount:0,checks:HOTEL_READINESS_CHECK_CATALOG.map(c=>({...c,passed:true}))});
 export const readFbWorkspaceLinks=async()=>fbWorkspaceLinks({editorial:true,orders:false,printing:false});
 export const readFbWorkspaceMode=async()=>({mode:'catalog_only',unavailable:null});
 const tables={hotels:[hotel],hotel_sections:fixture.sections,hotel_section_translations:[],hotel_fb_outlets:graph.outlets,hotel_fb_menus:graph.menus,hotel_fb_categories:graph.categories,hotel_fb_items:graph.items,hotel_fb_outlet_menus:graph.outlet_menus,hotel_fb_service_links:graph.service_links,hotel_tourism_items:[{id:'53000000-0000-4000-8000-000000000999',name:'Passeio de demonstração',short_description:'Conteúdo controlado para a regressão do shell.',type:'place',category_key:'culture',is_published:true,featured:false,recommended_by_hotel:true}]};
 export const createClient=async()=>({from(table){if(!(table in tables))throw Error('Unexpected read: '+table);let start=0,end=Infinity,single=false;const q={select(){return q},eq(){return q},in(){return q},order(){return q},range(a,b){start=a;end=b;return q},single(){single=true;return q},then(done){const data=tables[table].slice(start,end+1);return Promise.resolve({data:single?data[0]:data,error:null,count:tables[table].length}).then(done)}};return q;}});
`;
const adaptedData=dataAdapter.replace('hotel_section_translations:[],','hotel_section_translations:[],hotel_fb_outlets_translations:[],hotel_fb_menus_translations:[],hotel_fb_categories_translations:[],hotel_fb_items_translations:[],');
const boundaries=new Set(['@/lib/auth','@/lib/queries','@/lib/readiness-queries','@/lib/admin-entitlements','@/lib/analytics-queries','@/lib/supabase/server','@/lib/fb/admin-workspace.server']);
const plugin={name:'local-page-data',setup(b){
 b.onResolve({filter:/.*/},args=>{
  if(boundaries.has(args.path))return {path:'local-adapter',namespace:'local-data'};
  if(args.path==='server-only')return {path:'empty',namespace:'local-empty'};
  if(/\/actions$/.test(args.path)){
   const file=args.path.startsWith('@/')?resolve(root,args.path.slice(2)+'.ts'):resolve(dirname(args.importer),args.path+'.ts');
   if(file.includes(join('app','admin')))return {path:file,namespace:'local-actions'};
  }
 });
 b.onLoad({filter:/.*/,namespace:'local-data'},()=>({contents:adaptedData,loader:'js',resolveDir:root}));
 b.onLoad({filter:/.*/,namespace:'local-empty'},()=>({contents:'export {};',loader:'js'}));
 b.onLoad({filter:/.*/,namespace:'local-actions'},args=>{const source=readFileSync(args.path,'utf8'),names=[...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);return {contents:names.map(name=>`export async function ${name}(){throw Error('Mutation forbidden in shell regression');}`).join('\n'),loader:'js'};});
}};
for(const version of ['before','after'])await build({entryPoints:['tests/browser/admin-shell-regression-fixture.tsx'],bundle:true,platform:'browser',jsx:'automatic',format:'esm',tsconfig:'tsconfig.json',outfile:join(out,'shell-'+version+'.js'),define:{'process.env':'{}','process.env.NODE_ENV':JSON.stringify('development')},plugins:[plugin],alias:{'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':join(out,'navigation-stub.ts'),'@/components/admin/admin-shell':version==='before'?join(out,'baseline-shell.tsx'):resolve('components/admin/admin-shell.tsx')}});
const css=await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
writeFileSync(join(out,'shell-before-style.css'),css.css+'\n'+readFileSync('components/admin/fb-workspace.css','utf8'));
writeFileSync(join(out,'shell-style.css'),css.css+'\n'+readFileSync('components/admin/fb-workspace.css','utf8')+'\n'+readFileSync('components/admin/fb-printing.css','utf8'));
const denied=[],errors=[],checks=[],comparisons=[];
const server=createServer((req,res)=>{const url=new URL(req.url,origin),path=url.pathname;res.setHeader('Cache-Control','no-store');if(req.method!=='GET'||path.startsWith('/api/')){denied.push({method:req.method,path});res.writeHead(403);res.end();return;}if(['/shell-before.js','/shell-after.js','/shell-style.css','/shell-before-style.css'].includes(path)){res.setHeader('Content-Type',path.endsWith('.css')?'text/css':'application/javascript');res.end(readFileSync(join(out,path.slice(1))));return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shell-'+(url.searchParams.get('shell')==='before'?'before-style':'style')+'.css"><div id="root"></div><script type="module" src="/shell-'+(url.searchParams.get('shell')==='before'?'before':'after')+'.js"></script></html>');});
await new Promise(r=>server.listen(4212,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{const req=route.request();if(new URL(req.url()).origin!==origin||req.method()!=='GET'){denied.push({method:req.method(),url:req.url()});return route.abort();}return route.continue();});
 const routes={dashboard:'/admin',services:'/admin/servicos',gastronomy:'/admin/cardapio',tourism:'/admin/turismo'};
 const snapshot=()=>page.evaluate(()=>({text:document.querySelector('#root').innerText,links:Array.from(document.querySelectorAll('#root a')).map(n=>({label:n.textContent,href:n.getAttribute('href'),active:n.getAttribute('aria-current')})),layout:Array.from(document.querySelectorAll('#root *')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,cls:n.getAttribute('class'),text:n.children.length?null:n.textContent,box:[r.x,r.y,r.width,r.height].map(x=>Math.round(x*100)/100),color:s.color,bg:s.backgroundColor,font:s.fontSize,display:s.display};})}));
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1000:844});for(const [view,path] of Object.entries(routes)){
  const states={};for(const version of ['before','after']){
   await page.goto(origin+path+'?'+new URLSearchParams({view,shell:version}));await page.locator('h1').waitFor();await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   states[version]=await snapshot();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow '+view+' '+width+' '+version);
   if(width===390){await page.getByRole('button',{name:'Abrir menu administrativo'}).click();await page.getByRole('dialog').waitFor();states[version].mobileMenu=await page.getByRole('dialog').innerText();check(states[version].mobileMenu.includes('Bugan Recife'),'mobile menu context '+view+' '+version);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});check(await page.getByRole('button',{name:'Abrir menu administrativo'}).evaluate(n=>n===document.activeElement),'mobile focus restored '+view+' '+version);}
  }
  check(JSON.stringify(states.before)===JSON.stringify(states.after),'equivalent DOM/layout/links '+view+' '+width);comparisons.push({view,width,equivalent:true,elements:states.after.layout.length,links:states.after.links.length});
 }}
 check(errors.length===0,'no page runtime errors');check(denied.length===0,'zero external or mutating requests');
 writeFileSync(join(out,'admin-shell-report.json'),JSON.stringify({passed:checks.length,failed:0,checks,comparisons,errors,denied,pages:'Actual Dashboard, Services, Gastronomy and Tourism page components; data/Auth mocked locally, readonly profile',comparison:'Pre-extraction main markup vs current AdminShell; visible DOM, geometry, styles, links, active nav, mobile menu and focus; no extra captures'},null,2));console.log(JSON.stringify({passed:checks.length,comparisons:comparisons.length,failed:0}));
}catch(e){writeFileSync(join(out,'admin-shell-failure.json'),JSON.stringify({passed:checks.length,error:e.message,errors,denied},null,2));throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
