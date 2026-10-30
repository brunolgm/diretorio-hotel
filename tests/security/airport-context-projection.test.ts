import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const events:unknown[]=[];
let rows:Record<string,unknown>[]=[],failure=false;
const client={from(table:string){events.push(table);return {select(fields:string){events.push(fields);return {in(field:string,codes:string[]){events.push([field,codes]);return {async eq(field:string,value:boolean){events.push([field,value]);return {data:rows,error:failure?{message:'synthetic'}:null};}};}};}};}};
Object.assign(globalThis,{__flightAirportProjectionClient:client});
const hooks=registerHooks({resolve(spec,ctx,next){
 if(spec==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(spec==='@/lib/supabase/admin')return {url:'data:text/javascript,export const createAdminClient=()=>globalThis.__flightAirportProjectionClient',shortCircuit:true};
 return next(spec,ctx);
}});
const {getFlightAirportContexts,getFlightAirportTimezones}=await import('../../lib/flights/airport-timezones.server.ts');hooks.deregister();
test('projects only canonical active airport geography for already authorized bounded codes',async()=>{
 rows=[{iata_code:'REC',timezone:'America/Recife',country_code:'BR',private:'never_project'},{iata_code:'XXX',timezone:'invalid/zone',country_code:'?',private:'never_project'}];
 const result=await getFlightAirportContexts(['REC','REC','bad','XXX','REC,BSB']);
 assert.deepEqual(events,['airports','iata_code,timezone,country_code',['iata_code',['REC','XXX']],['is_active',true]]);
 assert.deepEqual(result,{REC:{timezone:'America/Recife',countryCode:'BR'},XXX:{timezone:null,countryCode:null}});
 assert.ok(!JSON.stringify(result).includes('never_project'));
 assert.deepEqual(await getFlightAirportTimezones(['REC','XXX']),{REC:'America/Recife'});
});
test('missing geography is never guessed and errors do not enlarge the read scope',async()=>{
 events.length=0;assert.deepEqual(await getFlightAirportContexts(['REC,BSB','<REC>']),{});assert.equal(events.length,0);
 rows=[{iata_code:'REC',timezone:'America/Recife',country_code:null}];
 assert.deepEqual(await getFlightAirportContexts(['REC']),{REC:{timezone:'America/Recife',countryCode:null}});
 failure=true;assert.deepEqual(await getFlightAirportContexts(['REC']),{});
});
