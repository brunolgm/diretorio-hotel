/** Explicit catalogue snapshot. No fuzzy match, network lookup or codeshare search. */
export type AirlineContext = {departureCountryCode?:string|null;departureDate:string;departureAirport:string;arrivalAirport:string};
export type AirlineIdentity = {code:string;icaoCode:string;name:string;shortName:string;aliases:readonly string[];officialUrl:string;supportsFlightNumberInUrl:false};
const airline=(code:string,icaoCode:string,name:string,shortName:string,aliases:string[],officialUrl:string):AirlineIdentity=>({code,icaoCode,name,shortName,aliases,officialUrl,supportsFlightNumberInUrl:false});
export const AIRLINE_IDENTITIES:readonly AirlineIdentity[]=Object.freeze([
 airline('AD','AZU','Azul Linhas Aéreas','Azul',['AZUL','AZUL LINHAS AEREAS'],'https://apps.voeazul.com.br/FlightStatus/aspx/Main.aspx'),
 airline('LA','TAM','LATAM Airlines Brasil','LATAM',['LATAM','LATAM AIRLINES','LATAM AIRLINES BRASIL'],'https://www.latamairlines.com/br/pt/flight-status'),
 airline('G3','GLO','GOL Linhas Aéreas','GOL',['GOL','GOL LINHAS AEREAS'],'https://b2c.voegol.com.br/status-de-voo/'),
 airline('TP','TAP','TAP Air Portugal','TAP',['TAP AIR PORTUGAL','TAP PORTUGAL'],'https://www.flytap.com/'),
 airline('AA','AAL','American Airlines','American Airlines',['AMERICAN AIRLINES'],'https://www.aa.com/'),
 airline('DL','DAL','Delta Air Lines','Delta',['DELTA','DELTA AIR LINES'],'https://www.delta.com/'),
 airline('UA','UAL','United Airlines','United',['UNITED AIRLINES'],'https://www.united.com/'),
 airline('AF','AFR','Air France','Air France',['AIR FRANCE'],'https://www.airfrance.com/'),
 airline('KL','KLM','KLM Royal Dutch Airlines','KLM',['KLM ROYAL DUTCH AIRLINES'],'https://www.klm.com/'),
 airline('IB','IBE','Iberia','Iberia',['IBERIA'],'https://www.iberia.com/'),
 airline('CM','CMP','Copa Airlines','Copa Airlines',['COPA','COPA AIRLINES'],'https://www.copaair.com/'),
 airline('H2','SKU','SKY Airline Chile','SKY',['SKY AIRLINE CHILE'],'https://www.skyairline.com/'),
 airline('JA','JAT','JetSMART','JetSMART',['JETSMART CHILE','JETSMART AIRLINES SPA'],'https://www.jetsmart.com/'),
 airline('AR','ARG','Aerolíneas Argentinas','Aerolíneas Argentinas',['AEROLINEAS ARGENTINAS'],'https://www.aerolineas.com.ar/'),
]);
export function normalizeAirlineText(value:string|null|undefined){return (value??'').normalize('NFD').replace(/\p{M}/gu,'').trim().replace(/\s+/g,' ').toUpperCase();}
const ambiguous=new Set(['LAT','SKY','SKY AIRLINE']);
function identify(value:string,context?:AirlineContext):{airline:AirlineIdentity|null;code:string|null;issue?:'ambiguous'|'context_required'|'unknown'}{
 if(ambiguous.has(value))return {airline:null,code:null,issue:'ambiguous'};
 // TAM is an operating identity, not a universal IATA alias. Only support the
 // observed current commercial context; never rewrite JJ or old TAM tickets.
 if(value==='JETSMART'){
  // JetSMART's own agency guide documents unified commercial JA since 05/03/2024.
  if(!context||!/^\d{4}-\d{2}-\d{2}$/.test(context.departureDate)||!Number.isFinite(Date.parse(context.departureDate+'T00:00:00Z'))||new Date(context.departureDate+'T00:00:00Z').toISOString().slice(0,10)!==context.departureDate||context.departureDate<'2024-03-05'||! /^[A-Z]{3}$/.test(context.departureAirport)||! /^[A-Z]{3}$/.test(context.arrivalAirport)||context.departureAirport===context.arrivalAirport)return {airline:null,code:null,issue:'context_required'};
  return {airline:AIRLINE_IDENTITIES.find(a=>a.code==='JA')!,code:'JA'};
 }
 if(value==='TAM'){
  if(!context||context.departureCountryCode!=='BR'||!Number.isFinite(Date.parse(context.departureDate+'T00:00:00Z'))||new Date(context.departureDate+'T00:00:00Z').toISOString().slice(0,10)!==context.departureDate||context.departureDate<'2026-10-29'||!/^\d{4}-\d{2}-\d{2}$/.test(context.departureDate)||! /^[A-Z]{3}$/.test(context.departureAirport)||! /^[A-Z]{3}$/.test(context.arrivalAirport)||context.departureAirport===context.arrivalAirport)return {airline:null,code:null,issue:'context_required'};
  return {airline:AIRLINE_IDENTITIES[1],code:'LA'};
 }
 const found=AIRLINE_IDENTITIES.filter(a=>a.code===value||a.icaoCode===value||a.aliases.includes(value));
 if(found.length>1)return {airline:null,code:null,issue:'ambiguous'};
 if(found.length===1)return {airline:found[0],code:found[0].code};
 // Explicit IATA stays explicit, including JJ. Unknown names/ICAO are not guessed.
 return {airline:null,code:/^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2}$/.test(value)?value:null,issue:'unknown'};
}
export type AirlineResolution={kind:'resolved'|'unknown'|'ambiguous'|'context_required'|'conflict'|'invalid';flightIata:string|null;number:string|null;airline:AirlineIdentity|null};
export function resolveFlightAirline(input:string|null,number:string,context?:AirlineContext):AirlineResolution{
 const empty=(kind:AirlineResolution['kind']):AirlineResolution=>({kind,flightIata:null,number:null,airline:null});
 const raw=number.replace(/\s+/g,'').toUpperCase(),name=normalizeAirlineText(input);
 if(name.length>60||/[<>\x00-\x1f]/.test(name)||!raw||raw.length>8)return empty('invalid');
 let digits:string,prefix:string|null=null;
 if(/^\d{1,4}[A-Z]?$/.test(raw))digits=raw;
 else{const split=raw.match(/^([A-Z]{3}|[A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);if(!split)return empty('invalid');prefix=split[1];digits=split[2];}
 const left=name?identify(name,context):null,right=prefix?identify(prefix,context):null;
 if(left?.issue==='ambiguous'||right?.issue==='ambiguous')return empty('ambiguous');
 if(left?.issue==='context_required'||right?.issue==='context_required')return empty('context_required');
 if(left&&right&&(!left.code||!right.code||left.code!==right.code))return empty('conflict');
 const selected=right??left;if(!selected?.code)return empty('unknown');
 return {kind:selected.airline?'resolved':'unknown',flightIata:selected.code+digits,number:digits,airline:selected.airline};
}
export function findAirlineIdentity(input:string|null|undefined){const value=normalizeAirlineText(input);return identify(value).airline;}
