import {PublicImportantNotice} from './public-important-notice';
import Image from "next/image";
import { Info, Tag, ArrowUpRight } from "lucide-react";
import { communicationCopy, publicCommunications, publicCommunicationUrl, communicationExcerpt } from "@/lib/public-communications";
import type { PublicHotelPageData } from "@/lib/public-hotel-data";
import type { SupportedPublicLanguage } from "@/lib/public-language";
export function PublicCommunications({data,language,announcementsHref,mode}:{data:PublicHotelPageData;language:SupportedPublicLanguage;announcementsHref:string;mode:"attention"|"offers"|"updates"}){
 const enabled=(key:string)=>data.layout.some(b=>b.blockKey===key&&b.isEnabled);
 const model=publicCommunications(data.hotel.id,enabled("announcements")?data.announcements:[],enabled("banners")?data.banners:[]),copy=communicationCopy(language);
 const detail=(id:string)=>announcementsHref+"#announcement-"+id;
 if(mode==="attention")return <PublicImportantNotice rows={model.alerts} language={language} announcementsHref={announcementsHref}/>;
 if(mode==="offers")return model.banners.length?<section className="v4-communications" aria-label={copy.offers} data-v4-offers data-offer-count={model.banners.length}>
  <h2>{copy.offers}</h2><div className="v4-offer-cards" tabIndex={0} role="region" aria-label={copy.scrollOffers}>{model.banners.map(row=>{
   const image=publicCommunicationUrl(row.image_url),cta=publicCommunicationUrl(row.cta_url,"link"),summary=communicationExcerpt(row.title,row.subtitle);
   return <article key={row.id} data-with-image={image?"true":"false"}>
    {image?<Image src={image} alt={row.title} width={640} height={240} unoptimized className="v4-offer-image"/>:null}
    <div><p className="v4-communication-category"><Tag aria-hidden/>{copy.promotion}</p><h3>{row.title}</h3>
     {summary?<p className="v4-communication-summary">{summary}</p>:null}
     {row.ends_at?<p className="v4-communication-period">{copy.until} {new Intl.DateTimeFormat(language,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(row.ends_at))}</p>:null}
     {cta?<a href={cta} target="_blank" rel="noopener noreferrer" data-analytics-event="website_click" data-analytics-label={row.title}>{row.cta_label||copy.more}<ArrowUpRight aria-hidden/></a>:null}
    </div>
   </article>;
  })}</div>{model.banners.length>1?<p className="v4-scroll-hint">{copy.scrollOffers}</p>:null}
 </section>:null;
 return model.updates.length?<section className="v4-communications" aria-label={copy.updates} data-v4-updates>
  <h2>{copy.updates}</h2><div className="v4-update-list">{model.updates.map(row=><article key={row.id}>
   <Info aria-hidden/><div><p className="v4-communication-category">{copy.information}</p><h3>{row.title}</h3>
   {communicationExcerpt(row.title,row.body)?<p className="v4-communication-summary">{communicationExcerpt(row.title,row.body)}</p>:null}
   <a href={detail(row.id)}>{copy.read}<ArrowUpRight aria-hidden/></a></div>
  </article>)}</div><a href={announcementsHref}>{copy.all}<ArrowUpRight aria-hidden/></a>
 </section>:null;
}
