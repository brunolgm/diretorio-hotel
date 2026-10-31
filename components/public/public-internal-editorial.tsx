import type {CSSProperties} from 'react';
import {getPublicEssentials} from '@/lib/public-essentials';
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
type OverviewProps={data:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean};
export function InternalHotelNavigation({data,language}:{data:PublicHotelPageData;language:SupportedPublicLanguage}){
 const e=getPublicEssentials(data,language),labels=language==='en'?{wifi:'Wi-Fi',breakfast:'Breakfast',hours:'Stay hours',policies:'Policies',about:'About the hotel',rooms:'Accommodations',nav:'Information sections'}:language==='es'?{wifi:'Wi-Fi',breakfast:'Desayuno',hours:'Horarios',policies:'Políticas',about:'El hotel',rooms:'Alojamiento',nav:'Secciones de información'}:{wifi:'Wi-Fi',breakfast:'Café da manhã',hours:'Horários',policies:'Políticas',about:'Conheça o hotel',rooms:'Acomodações',nav:'Seções de informações'};
 const available=(slot:string)=>data.experienceMedia?.some(m=>m.slot===slot&&m.hotel_id===data.hotel.id&&m.is_published);
 return <nav className="public-internal-anchors" aria-label={labels.nav}>{e.wifi?<a href="#hotel-wifi">{labels.wifi}</a>:null}{e.breakfast?<a href="#hotel-breakfast">{labels.breakfast}</a>:null}{e.checkin||e.checkout?<a href="#hotel-hours">{labels.hours}</a>:null}{data.layout.some(b=>b.blockKey==='policies'&&b.isEnabled)&&data.policies.length?<a href="#hotel-policies">{labels.policies}</a>:null}{available('about')?<a href="#hotel-overview">{labels.about}</a>:null}{available('accommodation')?<a href="#hotel-accommodation">{labels.rooms}</a>:null}</nav>;
}
export function InternalHotelOverview({data,language,domainContext,preferSubdomainRoot}:OverviewProps){
 const about=data.experienceMedia?.find(m=>m.slot==='about'&&m.hotel_id===data.hotel.id&&m.is_published),icons={location:MapPin,bed:BedDouble,pool:Waves,fitness:Dumbbell};
 if(!about&&!data.presentation?.benefits.length)return null;
 return <div className="public-internal-overview" data-hotel-overview>
  {about?<div id="hotel-overview"><InternalEditorialMedia media={about} hotelId={data.hotel.id} href={publicEditorialHref({url:about.cta_url,hotel:data.hotel,sections:data.sections,language,domainContext,preferSubdomainRoot})}/></div>:null}
  {data.presentation?.benefits.length?<ul className="public-internal-benefits">{data.presentation.benefits.map((b,i)=>{const Icon=icons[b.icon];return <li key={i}><Icon aria-hidden/>{editorialText(b.label,language)}</li>;})}</ul>:null}
 </div>;
}
export function InternalAccommodation({data,language,domainContext,preferSubdomainRoot}:{data:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean}){
 const media=data.experienceMedia?.find(m=>m.slot==='accommodation'&&m.hotel_id===data.hotel.id&&m.is_published);if(!media)return null;
 return <section id="hotel-accommodation"><InternalEditorialMedia media={media} hotelId={data.hotel.id} href={publicEditorialHref({url:media.cta_url,hotel:data.hotel,sections:data.sections,language,domainContext,preferSubdomainRoot})}/></section>;
}
