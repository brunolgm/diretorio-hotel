import Image from 'next/image';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {SupportedPublicLanguage} from '@/lib/public-language';
import {resolveHotelTheme} from '@/lib/hotel-theme';
import {buildPublicHotelHref,buildPublicHotelAreaHref,buildPublicHotelFlightCenterHref} from '@/lib/public-routes';
import {experienceHttpsUrl,experienceMediaUrl,focalPosition} from '@/lib/public-experience-media';
import {PublicAnalytics} from './public-analytics';
import {LanguageSwitcher} from './language-switcher';
import {PublicExperienceMenu} from './public-experience-menu';
import {PublicFbContent} from './public-fb-content';
import './fb-premium.css';

const copy={
 pt:{title:'Gastronomia',subtitle:'Cardápio do hotel',description:'Sabores que valorizam a culinária regional e a gastronomia contemporânea, com o padrão de qualidade Bugan.',home:'Início',hotel:'Hotel',services:'Serviços',tourism:'Turismo',flights:'Voos',contact:'Contato',reserve:'Reservar',menu:'Abrir navegação'},
 en:{title:'Dining',subtitle:'Hotel menu',description:'Flavours celebrating regional cuisine and contemporary dining, with the Bugan standard of quality.',home:'Home',hotel:'Hotel',services:'Services',tourism:'Tourism',flights:'Flights',contact:'Contact',reserve:'Book',menu:'Open navigation'},
 es:{title:'Gastronomía',subtitle:'Menú del hotel',description:'Sabores que valoran la cocina regional y la gastronomía contemporánea, con el estándar de calidad Bugan.',home:'Inicio',hotel:'Hotel',services:'Servicios',tourism:'Turismo',flights:'Vuelos',contact:'Contacto',reserve:'Reservar',menu:'Abrir navegación'}
};

/** Bugan's resolved V4 presentation only. Eligibility and ordering stay shared. */
export function PublicFbPremiumShell({pageData,language,domainContext,preferSubdomainRoot}:{pageData:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean}){
 const {hotel}=pageData,t=copy[language],theme=resolveHotelTheme(hotel.theme_preset,hotel.theme_primary_color);
 const route={slug:hotel.slug,language,domainContext,preferSubdomainRoot};
 const area=(key:Parameters<typeof buildPublicHotelAreaHref>[0]['area'])=>buildPublicHotelAreaHref({...route,area:key});
 const enabled=(key:string)=>pageData.layout.some(b=>b.blockKey===key&&b.isEnabled);
 const links=[{href:buildPublicHotelHref(route),label:t.home},
  ...(enabled('quick_info')?[{href:area('informacoes'),label:t.hotel}]:[]),
  ...(enabled('services')&&pageData.sections.length?[{href:area('servicos'),label:t.services}]:[]),
  {href:area('cardapio'),label:t.title},
  ...(pageData.tourismHomeAvailable?[{href:area('turismo'),label:t.tourism}]:[]),
  ...(pageData.flightHomeCard?[{href:buildPublicHotelFlightCenterHref(route),label:t.flights}]:[]),
  ...(enabled('contact')?[{href:area('contato'),label:t.contact}]:[])];
 const reserve=experienceHttpsUrl(hotel.booking_url);
 const hero=(pageData.experienceMedia??[]).find(m=>m.hotel_id===hotel.id&&m.slot==='hero'&&m.is_published);
 const photo=(hero?experienceMediaUrl(hero.image_path,hotel.id,'hero',process.env.NEXT_PUBLIC_SUPABASE_URL??''):null)??experienceHttpsUrl(hotel.hero_image_url);
 const mobile=hero?experienceMediaUrl(hero.mobile_image_path,hotel.id,'hero',process.env.NEXT_PUBLIC_SUPABASE_URL??''):null;
 return <main className="hotel-theme-page fb-premium-page" style={theme.cssVars} data-hotel-theme={theme.preset} data-public-experience="v4" data-public-area="cardapio" data-fb-premium>
  <PublicAnalytics hotelSlug={hotel.slug} language={language}/>
  <header className="fb-premium-header"><div>
   <a className="fb-premium-brand" href={buildPublicHotelHref(route)} aria-label={hotel.name}>{hotel.logo_url?<Image unoptimized src={hotel.logo_url} alt={hotel.name} width={180} height={80}/>:<span>{hotel.name}</span>}{hotel.city?<small>{hotel.city}</small>:null}</a>
   <nav aria-label={t.menu}>{links.map(link=><a key={link.href} href={link.href} aria-current={link.href===area('cardapio')?'page':undefined}>{link.label}</a>)}</nav>
   <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={area('cardapio')}/>
   {reserve?<a className="fb-premium-reserve" href={reserve} target="_blank" rel="noopener noreferrer">{t.reserve}</a>:null}
   <PublicExperienceMenu title={hotel.name} label={t.menu} links={reserve?[...links,{href:reserve,label:t.reserve}]:links} style={theme.cssVars}/>
  </div></header>
  <section className="fb-premium-hero" aria-labelledby="fb-premium-title">
   {photo||mobile?<picture>{mobile?<source media="(max-width:767px)" srcSet={mobile}/>:null}<Image unoptimized priority src={photo??mobile!} alt="" width={1600} height={600} style={{objectPosition:focalPosition(hero?.focal_x??50,20)}}/></picture>:null}
   <div className="fb-premium-hero-copy"><p>{hotel.name}</p><h1 id="fb-premium-title">{t.title}</h1><h2>{t.subtitle}</h2><p className="fb-premium-intro">{t.description}</p></div>
  </section>
  <div className="fb-premium-body"><PublicFbContent pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} premiumLayout/></div>
 </main>;
}
