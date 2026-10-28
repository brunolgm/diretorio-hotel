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
const count=Number(args.get('cards')??4);config.tourism.cards=Array.from({length:count},(_,i)=>config.tourism.cards[i%4]);
const data={hotel,experienceMedia:media,presentation:config,sections:source.entries.filter(e=>e.domain==='service').map((s,i)=>({id:`service-${i}`,hotel_id:hotel.id,...s.values})),departments:[],policies:[],banners:[],announcements:[],layout:getDefaultExperienceLayout(),tourismHomeAvailable:args.get('tourism')!=='off',tourismPreview:[],flightHomeCard:{title:null,description:null},hasFallbackContent:false} as unknown as PublicHotelPageData;
const domain={kind:'localhost',isPotentialHotelSubdomain:false,shouldUseSlugFallback:true,productRootDomain:'libguest.digital',hostname:'127.0.0.1'} as DomainContext;
createRoot(document.getElementById('root')!).render(args.has('editor') ? <PresentationEditor initial={config as PublicPresentation} revision={0} action={async form=>{
 document.body.dataset.editorialSaved=JSON.stringify({configuration:JSON.parse(String(form.get('configuration'))),files:[...form.entries()].filter(([,v])=>v instanceof File&&v.name).map(([key,v])=>({key,name:(v as File).name}))});
}}/> : <HotelPublicPageContent {...data} language={language} domainContext={domain}/>);
