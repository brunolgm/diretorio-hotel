import guideManifest from '../../docs/bootstrap/bugan-room-guides-20261030.json';
import {ServiceGuideEditor} from '../../components/admin/service-guide-editor';
import type {RoomGuide} from '../../lib/room-guides';
import {createSavedGuestFlight,saveGuestFlight,removeGuestFlight} from '../../lib/guest-flight-storage';
import tourismManifest from '../../docs/bootstrap/bugan-tourism-v4-20261029.json';
import closureCopy from './fixtures/bugan-v4-public-copy.json';
import tourismCheckpoint from '../../docs/bootstrap/bugan-tourism-v4-resume-20261029.json';
// Local renderer fixture only. Approved photos/copy, no auth, database or provider.
import {createRoot} from 'react-dom/client';
import {HotelPublicPageContent} from '../../components/public/hotel-public-page-content';
import {getDefaultExperienceLayout} from '../../lib/experience-layout';
import type {PublicHotelPageData} from '../../lib/public-hotel-data';
import type {DomainContext} from '../../lib/domain-context';
import type {SupportedPublicLanguage} from '../../lib/public-language';
import source from '../../docs/bootstrap/bugan-recife-20261028.json';
import refinement from '../../docs/bootstrap/bugan-public-v3-refinement-20261028.json';
import {PresentationEditor} from '../../components/admin/presentation-editor';
import type {PublicPresentation} from '../../lib/public-presentation';
import {HotelPublicAreaContent} from '../../components/public/hotel-public-area-content';
import {HotelServiceDetailContent} from '../../components/public/hotel-service-detail-content';
import {PublicTourismContent} from '../../components/public/public-tourism-content';
import {HotelPublicFlightCenter} from '../../components/public/hotel-public-flight-center';
import type {PublicFlightCenterData} from '../../lib/public-hotel-data';
import type {PublicTourismItem} from '../../lib/tourism/public';
import {isPublicHotelAreaKey} from '../../lib/public-routes';
import {normalizePublicFlightCenterTab} from '../../lib/public-flight-center-copy';
const args=new URLSearchParams(location.search);
// Isolated lab continuity only; no real session or authorization is simulated by these renderers.
if(args.has('scope'))sessionStorage.setItem('navigation-fixture',args.toString());
if(!args.has('scope')&&sessionStorage.getItem('navigation-fixture')){
 for(const [key,value] of new URLSearchParams(sessionStorage.getItem('navigation-fixture')!))if(!args.has(key))args.set(key,value);
}
const theme=args.get('theme')??'bugan';const language=(args.get('lang')??'pt') as SupportedPublicLanguage;
const hotel={id:source.hotelId,name:'Bugan Recife',city:'Recife',slug:'bugan-recife',subdomain:'buganrecife',theme_preset:theme==='default'?null:theme,brand_code:theme==='default'?null:theme,theme_primary_color:null,logo_url:'/assets/logo.png',hero_image_url:'/assets/hero.webp',booking_url:source.hotel.booking_url,website_url:source.hotel.website_url,instagram_url:null,whatsapp_number:null,wifi_name:'Bugan by Atlantica',wifi_password:null,checkin_time:'14:00',checkout_time:'12:00',breakfast_hours:'06:00–10:00'};
const media=source.media.map(m=>({hotel_id:hotel.id,slot:m.key,image_path:`${hotel.id}/hero/${m.key}/52130000-0000-4000-8000-000000000001.webp`,mobile_image_path:null,revision:1,...m.values,cta_url:m.values.cta_url??'https://example.test/hotel'}));
const config=structuredClone(refinement.configuration);
if(args.get('experience')==='v4'){
 (config as PublicPresentation).experienceVersion='v4';
 hotel.breakfast_hours='Seg–Sex 06:00–10:00; sábados, domingos e feriados 06:00–10:30';
}
const count=Number(args.get('cards')??4);config.tourism.cards=Array.from({length:count},(_,i)=>config.tourism.cards[i%4]);
const data={hotel,experienceMedia:media,presentation:config,sections:source.entries.filter(e=>e.domain==='service').map((s,i)=>({id:`service-${i}`,hotel_id:hotel.id,...s.values})),departments:[],policies:[],banners:[],announcements:[],layout:getDefaultExperienceLayout(),tourismHomeAvailable:args.get('tourism')!=='off',tourismPreview:[],flightHomeCard:{title:null,description:null},hasFallbackContent:false} as unknown as PublicHotelPageData;
if(args.get('experience')==='v4'){
 const dining=data.experienceMedia?.find(m=>m.slot==='restaurant');const service=data.sections.find(row=>row.icon==='UtensilsCrossed');
 if(dining&&service)dining.cta_url='https://buganrecife.libguest.digital/servicos/'+service.id;
}
if(args.get('scope')==='preview')for(const media of data.experienceMedia??[]){
 const spec=source.media.find(m=>m.key===media.slot);
 const key=spec&&'serviceKey' in spec?spec.serviceKey:null;
 const index=source.entries.filter(e=>e.domain==='service').findIndex(e=>e.key===key);
 if(index>=0)media.cta_url='https://libguest.digital/hotel/bugan-recife/servicos/service-'+index;
}
if(args.get('modules')==='off'){
 data.sections=[];data.experienceMedia=data.experienceMedia?.filter(m=>m.slot!=='restaurant');data.flightHomeCard=null;data.tourismHomeAvailable=false;data.hotel.website_url=null;data.hotel.booking_url=null;data.departments=[];
}
if(args.get('missing')==='essentials'){data.hotel.wifi_name=null;data.hotel.breakfast_hours=null;data.hotel.checkin_time=null;data.hotel.checkout_time=null;}
const identities:Record<string,{name:string;subdomain:string;slug:string}>={
 'grand-mercure':{name:'Grand Mercure Rio de Janeiro Copacabana',subdomain:'grandmercurecopacabana',slug:'grandmercureriocopacabana'},
 'novotel-leme':{name:'Novotel Rio de Janeiro Leme',subdomain:'novotelleme',slug:'novotelrioleme'},
 'novotel-salvador':{name:'Novotel Salvador',subdomain:'novotelsalvador',slug:'novotelrv'},
 mercure:{name:'Mercure Rio Boutique Copacabana',subdomain:'mercurerioboutique',slug:'mercurerioboutiquecopacabana'},
 default:{name:'Default Hotel',subdomain:'default',slug:'default-hotel'}
};
const identity=identities[args.get('property')??theme];
if(identity){Object.assign(data.hotel,identity);data.hotel.logo_url=null;data.hotel.hero_image_url=null;}
if(args.get('tourism')==='coherent'){
 data.departments=source.entries.filter(e=>e.domain==='department').map((e,i)=>({id:'department-'+i,hotel_id:data.hotel.id,...e.values})) as PublicHotelPageData['departments'];
 config.tourism.cards.forEach((c,i)=>{(c as PublicPresentation['tourism']['cards'][number]).destination=tourismManifest.destinations[i] as PublicPresentation['tourism']['cards'][number]['destination'];});
 data.tourismPreview=tourismManifest.entries.map((e,i)=>({id:'verified-'+i,hotel_id:data.hotel.id,slug:e.key,...e.values,...(language==='pt'?{}:e.translations[language]),main_image_path:null})) as unknown as PublicTourismItem[];
}
if(args.get('closure')==='1'){
 data.tourismPreview=tourismCheckpoint.items.map(item=>{
  const tr=tourismCheckpoint.translations.find(t=>t.item_id===item.id&&t.language===language),update=tourismManifest.updates.find(u=>u.id===item.id);
  return {...item,...(language==='pt'?{}:tr),...(language!=='pt'&&update?update.translations[language]:{}),id:item.id,hotel_id:data.hotel.id};
 }) as PublicTourismItem[];
 data.sections=closureCopy.services.map(s=>({...s,...(language==='pt'?{}:closureCopy.serviceTranslations.find(t=>t.section_id===s.id&&t.language===language))!,id:s.id,hotel_id:data.hotel.id})) as PublicHotelPageData['sections'];
 data.departments=closureCopy.departments.map(d=>({...d,...(language==='pt'?{}:closureCopy.departmentTranslations.find(t=>t.department_id===d.id&&t.language===language))!,id:d.id,hotel_id:data.hotel.id})) as PublicHotelPageData['departments'];
 data.policies=closureCopy.policies.map(p=>({...p,...(language==='pt'?{}:closureCopy.policyTranslations.find(t=>t.policy_id===p.id&&t.language===language))!,id:p.id,hotel_id:data.hotel.id})) as PublicHotelPageData['policies'];
 data.experienceMedia=data.experienceMedia?.map(m=>{
  const spec=source.media.find(s=>s.key===m.slot),serviceKey=spec&&'serviceKey' in spec?spec.serviceKey:null;
  const index=source.entries.filter(e=>e.domain==='service').findIndex(e=>e.key===serviceKey);
  return {...m,...(language==='pt'?{}:closureCopy.mediaTranslations.find(t=>t.slot===m.slot&&t.language===language)),slot:m.slot,hotel_id:m.hotel_id,...(index>=0?{cta_url:`https://libguest.digital/hotel/${data.hotel.slug}/servicos/${data.sections[index].id}`}:{})};
 });
}
const domain={kind:'localhost',isPotentialHotelSubdomain:false,shouldUseSlugFallback:true,productRootDomain:'libguest.digital',hostname:'127.0.0.1'} as DomainContext;
if(args.get('communications')==='1'){
 const base={hotel_id:hotel.id,title:'Notice '+language,body:'Operational details '+language,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),starts_at:null,ends_at:null,is_active:true};
 data.announcements=[{...base,id:'alert',category:'alerta'},{...base,id:'maintenance',category:'manutencao',starts_at:'2020-01-01T00:00:00Z',ends_at:'2090-01-01T00:00:00Z'},{...base,id:'info',category:'informativo'},{...base,id:'promotion',category:'promocao'},{...base,id:'draft',category:'alerta',title:'DRAFT MUST NOT SHOW',is_active:false},{...base,id:'expired',category:'alerta',title:'EXPIRED MUST NOT SHOW',ends_at:'2020-01-01T00:00:00Z'},{...base,id:'foreign',category:'alerta',title:'FOREIGN MUST NOT SHOW',hotel_id:'other'}];
 data.banners=[{...base,id:'banner-1',title:'Offer '+language,subtitle:'Published offer',cta_label:'Open',cta_url:'https://example.test/offer',display_order:1,image_url:'https://example.test/banner.png'}];
}
const fixtureGuides=new Map<string,RoomGuide>();
if(args.get('guides')==='1'){
 for(const [i,spec]of guideManifest.guides.entries()){
  const id='52130000-0000-4000-8000-00000000000'+(i+1),guide=structuredClone(spec.configuration) as RoomGuide;
  // Synthetic publication fixture only, never a claim of operational validation.
  guide.applicability.scope='categories';guide.applicability.categories=['Synthetic suite'];guide.applicability.label={pt:'Suíte sintética de teste',en:'Synthetic test suite',es:'Suite sintética de prueba'};
  guide.channels.forEach(c=>{if(c.kind==='review')c.kind='linear';});const globo=guide.channels.find(c=>c.number==='18');if(globo)globo.quality='SD';
  for(const [key,asset]of Object.entries(spec.images)){const step=guide.steps.find(s=>s.key===key);if(step)step.image_path=hotel.id+'/room-guides/'+id+'/'+(asset==='smart-remote'?'52140000-0000-4000-8000-000000000001':'52140000-0000-4000-8000-000000000002')+'.webp';}
  data.sections.push({id,hotel_id:hotel.id,title:spec.title[language],content:spec.content[language],enabled:true,service_action_type:'standard',url:null,sort_order:50+i,category:'Room guides'} as PublicHotelPageData['sections'][number]);
  fixtureGuides.set(id,guide);
 }
 data.serviceGuides=[...fixtureGuides].map(([serviceId,guide])=>({serviceId,category:guide.category}));
}
if(new URLSearchParams(location.search).get('seedFlight')==='1'){
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10),saved=createSavedGuestFlight(hotel.id,{airline:'LA',flightNumber:'3565',departureAirport:'REC',arrivalAirport:'BSB',departureDate:tomorrow,scheduledDepartureTime:'20:50'});if(saved.ok)saveGuestFlight(hotel.id,saved.flight);
}
Object.assign(window,{fixtureFlight:{hotelId:hotel.id,save:saveGuestFlight,remove:removeGuestFlight,create:createSavedGuestFlight}});
if(args.get('scope')==='preview')domain.navigationScope='authenticated-preview';
let content=<HotelPublicPageContent {...data} language={language} domainContext={domain}/>;
const destinationPath=location.pathname.replace(/^\/hotel\/[^/]+/,'/preview');
if((domain.navigationScope||location.pathname.startsWith('/hotel/'))&&destinationPath!=='/preview'){
 const path=destinationPath.replace(/^\/preview\//,'').split('/');
 if(path[0]==='servicos'){
  const section=data.sections.find(s=>s.id===path[1]);
  content=section?<HotelServiceDetailContent hotel={data.hotel} section={section} roomGuide={fixtureGuides.get(section.id)} language={language} domainContext={domain} hasFallbackContent={false} experienceVersion={data.presentation?.experienceVersion} roomRestaurantState={section.service_action_type==='room_restaurant_menu'?'missing-context':null}/>:<h1>404 fixture</h1>;
 }else if(path[1]==='voos'){
  const flights={hotel:data.hotel,experienceVersion:data.presentation?.experienceVersion,airports:[{iataCode:'REC',name:'Synthetic REC airport',city:'Recife',timezone:'America/Recife',officialDeparturesUrl:null,officialArrivalsUrl:null,estimatedTransferMinutes:null,domesticLeadMinutes:null,internationalLeadMinutes:null,safetyMarginMinutes:null}],navigationAvailability:{services:true,menu:false,information:true,contact:true},settings:{departurePlanningEnabled:false,transferEnabled:false,wakeUpEnabled:false,breakfastBoxEnabled:false,receptionEnabled:false,officialLinksEnabled:false,departureNotice:null}} as PublicFlightCenterData;
  content=<HotelPublicFlightCenter data={flights} language={language} domainContext={domain} preferSubdomainRoot={false} tab={normalizePublicFlightCenterTab(args.get('tab')??'partidas')}/>;
 }else if(path[1]==='turismo'){
  const items=args.get('tourism')==='coherent'?data.tourismPreview!:source.entries.filter(e=>e.domain==='tourism').map((e,i)=>({id:'tourism-'+i,hotel_id:data.hotel.id,...e.values,main_image_path:null})) as unknown as PublicTourismItem[];
  content=<PublicTourismContent data={{hotel:data.hotel,presentation:data.presentation,items:path[2]?items.filter(i=>i.slug===path[2]):items}} language={language} domainContext={domain} preferSubdomainRoot={false} detail={!!path[2]} collection={args.get('collection')??undefined} category={args.get('category')??undefined} filter={args.get('type')??undefined}/>;
 }else if(isPublicHotelAreaKey(path[1]))content=<HotelPublicAreaContent pageData={data} area={path[1]} language={language} domainContext={domain} preferSubdomainRoot={false}/>;
 else content=<h1>404 fixture</h1>;
}
createRoot(document.getElementById('root')!).render(args.has('guideEditor')?<ServiceGuideEditor initial={structuredClone(guideManifest.guides[0].configuration) as RoomGuide} revision={1} serviceId="52130000-0000-4000-8000-000000000001" action={async form=>{document.body.dataset.guideSaved=String(form.get('configuration'));}}/>:args.has('editor') ? <PresentationEditor initial={config as PublicPresentation} revision={0} action={async form=>{
 document.body.dataset.editorialSaved=JSON.stringify({configuration:JSON.parse(String(form.get('configuration'))),files:[...form.entries()].filter(([,v])=>v instanceof File&&v.name).map(([key,v])=>({key,name:(v as File).name}))});
}}/> : content);
