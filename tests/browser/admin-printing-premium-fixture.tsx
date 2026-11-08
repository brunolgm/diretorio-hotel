import {createRoot} from 'react-dom/client';
import {AdminShell} from '@/components/admin/admin-shell';
import {AdminBreadcrumbs} from '@/components/admin/ui';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {FbPrintingConsole} from '@/components/admin/fb-printing-console';
import {resolveAdminTheme} from '@/lib/admin-theme';
import {getAdminNavigationForRole} from '@/lib/admin-navigation';
import {fbWorkspaceLinks} from '@/lib/fb/admin-workspace';
import {PRINT_STATES} from '@/lib/fb/printing/contracts';
import type {PrintConsole,AdminPrintJob} from '@/lib/fb/printing/admin';
import type {Commissioning} from '@/lib/fb/printing/commissioning';

declare global {interface Window {printingFixtureCommands: {operation:string;body:Record<string,unknown>;key:string;confirmed:boolean}[]}}
const params=new URLSearchParams(location.search),scenario=params.get('state')??'attention',restricted=params.get('viewer')==='1';
const id=(n:number)=>'55000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now='2026-11-08T15:00:00-03:00',healthy=scenario==='healthy';
const snapshot:PrintConsole={server_time:now,next:null,access:{hotel_id:id(100),configure:!restricted,manage_grants:!restricted,order_scopes:[{sector_id:id(2)}],capabilities:restricted?[]:[{capability:'printing.test',sector_id:id(2)},{capability:'printing.reprint',sector_id:id(2)}],sectors:[{id:id(2),name:'Room Service'},{id:id(22),name:'Bar'}],destinations:[{id:id(3),name:'Cozinha',sector_id:id(2)},{id:id(23),name:'Impressora Bar',sector_id:id(22)}]},config:{settings:[{enabled:healthy,revision:4,ticket_minutes:15,allow_room:true,allow_notes:true,allow_name:false,fan_out:false,activation_id:healthy?id(40):null,activated_at:healthy?now:null}],devices:[{id:id(1),name:'Computador da recepção',active:true,revoked_at:null,revision:3,software_version:'1.1.0-lab-',protocol_version:1,last_seen_at:now,observed_state:'online'}],printers:[{id:id(4),name:'Impressora da cozinha',active:true,device_id:id(1),destination_id:id(3),adapter:'windows_spooler',config:{queue_name:'Cozinha - demonstração',driver:'Driver de demonstração'},priority:0,revision:2,observed_state:scenario==='error'?'error':'ready',observed_at:now},{id:id(24),name:'Impressora do bar',active:true,device_id:id(1),destination_id:id(23),adapter:'windows_spooler',config:{queue_name:'Bar - demonstração',driver:'Driver de demonstração'},priority:0,revision:1,observed_state:'ready',observed_at:now}],destinations:[{id:id(3),name:'Cozinha',active:true,device_id:id(1),backup_device_id:null,priority:0,revision:2,allow_room:true,allow_notes:true,allow_name:false},{id:id(23),name:'Impressora Bar',active:true,device_id:id(1),backup_device_id:null,priority:0,revision:1,allow_room:true,allow_notes:true,allow_name:false}],routes:[{id:id(5),sector_id:id(2),destination_id:id(3),role:'primary',copy_number:1,active:true,revision:2},{id:id(25),sector_id:id(22),destination_id:id(23),role:'primary',copy_number:1,active:true,revision:1}],users:[{id:id(6),name:'Responsável da operação',role:'operador'}],grants:[{id:id(7),user_id:id(6),capability:'printing.reprint',sector_id:id(2),active:true,revision:2}]},health:{backlog:healthy?0:2,ambiguous:scenario==='error'?1:0,oldest_at:healthy?null:now,last_error:scenario==='error'?'Diagnóstico simulado: o recebimento do spooler não foi confirmado.':null},jobs:[]};
const job=(n:number,state:AdminPrintJob['state']):AdminPrintJob=>({job_id:id(n),order_id:id(n+100),group_id:id(n+200),source_event_id:id(n+300),sector_id:id(2),sector_name:'Room Service',destination_id:id(3),destination_name:'Cozinha',bridge_name:'Computador da recepção',kind:'order',state,code:null,revision:3,fence:7,copy_number:1,original_job_id:null,duplicate_risk:state==='ambiguous',created_at:now,expires_at:now,lease_until:null,receipt_at:now,dispatch_at:now,protocol_version:1,payload_version:1,renderer_version:1,snapshot_hash:'fixture-only',can_reprint:!restricted&&state==='ambiguous'});
snapshot.jobs=params.has('matrix')?PRINT_STATES.map((state,index)=>job(50+index,state)):healthy?[]:[job(10,scenario==='error'?'ambiguous':'retry_wait'),job(11,'queued')];
if(restricted)snapshot.config={};
const commissioning:Commissioning={checks:[{code:'computer',status:'PASS',detail:'Computador conectado.'},{code:'physical_test',status:healthy?'PASS':'BLOCKER',detail:healthy?'Teste de demonstração verificado.':'Faça um teste autorizado e confirme o papel.'}],blockers:healthy?0:1,warnings:0,ready:healthy,mode:healthy?'ordering':'catalog_only',order_revision:4,override:null,tests:[],queues:[{device_id:id(1),queue_key:'a'.repeat(64),queue_name:'Cozinha - demonstração',driver_name:'Driver de demonstração',observation:'ready',present:true,revision:1,observed_at:now}],human_verifications:healthy?[{job_id:id(30),printer_id:id(4),printer_revision:2,verified_at:now,verified_by:id(6)}]:[]};
if(params.has('check'))commissioning.checks[1]={...commissioning.checks[1],code:params.get('check')!};
window.printingFixtureCommands=[];
const original=window.fetch.bind(window);
window.fetch=async(input,options)=>{
 const url=new URL(String(input),location.href);
 if(url.pathname.startsWith('/api/admin/fb-printing/')){
  if(options?.method==='POST'){window.printingFixtureCommands.push(JSON.parse(String(options.body)));return Response.json({error:'forbidden'},{status:403});}
  if(scenario==='unavailable')return Response.json({error:'unavailable'},{status:503});
  if(params.has('slow'))await new Promise(r=>setTimeout(r,500));
  if(url.pathname.endsWith('/commissioning'))return Response.json(commissioning);
  if(url.searchParams.has('job_id'))return Response.json({job:snapshot.jobs.find(j=>j.job_id===url.searchParams.get('job_id')),attempts:[],events:[]});
  const result:PrintConsole={...snapshot,jobs:snapshot.jobs.filter(j=>(!url.searchParams.get('state')||j.state===url.searchParams.get('state'))&&(!url.searchParams.get('sector')||j.sector_id===url.searchParams.get('sector'))&&(!url.searchParams.get('destination')||j.destination_id===url.searchParams.get('destination'))&&(!url.searchParams.get('kind')||j.kind===url.searchParams.get('kind')))};
  if(params.has('pages')){const second=url.searchParams.has('after_created');result.next=second?null:{created_at:now,id:id(10)};result.jobs=result.jobs.slice(second?1:0,second?2:1);}
  return Response.json(result);
 }
 return original(input,options);
};
const theme=resolveAdminTheme('bugan','bugan'),role=restricted?'operador':'administrador';
const links=fbWorkspaceLinks({editorial:true,orders:true,printing:true});
const groups=getAdminNavigationForRole(role,undefined,{orders:true,printing:true});
createRoot(document.getElementById('root')!).render(<AdminShell adminTheme={theme} hotelName="Bugan Recife" hotelCity="Recife · Demonstração local" hotelLogoUrl={null} navGroups={groups} userName="Operação de demonstração" userRole={role} signOut={async()=>{}}>
 <main className="fb-workspace fb-print-page"><AdminBreadcrumbs items={[{label:'Gastronomia',href:'/admin/cardapio'},{label:'Impressão'}]}/><FbWorkspaceHeader links={links} active="printing" title="Impressão" description="Acompanhe a operação e configure a impressão por setor."/>
 <p className="fb-print-fixture-note" data-fixture-note title="Dados simulados. Nenhuma impressão é enviada.">Ambiente de teste</p><FbPrintingConsole initial={snapshot}/></main>
</AdminShell>);
