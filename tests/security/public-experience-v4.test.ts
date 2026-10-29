import '../../scripts/bootstrap-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {PublicHotelPageData} from '../../lib/public-hotel-data';
import type {DomainContext} from '../../lib/domain-context';
const {getUniversalMobileHome,publicExperienceVersion}=await import('../../lib/public-experience-v4.ts');
const {parsePublicPresentation,emptyPresentation}=await import('../../lib/public-presentation.ts');
const domain={kind:'product-subdomain',isPotentialHotelSubdomain:true,productRootDomain:'libguest.digital',subdomain:'synthetic'} as DomainContext;
function data():PublicHotelPageData {
 return {hotel:{id:'synthetic',slug:'synthetic',subdomain:'synthetic',wifi_name:'Synthetic Network',wifi_password:null,breakfast_hours:'Mon–Fri 07:15–10:45; weekends and holidays 08:00–11:30',checkin_time:'15:30',checkout_time:'11:45',website_url:'https://example.test'},sections:[{id:'wifi-id',hotel_id:'synthetic',enabled:true,icon:'Wifi',content:'Synthetic access instructions',service_action_type:'standard'}],departments:[],policies:[],banners:[],announcements:[],layout:[{blockKey:'quick_info',isEnabled:true,position:1},{blockKey:'services',isEnabled:true,position:2},{blockKey:'contact',isEnabled:true,position:3}],experienceMedia:[],flightHomeCard:{title:null,description:null},hasFallbackContent:false} as unknown as PublicHotelPageData;
}
test('old settings and explicit V3 remain V3; only persisted opt-in selects V4',()=>{
 assert.equal(publicExperienceVersion(null),'v3');assert.equal(publicExperienceVersion(emptyPresentation()),'v3');
 for(const experienceVersion of ['v3','v4'] as const){const p={...emptyPresentation(),experienceVersion};assert.ok(parsePublicPresentation(p,'synthetic'));assert.equal(publicExperienceVersion(p),experienceVersion);}
 for(const value of ['v5',4,null])assert.equal(parsePublicPresentation({...emptyPresentation(),experienceVersion:value},'synthetic'),null);
});
test('essentials preserve complete source values without hotel-specific defaults or personal identity',()=>{
 const d=data(),m=getUniversalMobileHome(d,'en',domain,true);
 assert.equal(m.wifi?.name,d.hotel.wifi_name);assert.equal(m.wifi?.instructions,d.sections[0].content);assert.equal(m.wifi?.password,null);
 assert.equal(m.breakfast,d.hotel.breakfast_hours);assert.equal(m.checkin,'15:30');assert.equal(m.checkout,'11:45');
 assert.ok(m.breakfast?.includes('holidays'));assert.ok(m.breakfast?.includes('11:30'));
});
test('missing essential fields are hidden, never fabricated',()=>{
 const d=data();d.hotel.wifi_name=null;d.hotel.breakfast_hours=null;d.hotel.checkin_time=null;d.hotel.checkout_time=null;
 const m=getUniversalMobileHome(d,'pt',domain,true);assert.equal(m.wifi,null);assert.equal(m.breakfast,null);assert.equal(m.checkin,null);assert.equal(m.checkout,null);
});
test('disabled composition and unavailable optional modules do not produce useless cards',()=>{
 const d=data();d.layout=[];d.flightHomeCard=null;const m=getUniversalMobileHome(d,'pt',domain,true);
 assert.equal(m.wifi,null);assert.deepEqual(m.actions,[]);
});
test('services and wifi instructions cannot cross tenants or use disabled rows',()=>{
 const d=data();d.sections[0].hotel_id='other';d.flightHomeCard=null;d.hotel.website_url=null;d.layout=d.layout.filter(b=>b.blockKey!=='contact');
 const m=getUniversalMobileHome(d,'pt',domain,true);assert.equal(m.wifi?.instructions,null);assert.deepEqual(m.actions,[]);
});
test('canonical destinations preserve language and subdomain/slug routing',()=>{
 for(const language of ['pt','en','es'] as const){const m=getUniversalMobileHome(data(),language,domain,true);const suffix=language==='pt'?'':`?lang=${language}`;
  assert.equal(m.actions.find(a=>a.key==='services')?.href,'/explorar/servicos'+suffix);assert.equal(m.actions.find(a=>a.key==='flights')?.href,'/explorar/voos'+suffix);assert.equal(m.actions.find(a=>a.key==='contact')?.href,'/explorar/contato'+suffix);
  assert.equal(getUniversalMobileHome(data(),language,domain,false).actions[0].href,'/hotel/synthetic/explorar/servicos'+suffix);
 }
});
test('dining uses the eligible existing destination and translates canonical local routes',()=>{
 const d=data();d.experienceMedia=[{hotel_id:'synthetic',slot:'restaurant',is_published:true,cta_url:'https://synthetic.libguest.digital/servicos/wifi-id'}] as PublicHotelPageData['experienceMedia'];
 assert.equal(getUniversalMobileHome(d,'es',domain,true).actions.find(a=>a.key==='dining')?.href,'/servicos/wifi-id?lang=es');
 d.experienceMedia![0].cta_url='javascript:alert(1)';assert.equal(getUniversalMobileHome(d,'pt',domain,true).actions.some(a=>a.key==='dining'),false);
 d.experienceMedia![0].cta_url='https://example.test/menu';assert.equal(getUniversalMobileHome(d,'en',domain,true).actions.find(a=>a.key==='dining')?.href,'https://example.test/menu');
});
test('room menu reuses the existing route; V4 has no PMS, identity, provider or translation calls',()=>{
 const d=data();d.sections[0].service_action_type='room_restaurant_menu';assert.equal(getUniversalMobileHome(d,'en',domain,true).actions.find(a=>a.key==='dining')?.href,'/explorar/cardapio?lang=en');
 const source=readFileSync('lib/public-experience-v4.ts','utf8')+readFileSync('components/public/public-experience-mobile-tasks.tsx','utf8');
 assert.doesNotMatch(source,/fetch\(|createAdminClient|signIn|translate[A-Z]|Bugan by Atlantica|1208|occupants|GPTMaker/);
 const sql=readFileSync('supabase/migrations/20261029024616_public_experience_v4_selection.sql','utf8');assert.doesNotMatch(sql,/create table|update public\.|insert into public\.|grant execute/i);
});
