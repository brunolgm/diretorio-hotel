import {PublicImportantNotice} from './public-important-notice';
import {PublicEditorialOffers} from './public-editorial-offers';
import Image from 'next/image';
import {Info,ArrowUpRight,Tag} from 'lucide-react';
import {communicationCopy,publicCommunications,communicationExcerpt,publicCommunicationUrl} from '@/lib/public-communications';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {SupportedPublicLanguage} from '@/lib/public-language';
export function PublicCommunications({data,language,announcementsHref,mode}:{data:PublicHotelPageData;language:SupportedPublicLanguage;announcementsHref:string;mode:'attention'|'offers'|'updates'|'region'}){
 if(mode==='offers'||mode==='updates')return <LegacyCommunicationSections data={data} language={language} announcementsHref={announcementsHref} mode={mode}/>;
 const enabled=(key:string)=>data.layout.some(b=>b.blockKey===key&&b.isEnabled);
 const model=publicCommunications(data.hotel.id,enabled('announcements')?data.announcements:[],enabled('banners')?data.banners:[]),copy=communicationCopy(language);
 if(mode==='attention')return <PublicImportantNotice rows={model.alerts} language={language} announcementsHref={announcementsHref}/>;
 const offers=model.banners.length?<PublicEditorialOffers key={model.banners.map(row=>row.id).join(':')} banners={model.banners} language={language}/>:null;
 const updates=model.updates.length?<section className="v4-communications" aria-label={copy.updates} data-v4-updates>
  <div className="v4-updates-heading"><h2>{copy.updates}</h2><a href={announcementsHref}>{copy.allUpdates}<ArrowUpRight aria-hidden/></a></div>
  <div className="v4-update-list">{model.updates.slice(0,3).map(row=><article key={row.id} data-announcement-id={row.id} data-communication-category={row.category}>
   <Info aria-hidden/><div><p className="v4-communication-category">{copy.information}</p><h3>{row.title}</h3>
   {communicationExcerpt(row.title,row.body)?<p className="v4-communication-summary">{communicationExcerpt(row.title,row.body)}</p>:null}</div>
   <a href={announcementsHref+'#announcement-'+row.id} aria-label={copy.read+': '+row.title}><span className="v4-update-read-label">{copy.read}</span><ArrowUpRight aria-hidden/></a>
  </article>)}</div>
 </section>:null;

 return offers||updates?<div className="v4-communication-region" data-v4-communication-region data-two-columns={Boolean(offers&&updates)}>{offers}{updates}</div>:null;
}

function LegacyCommunicationSections({data,language,announcementsHref,mode}:{data:PublicHotelPageData;language:SupportedPublicLanguage;announcementsHref:string;mode:"attention"|"offers"|"updates"}){
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
