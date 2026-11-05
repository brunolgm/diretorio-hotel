import {objectWithKeys,printId,PrintBoundaryError} from './validation.ts';
export interface DiscoveredQueue{device_id:string;queue_key:string;queue_name:string;driver_name:string;observation:string;present:boolean;revision:number;observed_at:string}
export interface Commissioning{checks:{code:string;status:'PASS'|'WARNING'|'BLOCKER';detail:string;sector?:string}[];blockers:number;warnings:number;ready:boolean;mode:'catalog_only'|'ordering';order_revision:number;override:{until:string|null;reason:string|null}|null;tests:{job_id:string;destination_id:string;created_at:string}[];queues:DiscoveredQueue[];human_verifications:{job_id:string;printer_id:string;printer_revision:number;verified_at:string;verified_by:string}[]}
const fields:Record<string,string[]>={refresh:['device_id'],select_queue:['printer_id','revision','name','device_id','destination_id','queue_key','queue_revision'],verify_test:['job_id'],mode:['mode','revision'],technical_override:['reason','enabled','revision']};
export function commissioningCommand(input:unknown){
 objectWithKeys(input,['operation','body','key','confirmed']);if(typeof input.operation!=='string'||!fields[input.operation]||input.confirmed!==true)throw new PrintBoundaryError(400,'confirmation_required');printId(input.key);objectWithKeys(input.body,fields[input.operation]);const b=input.body;
 if(fields[input.operation].some(k=>!Object.hasOwn(b,k)))throw new PrintBoundaryError(400,'invalid_input');
 for(const k of ['device_id','destination_id','job_id'])if(k in b)printId(b[k]);if('printer_id'in b&&b.printer_id!==null)printId(b.printer_id);
 for(const k of ['revision','queue_revision'])if(k in b&&(!Number.isSafeInteger(b[k])||Number(b[k])<0))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='select_queue'&&(typeof b.name!=='string'||b.name.length<1||b.name.length>120||typeof b.queue_key!=='string'||!/^[a-f0-9]{64}$/.test(b.queue_key)))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='mode'&&!['catalog_only','ordering'].includes(String(b.mode)))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='technical_override'&&(typeof b.enabled!=='boolean'||!['isolated_contract_validation','supervised_maintenance','urgent_operational_recovery'].includes(String(b.reason))))throw new PrintBoundaryError(400,'invalid_input');
 return {operation:input.operation,body:b,key:input.key};
}
