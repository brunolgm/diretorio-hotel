import {state} from './public-entry-runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {default:subdomainPage}=await import('../../app/page.tsx');
const {default:slugPage}=await import('../../app/hotel/[slug]/page.tsx');
test('actual public slug and subdomain entrypoints preserve canonical presentation/media/data for every locale and fallback',async()=>{
 for(const lang of ['pt','en','es'])for(const presentation of [null,{experienceVersion:'v4',heroTitleMode:'hotel_name',benefits:['four approved benefits'],tourism:{cards:['four approved images and destinations']}}]){
  const data={hotel:{id:'own',slug:'bugan-recife'},presentation,experienceMedia:[{slot:'hero',focal_x:50}],tourismPreview:[{slug:'praia-de-boa-viagem'}],sections:[],departments:[],policies:[],banners:[],announcements:[],layout:[],flightHomeCard:null,tourismHomeAvailable:true,hasFallbackContent:false};
  state.data=data;state.subdomain=true;state.room=null;state.queries=[];
  const pages=[await subdomainPage({searchParams:Promise.resolve({lang})}),await slugPage({params:Promise.resolve({slug:'bugan-recife'}),searchParams:Promise.resolve({lang})})];
  for(const result of pages){assert.equal(result.props.presentation,data.presentation);assert.equal(result.props.experienceMedia,data.experienceMedia);assert.equal(result.props.tourismPreview,data.tourismPreview);assert.equal(result.props.language,lang);assert.equal(result.props.hotel,data.hotel);assert.equal(result.props.activeRoomContext,null);}
  assert.deepEqual(state.queries,[{subdomain:'buganrecife',lang},{slug:'bugan-recife',lang}]);
 }
});
test('real public adapters keep inactive/unknown hotel unavailable and product landing separate',async()=>{
 state.data=null;state.subdomain=true;assert.equal((await subdomainPage({})).type.name,'HotelExperienceUnavailable');assert.equal((await slugPage({params:Promise.resolve({slug:'missing'})})).type.name,'HotelExperienceUnavailable');
 state.subdomain=false;assert.equal((await subdomainPage({})).type.name,'LandingPageContent');
});
