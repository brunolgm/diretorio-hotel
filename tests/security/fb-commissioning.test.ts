import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {commissioningCommand} from '../../lib/fb/printing/commissioning.ts';
import {PrintBoundaryError} from '../../lib/fb/printing/validation.ts';
const command=(operation:string,body:Record<string,unknown>)=>({operation,body,key:randomUUID(),confirmed:true});
test('commissioning requires an explicit human command and stable opaque command key',()=>{
 const valid=command('mode',{mode:'catalog_only',revision:0});assert.doesNotThrow(()=>commissioningCommand(valid));
 for(const patch of [{confirmed:false},{confirmed:null},{key:'reusable-password'},{operation:'sql'},{body:null}])assert.throws(()=>commissioningCommand({...valid,...patch}),PrintBoundaryError);
});
test('catalog mode cannot smuggle activation, tenant authority or credential material',()=>{
 const valid=command('mode',{mode:'ordering',revision:1});assert.doesNotThrow(()=>commissioningCommand(valid));
 for(const field of ['hotel_id','user_id','enabled','credential','digest','sql'])assert.throws(()=>commissioningCommand({...valid,body:{...valid.body,[field]:'untrusted'}}),PrintBoundaryError);
 for(const mode of ['native','external','ALL',null,true])assert.throws(()=>commissioningCommand(command('mode',{mode,revision:1})),PrintBoundaryError);
});
test('queue selection accepts catalog references only, never arbitrary queue, path or connection',()=>{
 const body={printer_id:null,revision:0,name:'Cozinha',device_id:randomUUID(),destination_id:randomUUID(),queue_key:'a'.repeat(64),queue_revision:1};assert.doesNotThrow(()=>commissioningCommand(command('select_queue',body)));
 for(const field of ['queue_name','driver','port','ip','url','raw_command','config'])assert.throws(()=>commissioningCommand(command('select_queue',{...body,[field]:'untrusted'})),PrintBoundaryError);
 for(const value of ['\\\\server\\printer','..','a'.repeat(65),'A'.repeat(64)])assert.throws(()=>commissioningCommand(command('select_queue',{...body,queue_key:value})),PrintBoundaryError);
});
test('commissioning rejects missing fields and fractional, negative or string revisions',()=>{
 for(const revision of [-1,1.1,'1',null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>commissioningCommand(command('mode',{mode:'ordering',revision})),PrintBoundaryError);
 assert.throws(()=>commissioningCommand(command('mode',{mode:'ordering'})),PrintBoundaryError);
 assert.throws(()=>commissioningCommand(command('refresh',{})),PrintBoundaryError);
});
test('technical override has bounded controlled reasons, never free text or permanent expiry',()=>{
 for(const reason of ['supervised_maintenance','urgent_operational_recovery','isolated_contract_validation'])assert.doesNotThrow(()=>commissioningCommand(command('technical_override',{reason,enabled:false,revision:1})));
 for(const reason of ['permanent','Guest name 123',null])assert.throws(()=>commissioningCommand(command('technical_override',{reason,enabled:true,revision:1})),PrintBoundaryError);
 assert.throws(()=>commissioningCommand(command('technical_override',{reason:'supervised_maintenance',enabled:true,revision:1,until:'2099-01-01'})),PrintBoundaryError);
});
test('physical verification references a job and cannot mutate its technical outcome',()=>{
 const body={job_id:randomUUID()};assert.doesNotThrow(()=>commissioningCommand(command('verify_test',body)));
 for(const field of ['state','result','confirmed','printed','printer_id','verified_by'])assert.throws(()=>commissioningCommand(command('verify_test',{...body,[field]:'untrusted'})),PrintBoundaryError);
});
