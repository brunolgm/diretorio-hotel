import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AIRLINE_IDENTITIES,getAirlineLogo,resolveFlightAirline} from '../../lib/airline-identity.ts';
const context={departureCountryCode:'BR',departureDate:'2026-10-29',departureAirport:'REC',arrivalAirport:'CGH'};
for(const [aliases,path]of [[['LA','LATAM','TAM'],'latam.png'],[['AD','AZU','Azul'],'azul.svg'],[['G3','GLO','GOL'],'gol.svg']] as const){
 test(aliases[0]+' visual asset follows canonical identity without rewriting the occurrence',()=>{
  for(const alias of aliases){const resolved=resolveFlightAirline(alias,'0427',context);const before=JSON.stringify(resolved);assert.equal(getAirlineLogo(resolved.airline)?.src,'/brand/airlines/'+path);assert.equal(JSON.stringify(resolved),before);assert.equal(resolved.number,'0427');}
 });
}
test('known without asset, unknown, ambiguous, historical and conflicting references use fallback',()=>{
 for(const [name,number]of [['TP','123'],['XX','123'],['LAT','123'],['JJ','123'],['GOL','AD4277']])assert.equal(getAirlineLogo(resolveFlightAirline(name,number,context).airline),null);
 assert.equal(getAirlineLogo(resolveFlightAirline('TAM','123',{...context,departureCountryCode:'CL'}).airline),null);
});
test('only three local passive assets, fixed dimensions, no arbitrary external URL or path',()=>{
 const entries=AIRLINE_IDENTITIES.filter(a=>getAirlineLogo(a));assert.equal(entries.length,3);
 for(const entry of entries){const logo=getAirlineLogo(entry)!;assert.match(logo.src,/^\/brand\/airlines\/(latam\.png|azul\.svg|gol\.svg)$/);assert.ok(logo.width>0&&logo.height>0);const file=readFileSync('public'+logo.src);assert.ok(file.length<5000);
  if(logo.src.endsWith('.svg')){const svg=file.toString();assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<(?:script|foreignObject|image|use|style)\b|\bon[a-z]+=|(?:href|url)\s*[=(]/i);}
  else assert.equal(file.subarray(1,4).toString(),'PNG');
 }
 const forged={...AIRLINE_IDENTITIES[0],logo:{src:'https://evil.invalid/key',width:1,height:1}};assert.equal(getAirlineLogo(forged)?.src,'/brand/airlines/azul.svg');
 assert.equal(getAirlineLogo({...forged,code:'../../secret'}),null);
});
