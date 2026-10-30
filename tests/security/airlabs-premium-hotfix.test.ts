import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSchedule} from '../../lib/flights/flight-status.ts';
const {cacheProjection}=await import('../../lib/flights/airlabs-coordinator.server.ts');
import {parseFlightDisplay,guestStatusQuery} from '../../lib/guest-flight-status.ts';
import {createSavedGuestFlight} from '../../lib/guest-flight-storage.ts';
const fixture=JSON.parse(readFileSync('tests/fixtures/flights/ad2891-retained-cache-20261030.json','utf8'));
test('AD2891 retained cache supports schedule only, never the manually supplied Aena boarding/gate state',()=>{
 const {updatedAt,fetchedAt,...fields}=fixture.schedule.projection;
 const result=parseFlightDisplay({ok:true,data:{...fields,liveStatus:null,liveSourceType:null,updatedAt:{schedule:updatedAt,live:null},provenance:{provider:'airlabs',schedule:'matched',live:fixture.live.error,fetchedAt}}},fixture.query);
 assert.ok(result);assert.equal(result.scheduled,'2026-10-30T13:00:00');assert.equal(result.status,'scheduled');assert.equal(result.live,false);assert.equal(result.terminal,null);assert.equal(result.gate,null);assert.equal(result.sourceUpdatedAt,null);assert.equal(fixture.live.error,'not_found');
 assert.ok(Date.parse(fixture.schedule.fresh_until)<Date.parse('2026-10-30T15:54:00Z'),'historical response is not a current live status');
});
test('valid synthetic terminal/gate survive normalization, cache projection and UI projection; active schedules never imply airborne',()=>{
 for(const status of ['scheduled','active']){
 const row={flight_iata:'AD2891',dep_iata:'REC',arr_iata:'VCP',dep_time:'2026-10-30 13:00',dep_time_utc:'2026-10-30 16:00',status,dep_terminal:'SYN',dep_gate:'99'};
 const n=normalizeSchedule([row],fixture.query,new Date('2026-10-30T15:17:00Z'));assert.ok(n.ok);if(!n.ok)return;
 const cache=cacheProjection(n.data,'schedule');assert.equal((cache as {departureGate:string}).departureGate,'99');
 const d=parseFlightDisplay({ok:true,data:n.data},fixture.query);assert.equal(d?.terminal,'SYN');assert.equal(d?.gate,'99');assert.notEqual(d?.status,'inFlight');
 }
});
test('AZU2891 is queried as AD2891 with Recife offset while the manual v1 reference is preserved',()=>{
 const saved=createSavedGuestFlight('5eb7d695-ccf7-4594-b9df-fc46aaa25695',{airline:'AZU',flightNumber:'2891',departureAirport:'REC',arrivalAirport:'VCP',departureDate:'2026-10-30',scheduledDepartureTime:'13:00'},new Date('2026-10-30T12:00:00Z'));assert.ok(saved.ok);if(!saved.ok)return;const before=JSON.stringify(saved.flight);const query=guestStatusQuery(saved.flight,'bugan-recife','America/Recife','BR');assert.equal(query?.flight_iata,'AD2891');assert.equal(query?.scheduledDepartureAt,'2026-10-30T13:00:00-03:00');assert.equal(query?.includeLive,true);assert.equal(JSON.stringify(saved.flight),before);
});

import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {getPublicFlightCenterCopy,getPremiumFlightCopy} from '../../lib/public-flight-center-copy.ts';
const require=createRequire(import.meta.url);
test('premium location presentation never manufactures terminal/gate and renders only provided fields in PT/EN/ES',()=>{
 const ts=require('typescript'),mod={exports:{} as {FlightVerifiedSummary:unknown}};
 const source=readFileSync('components/public/flight-verified-summary.tsx','utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:mod.exports,module:mod,require:(s:string)=>s==='@/lib/public-flight-center-copy'?{getPublicFlightCenterCopy,getPremiumFlightCopy}:require(s),Intl,Date});
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 for(const language of ['pt','en','es'])for(const [terminal,gate]of [[null,null],['SYN',null],[null,'99'],['SYN','99']]){
 const data={status:'scheduled',scheduled:'2026-10-30T13:00:00',updated:null,updatedKind:null,terminal,gate,live:false,updatedAt:'2026-10-30T15:17:00Z'};
 const html=renderToStaticMarkup(React.createElement(mod.exports.FlightVerifiedSummary,{data,language,timezone:'America/Recife',stale:false}));
 assert.equal(html.includes('flight-location-facts'),Boolean(terminal||gate));assert.equal(html.includes('flight-location-pending'),!terminal&&!gate);assert.equal(html.includes('—'),false);if(terminal)assert.ok(html.includes('SYN'));if(gate)assert.ok(html.includes('99'));
 }
});
