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
const args=new URLSearchParams(location.search);
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
const domain={kind:'localhost',isPotentialHotelSubdomain:false,shouldUseSlugFallback:true,productRootDomain:'libguest.digital',hostname:'127.0.0.1'} as DomainContext;
createRoot(document.getElementById('root')!).render(args.has('editor') ? <PresentationEditor initial={config as PublicPresentation} revision={0} action={async form=>{
 document.body.dataset.editorialSaved=JSON.stringify({configuration:JSON.parse(String(form.get('configuration'))),files:[...form.entries()].filter(([,v])=>v instanceof File&&v.name).map(([key,v])=>({key,name:(v as File).name}))});
}}/> : <HotelPublicPageContent {...data} language={language} domainContext={domain}/>);
