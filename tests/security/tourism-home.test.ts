import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { publicTourismHomeAvailable } from '../../lib/tourism/public.ts';
import { MODULE_CATALOG, BASELINE_MODULE_KEYS } from '../../lib/modules/catalog.ts';

for (const [enabled, published, expected] of [[false,false,false],[false,true,false],[true,false,false],[true,true,true]]) test(`Home gate: entitled=${enabled}, published=${published}`,async()=>{
  const filters:unknown[]=[];let queried=false;
  const query={select:(fields:string)=>{assert.equal(fields,'id');return query;},eq:(k:string,v:unknown)=>{filters.push([k,v]);return query;},limit:(n:number)=>{assert.equal(n,1);return query;},then:(resolve:(v:unknown)=>unknown)=>resolve({data:published?[{id:'item'}]:[],error:null})};
  const api={rpc:async()=>({data:enabled,error:null}),from:(table:string)=>{queried=true;assert.equal(table,'hotel_tourism_items');return query;}};
  assert.equal(await publicTourismHomeAvailable(api as unknown as Parameters<typeof publicTourismHomeAvailable>[0],'tenant'),expected);
  assert.equal(queried,enabled);if(enabled)assert.deepEqual(filters,[['hotel_id','tenant'],['is_published',true]]);
});
test('all four Homes use one gated card, outside the established access grid/dock',()=>{
  for(const file of ['app/page.tsx','app/hotel/[slug]/page.tsx'])assert.match(readFileSync(file,'utf8'),/tourismHomeAvailable=\{pageData\.tourismHomeAvailable\}/);
  for(const file of ['components/public/hotel-public-page-content.tsx','components/public/grand-mercure/grand-mercure-public-home.tsx','components/public/novotel/novotel-public-home.tsx','components/public/mercure/mercure-public-home.tsx'])assert.match(readFileSync(file,'utf8'),/PublicTourismHomeCard available=/);
  for(const file of ['components/public/grand-mercure/grand-mercure-mobile-navigation.tsx','components/public/novotel/novotel-mobile-navigation.tsx','components/public/mercure/mercure-bottom-dock.tsx'])assert.doesNotMatch(readFileSync(file,'utf8'),/tourism|turismo/i);
  const card=readFileSync('components/public/public-tourism-home-card.tsx','utf8');assert.match(card,/if \(!available\) return null/);assert.doesNotMatch(card,/Em breve|coming_soon/);
});
test('availability is opt-in available and effective governance no longer blocks Tourism',()=>{
  const chain=readdirSync('supabase/migrations').filter((p)=>p.endsWith('.sql')).sort().map((p)=>readFileSync('supabase/migrations/'+p,'utf8')).join('\n');
  const effective=[...chain.matchAll(/create (?:or replace )?function public\.update_platform_hotel_module\([\s\S]*?end;\s*\$\$;/g)].at(-1)?.[0];
  assert.ok(effective);const blocked=effective.match(/if p_enabled and p_module_key in\(([^)]*)\)/)?.[1];assert.ok(blocked);assert.doesNotMatch(blocked,/content\.tourism/);
  assert.equal(MODULE_CATALOG.find((m)=>m.key==='content.tourism')?.availability,'available');
  assert.ok(!(BASELINE_MODULE_KEYS as readonly string[]).includes('content.tourism'));
  assert.doesNotMatch(readFileSync('lib/tourism/public.ts','utf8'),/service_role|update_platform_hotel_module/);
});
