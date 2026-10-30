import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type FlightAirportContext={timezone:string|null;countryCode:string|null};
// Codes must already come from the authorized public hotel airport RPC.
// Country is geography for alias eligibility, never identity or provider input.
export async function getFlightAirportContexts(authorizedCodes:string[]):Promise<Record<string,FlightAirportContext>>{
 const codes=[...new Set(authorizedCodes)].filter(code=>/^[A-Z]{3}$/.test(code));
 if(!codes.length)return {};
 try{
  const {data,error}=await createAdminClient().from('airports').select('iata_code,timezone,country_code').in('iata_code',codes).eq('is_active',true);
  if(error)return {};
  return Object.fromEntries((data??[]).map(row=>{
   let timezone:string|null=null;
   try{new Intl.DateTimeFormat('en',{timeZone:row.timezone});timezone=row.timezone;}catch{}
   return [row.iata_code,{timezone,countryCode:/^[A-Z]{2}$/.test(row.country_code??'')?row.country_code:null}];
  }));
 }catch{return {};}
}
// Preserve the existing timezone-only helper contract for other server callers.
export async function getFlightAirportTimezones(authorizedCodes:string[]):Promise<Record<string,string>>{
 const contexts=await getFlightAirportContexts(authorizedCodes);
 return Object.fromEntries(Object.entries(contexts).flatMap(([code,context])=>context.timezone?[[code,context.timezone]]:[]));
}
