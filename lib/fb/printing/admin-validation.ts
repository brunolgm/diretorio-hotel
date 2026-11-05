import {objectWithKeys,printId,positive,PrintBoundaryError} from './validation.ts';
export function consoleArguments(query:URLSearchParams){
 if(new Set(query.keys()).size!==query.size)throw new PrintBoundaryError(400,'invalid_input');
 if([...query.keys()].some(k=>!['limit','after_created','after_id','state','sector','kind','destination'].includes(k)))throw new PrintBoundaryError(400,'invalid_input');
 const limit=Number(query.get('limit')??25);positive(limit);if(limit>50)throw new PrintBoundaryError(400,'invalid_input');
 const after=query.get('after_created'),id=query.get('after_id');if((after===null)!==(id===null)||after&&(after.length>64||!Number.isFinite(Date.parse(after))))throw new PrintBoundaryError(400,'invalid_input');if(id)printId(id);
 const sector=query.get('sector'),destination=query.get('destination');if(sector)printId(sector);if(destination)printId(destination);
 return {p_limit:limit,p_after_created:after,p_after_id:id,p_state:query.get('state')||null,p_sector:sector||null,p_kind:query.get('kind')||null,p_destination:destination||null};
}
const fields:Record<string,string[]>={config:['kind','id','revision','values'],activate:['enabled','revision'],pairing:['device_id','revision'],rotate:['device_id','revision'],revoke:['device_id','revision'],grant:['user_id','capability','sector_id','active','revision'],reconcile:['batch'],test:['destination_id','sector_id'],reprint:['destination_id','original_job_id','reason','revision']};
export function validateConsoleCommand(input:unknown){
 objectWithKeys(input,['operation','body','key','confirmed']);if(typeof input.operation!=='string'||!Object.hasOwn(fields,input.operation)||input.confirmed!==true)throw new PrintBoundaryError(400,'confirmation_required');printId(input.key);objectWithKeys(input.body,fields[input.operation]);const b=input.body;
 for(const field of fields[input.operation])if(!Object.hasOwn(b,field))throw new PrintBoundaryError(400,'invalid_input');
 for(const field of ['device_id','destination_id','original_job_id','user_id'])if(field in b)printId(b[field]);if('sector_id'in b&&b.sector_id!==null)printId(b.sector_id);if('id'in b&&b.id!==null)printId(b.id);
 if('revision'in b&&(!Number.isSafeInteger(b.revision)||(b.revision as number)<0))throw new PrintBoundaryError(400,'invalid_input');
 for(const field of ['enabled','active'])if(field in b&&typeof b[field]!=='boolean')throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='config'&&(!['settings','device','destination','printer','route'].includes(String(b.kind))||!b.values||typeof b.values!=='object'||Array.isArray(b.values)))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='grant'&&!['printing.configure','printing.test','printing.reprint'].includes(String(b.capability)))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='reprint'&&!['paper_damage','unreadable','operational','ambiguous_review'].includes(String(b.reason)))throw new PrintBoundaryError(400,'invalid_input');
 if(input.operation==='reconcile'){positive(b.batch);if(b.batch>100)throw new PrintBoundaryError(400,'invalid_input');}
 return {operation:input.operation,body:b,key:input.key};
}
