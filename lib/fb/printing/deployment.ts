import type {PrintConsole} from './admin.ts';
import type {Commissioning} from './commissioning.ts';

export const deploymentTitles=['Preparar hotel','Conectar computador','Selecionar impressora','Configurar destino e rota','Testar impressão','Concluir implantação'];
export interface CommandResult{ok:boolean;data?:Record<string,unknown>;uncertain?:boolean;error?:string}
export type PrintingExecute=(channel:'console'|'commissioning',operation:string,body:Record<string,unknown>,key?:string)=>Promise<CommandResult>;

/** Evidence is always bound to a selected configuration, never an arbitrary hotel-wide count. */
export function deploymentContext(snapshot:PrintConsole,data:Commissioning|null,printerId:string,selection?:{sector:string;role:string;copy:number}){
 const printer=snapshot.config.printers?.find(p=>p.id===printerId&&p.active);
 const destination=snapshot.config.destinations?.find(d=>d.id===printer?.destination_id&&d.active);
 const device=snapshot.config.devices?.find(d=>d.id===printer?.device_id&&d.active&&!d.revoked_at);
 const route=snapshot.config.routes?.find(r=>r.destination_id===destination?.id&&r.active&&(selection?r.sector_id===selection.sector&&r.role===selection.role&&r.copy_number===selection.copy:r.role==='primary'));
 const queue=data?.queues.find(q=>q.device_id===device?.id&&q.queue_name===printer?.config.queue_name);
 const tests=(data?.tests??[]).filter(t=>t.printer_id===printer?.id&&t.printer_revision===printer?.revision).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.job_id.localeCompare(a.job_id));
 const test=tests[0];
 const historical=(data?.human_verifications??[]).filter(v=>v.printer_id===printer?.id&&v.printer_revision===printer?.revision);
 const paper=!!test&&test.state==='submitted'&&historical.some(v=>v.job_id===test.job_id);
 const now=Date.parse(data?.server_time??snapshot.server_time);
 const online=!!device?.last_seen_at&&now-Date.parse(device.last_seen_at)<90000&&device.protocol_version===1&&/^(c2-|c2-lab-|fixture-)1\.([3-9]|[1-9][0-9]+)\./.test(device.software_version??'');
 const queueReady=!!queue&&!!queue.fingerprint&&queue.present&&queue.fingerprint===printer?.queue_fingerprint&&queue.observation==='unknown'&&now-Date.parse(queue.observed_at)<180000;
 const settings=snapshot.config.settings?.[0];
 const ready=!!printer&&!!destination&&destination.device_id===device?.id&&!!route&&!!data?.sectors?.some(s=>s.id===route.sector_id&&s.active)&&online&&queueReady&&paper&&!!settings?.enabled;
 const reviewBody={printer_id:printer?.id,printer_revision:printer?.revision,job_id:test?.job_id,route_id:route?.id,route_revision:route?.revision,settings_revision:settings?.revision,device_revision:device?.revision,destination_revision:destination?.revision};
 const completed=ready&&data?.completed_reviews?.some(r=>Object.entries(reviewBody).every(([k,v])=>r[k as keyof typeof r]===v));
 return {printer,destination,device,route,queue,test,tests,historical,paper,online,queueReady,settings,ready,reviewBody,completed:!!completed};
}

export function guestReadiness(data:Commissioning|null){
 const g=data?.guest_readiness;
 if(!g)return {configured:false,channel:false,pending:['Diagnóstico da jornada indisponível.']};
 const pending:string[]=[];
 if(!g.ordering)pending.push('Pedidos do hotel desabilitados.');
 if(!g.modules)pending.push('Módulos de catálogo/diretório indisponíveis.');
 if(!g.outlets.length)pending.push('Nenhum estabelecimento nativo configurado.');
 for(const o of g.outlets){
  if(!o.published||!o.accepting)pending.push(o.name+': publicação ou atendimento pendente.');
  if(!o.pickup&&!o.room_delivery)pending.push(o.name+': modalidade pendente.');
  if(!o.open_now)pending.push(o.name+': fechado no calendário atual.');
  if(!o.products_available)pending.push(o.name+': produtos elegíveis indisponíveis.');
  if(o.room_delivery&&!o.pickup&&!o.room_access)pending.push(o.name+': entrega exclusiva no apartamento sem QR ativo; revise rooms.qr e links de apartamento.');
 }
 return {configured:!!g.ordering&&g.modules&&g.outlets.length>0,channel:pending.length===0,pending};
}

export interface SaveProgress{destination?:{id:string;revision:number};printer?:{id:string;revision:number};route?:{id:string;revision:number}}
export interface DeploymentDraft{version:1;step:number;device:string;printer:string;sector:string;destination:string;queue:string;name:string;backup:string;priority:number;copies:number;role:string;packageReady:boolean;progress:SaveProgress;pending?:{channel:'console'|'commissioning';operation:string;body:Record<string,unknown>;key:string};testJob?:string}
export const emptyDraft=():DeploymentDraft=>({version:1,step:1,device:'',printer:'',sector:'',destination:'new',queue:'',name:'',backup:'',priority:0,copies:1,role:'primary',packageReady:false,progress:{}});
export function readDeploymentDraft(raw:string|null):DeploymentDraft|null{
 try{if(raw&&raw.length>16384)return null;const d=JSON.parse(raw??'null');if(!d||d.version!==1||!Number.isInteger(d.step)||d.step<1||d.step>6)return null;
  if(Object.keys(d).some(k=>!['version','step','device','printer','sector','destination','queue','name','backup','priority','copies','role','packageReady','progress','pending','testJob'].includes(k)))return null;
  if(['device','printer','sector','destination','queue','name','backup','role'].some(k=>typeof d[k]!=='string')||!d.progress||typeof d.progress!=='object')return null;
  if(!Number.isInteger(d.priority)||d.priority<0||d.priority>1000||!Number.isInteger(d.copies)||d.copies<1||d.copies>5||!['primary','backup'].includes(d.role)||typeof d.packageReady!=='boolean'||d.name.length>120)return null;
  if(Object.entries(d.progress).some(([k,v])=>!['destination','printer','route'].includes(k)||!v||typeof (v as {id?:unknown}).id!=='string'||!Number.isSafeInteger((v as {revision?:unknown}).revision)))return null;
  if(d.pending&&(!['console','commissioning'].includes(d.pending.channel)||typeof d.pending.operation!=='string'||!d.pending.body||typeof d.pending.key!=='string'))return null;
  return d;
 }catch{return null;}
}
