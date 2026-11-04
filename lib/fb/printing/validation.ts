import {uuid} from '../validation.ts';
import {DEVICE_OPERATIONS,PRINT_RESULT_CODES,type DeviceOperation} from './contracts.ts';
export class PrintBoundaryError extends Error{readonly status:number;readonly code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code;}}
const invalid=()=>{throw new PrintBoundaryError(400,'invalid_input');};
export function printId(v:unknown):asserts v is string{if(typeof v!=='string'||!uuid(v))invalid();}
export function positive(v:unknown):asserts v is number{if(!Number.isSafeInteger(v)||(v as number)<1)invalid();}
export function objectWithKeys(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))invalid();}
export function validateDeviceBody(operation:string,value:unknown):{operation:DeviceOperation;body:Record<string,unknown>}{
 if(!(DEVICE_OPERATIONS as readonly string[]).includes(operation))throw new PrintBoundaryError(404,'invalid_operation');
 const common=['protocol_version'];const job=['job_id','fence','revision'];
 const keys:Record<DeviceOperation,string[]>={exchange:[...common,'pairing_token','device_id','software_version'],heartbeat:[...common,'software_version','observed_state'],claim:[...common,'key'],receipt:[...common,...job,'snapshot_hash'],dispatch:[...common,...job,'snapshot_hash'],result:[...common,...job,'key','result','code','no_io']};
 const op=operation as DeviceOperation;objectWithKeys(value,keys[op]);positive(value.protocol_version);
 if(op==='exchange'){printId(value.device_id);if(typeof value.pairing_token!=='string')invalid();}
 if(op==='exchange'||op==='heartbeat'){if(typeof value.software_version!=='string'||!/^[0-9A-Za-z.+_-]{1,40}$/.test(value.software_version))invalid();}
 if(op==='heartbeat'&&value.observed_state!==undefined&&!['online','unknown','degraded'].includes(String(value.observed_state)))invalid();
 if(['receipt','dispatch','result'].includes(op)){printId(value.job_id);positive(value.fence);positive(value.revision);}
 if(op==='claim'||op==='result')printId(value.key);
 if(op==='receipt'||op==='dispatch'){if(typeof value.snapshot_hash!=='string'||!/^[0-9a-f]{64}$/.test(value.snapshot_hash))invalid();}
 if(op==='result'){if(!['submitted','pre_send_failed','ambiguous'].includes(String(value.result))||!(PRINT_RESULT_CODES as readonly unknown[]).includes(value.code)||typeof value.no_io!=='boolean')invalid();}
 return {operation:op,body:value};
}
