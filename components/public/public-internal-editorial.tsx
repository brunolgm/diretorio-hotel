import type {CSSProperties} from 'react';
import {buildPublicHotelAreaHref} from '@/lib/public-routes';
import {communicationEligible} from '@/lib/public-communications';
import Image from 'next/image';
import {ArrowUpRight,MapPin,BedDouble,Waves,Dumbbell} from 'lucide-react';
import type {ExperienceMedia} from '@/lib/public-experience-media';
import {experienceMediaUrl,focalPosition} from '@/lib/public-experience-media';
import {editorialText} from '@/lib/public-presentation';
import {publicEditorialHref} from '@/lib/public-editorial-link';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {SupportedPublicLanguage} from '@/lib/public-language';
export function InternalEditorialMedia({media,hotelId,href}:{media:ExperienceMedia;hotelId:string;href?:string|null}){
 if(media.hotel_id!==hotelId||!media.is_published)return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL??'';
 const image=experienceMediaUrl(media.image_path,hotelId,media.slot,base),mobile=experienceMediaUrl(media.mobile_image_path,hotelId,media.slot,base);
 if(!image&&!mobile&&!media.title&&!media.description)return null;
 return <article className="public-internal-editorial" data-internal-editorial={media.slot} style={{"--internal-focal":focalPosition(media.focal_x,media.focal_y),"--internal-mobile-focal":focalPosition(media.mobile_focal_x,media.mobile_focal_y)} as CSSProperties}>
  {image||mobile?<picture>{mobile?<source media="(max-width:767px)" srcSet={mobile}/>:null}<Image src={image??mobile!} alt={media.alt_text||media.title||''} width={720} height={480} unoptimized/></picture>:null}
  <div>{media.title?<h2>{media.title}</h2>:null}{media.description?<p>{media.description}</p>:null}{href&&media.cta_label?<a href={href} target={href.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{media.cta_label}<ArrowUpRight aria-hidden/></a>:null}</div>
 </article>;
}
export function InternalHotelOverview({data,language,domainContext,preferSubdomainRoot}:{data:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean}){
 const media=data.experienceMedia??[],about=media.find(m=>m.slot==='about'&&m.hotel_id===data.hotel.id&&m.is_published),accommodation=media.find(m=>m.slot==='accommodation'&&m.hotel_id===data.hotel.id&&m.is_published);
 const labels=language==='en'?{about:'About the hotel',stay:'Your stay',rooms:'Accommodations',policies:'Policies',services:'Services'}:language==='es'?{about:'El hotel',stay:'Su estadía',rooms:'Alojamiento',policies:'Políticas',services:'Servicios'}:{about:'Conheça o hotel',stay:'Sua estadia',rooms:'Acomodações',policies:'Políticas',services:'Serviços'};
 const icons={location:MapPin,bed:BedDouble,pool:Waves,fitness:Dumbbell};
 const href=(m:ExperienceMedia)=>publicEditorialHref({url:m.cta_url,hotel:data.hotel,sections:data.sections,language,domainContext,preferSubdomainRoot});
 return <div className="public-internal-overview" data-hotel-overview>
  <nav className="public-internal-anchors" aria-label={labels.about}>{about?<a href="#hotel-overview">{labels.about}</a>:null}{data.hotel.wifi_name||data.hotel.breakfast_hours||data.hotel.checkin_time||data.hotel.checkout_time?<a href="#hotel-stay">{labels.stay}</a>:null}{accommodation?<a href="#hotel-accommodation">{labels.rooms}</a>:null}{data.policies.length?<a href="#hotel-policies">{labels.policies}</a>:null}{data.sections.length?<a href="#hotel-service-access">{labels.services}</a>:null}{data.announcements.some(r=>communicationEligible(r,data.hotel.id))?<a href={buildPublicHotelAreaHref({slug:data.hotel.slug,area:'comunicados',language,domainContext,preferSubdomainRoot})}>{language==='en'?'Announcements':language==='es'?'Comunicados':'Comunicados'}</a>:null}</nav>
  {about?<div id="hotel-overview"><InternalEditorialMedia media={about} hotelId={data.hotel.id} href={href(about)}/></div>:null}
  {data.presentation?.benefits.length?<ul className="public-internal-benefits">{data.presentation.benefits.map((b,i)=>{const Icon=icons[b.icon];return <li key={i}><Icon aria-hidden/>{editorialText(b.label,language)}</li>;})}</ul>:null}
 </div>;
}
export function InternalAccommodation({data,language,domainContext,preferSubdomainRoot}:{data:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean}){
 const media=data.experienceMedia?.find(m=>m.slot==='accommodation'&&m.hotel_id===data.hotel.id&&m.is_published);if(!media)return null;
 return <section id="hotel-accommodation"><InternalEditorialMedia media={media} hotelId={data.hotel.id} href={publicEditorialHref({url:media.cta_url,hotel:data.hotel,sections:data.sections,language,domainContext,preferSubdomainRoot})}/></section>;
}
