import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AIRLINE_IDENTITIES,resolveFlightAirline} from '../../lib/airline-identity.ts';
import {createSavedGuestFlight,parseSavedGuestFlight} from '../../lib/guest-flight-storage.ts';
import {guestStatusQuery,parseFlightDisplay} from '../../lib/guest-flight-status.ts';
const context={departureCountryCode:'BR',departureDate:'2026-10-29',departureAirport:'REC',arrivalAirport:'BSB'};

test('LATAM current references resolve one candidate, keeping route/date for provider occurrence matching',()=>{
 for(const company of ['TAM','LA','LATAM','LATAM Airlines','LATAM Airlines Brasil','  latam   airlines  ']){
  const result=resolveFlightAirline(company,'3565',context);assert.equal(result.flightIata,'LA3565');assert.equal(result.airline?.name,'LATAM Airlines Brasil');
 }
 for(const code of ['TAM3565','LA3565'])assert.equal(resolveFlightAirline(null,code,context).flightIata,'LA3565');
});
test('historical TAM and JJ, ambiguous LAT, codeshare conflicts and incomplete context are never guessed',()=>{
 assert.equal(resolveFlightAirline('TAM','3565',{...context,departureDate:'2017-05-01'}).flightIata,null);
 assert.equal(resolveFlightAirline('TAM','3565',{...context,departureDate:'2026-02-30'}).flightIata,null);
 assert.equal(resolveFlightAirline('TAM','3565').kind,'context_required');
 assert.equal(resolveFlightAirline('TAM','3565',{...context,departureCountryCode:'CL'}).flightIata,null);
 assert.equal(resolveFlightAirline('TAM','3565',{...context,departureCountryCode:null}).flightIata,null);
 assert.equal(resolveFlightAirline('TAM','3565',{...context,arrivalAirport:'REC'}).flightIata,null);
 assert.equal(resolveFlightAirline('JJ','3565',context).flightIata,'JJ3565');
 assert.equal(resolveFlightAirline('TAM','JJ3565',context).kind,'conflict');
 for(const name of ['LAT','SKY','SKY Airline'])assert.equal(resolveFlightAirline(name,'3565',context).kind,'ambiguous');
 for(const [name,number]of [['Delta','LA3565'],['GOL','AD4277'],['LATAM','AD4277']])assert.equal(resolveFlightAirline(name,number,context).kind,'conflict');
 assert.equal(resolveFlightAirline('Delta','DL3565',context).flightIata,'DL3565','never substitute a codeshare operator');
});
test('Azul and GOL accept exact names, codes and full references without losing zeros',()=>{
 for(const name of ['AZU','AD','Azul','Azul Linhas Aéreas'])assert.equal(resolveFlightAirline(name,'0427',context).flightIata,'AD0427');
 for(const number of ['AZU4277','AD4277'])assert.equal(resolveFlightAirline(null,number,context).flightIata,'AD4277');
 for(const name of ['GLO','G3','GOL','GOL Linhas Aéreas'])assert.equal(resolveFlightAirline(name,'0188',context).flightIata,'G30188');
});
test('every registered alias is deterministic and its official URL is static HTTPS',()=>{
 for(const entry of AIRLINE_IDENTITIES){
  for(const alias of [entry.code,entry.icaoCode,entry.name,...entry.aliases])assert.equal(resolveFlightAirline(alias,'0101',context).flightIata,entry.code+'0101',alias);
  const url=new URL(entry.officialUrl);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.search,'');
 }
});
test('unknown values, duplicated prefixes and injection do not yield guessed references',()=>{
 for(const [company,number]of [['',''],['','3565'],['XYZ','3565'],['Unknown Airways','3565'],['LA','LALA3565'],['TAM','TAMTAM3565'],['<LA>','3565'],['LA','3565&key=x']])assert.equal(resolveFlightAirline(company,number,context).flightIata,null);
 assert.equal(resolveFlightAirline(null,'XX123',context).flightIata,'XX123','explicit unknown IATA remains explicit');
});
test('v1 keeps original manual name/code and full number, deriving only a private query reference',()=>{
 for(const [airline,flightNumber]of [['LATAM Airlines','3565'],['TAM','TAM3565'],['Azul Linhas Aéreas','0427']]){
  const saved=createSavedGuestFlight('50200000-0000-4000-8000-000000000001',{airline,flightNumber,...context,scheduledDepartureTime:'20:50'},new Date('2026-10-29T20:00:00Z'));
  assert.ok(saved.ok);const original=JSON.stringify(saved.flight);assert.deepEqual(parseSavedGuestFlight(original,saved.flight.hotelId),saved.flight);
  assert.ok(guestStatusQuery(saved.flight,'hotel','America/Recife','BR'));assert.equal(JSON.stringify(saved.flight),original);assert.equal(saved.flight.flightNumber,flightNumber);
 }
});
test('real captured replay preserves estimated/actual separately and does not call fetched time a source update',()=>{
 const capture=JSON.parse(readFileSync('tests/security/fixtures/airlabs-restored-ad4277.json','utf8'));
 const query={flight_iata:'AD4277',departureDate:'2026-10-29',departureAirport:'REC',arrivalAirport:'CGH'};
 const d=parseFlightDisplay(capture.response,query)!;
 assert.equal(d.status,'inFlight');assert.equal(d.estimated?.slice(11,16),'17:20');assert.equal(d.actual?.slice(11,16),'17:20');
 assert.equal(d.sourceUpdatedAt,'2026-10-29T23:16:55.000Z');assert.equal(d.consultedAt,'2026-10-29T23:17:09.549Z');
 const schedule=structuredClone(capture.response);schedule.data.provenance.live='not_requested';schedule.data.liveStatus=null;schedule.data.updatedAt.live=null;schedule.data.updatedAt.schedule=null;
 const s=parseFlightDisplay(schedule,query)!;assert.equal(s.sourceUpdatedAt,null);assert.equal(s.status,'active');assert.equal(s.consultedAt,d.consultedAt);
});

test('JetSMART commercial unification is dated and never rewrites explicit historical WJ',()=>{
 assert.equal(resolveFlightAirline('JetSMART','1234',context).flightIata,'JA1234');
 assert.equal(resolveFlightAirline('JetSMART','1234',{...context,departureDate:'2023-03-01'}).kind,'context_required');
 assert.equal(resolveFlightAirline('WJ','1234',context).flightIata,'WJ1234');
 assert.equal(resolveFlightAirline('JetSMART','WJ1234',context).kind,'conflict');
 assert.equal(resolveFlightAirline('SKY Airline Chile','0123',context).flightIata,'H20123');
});
