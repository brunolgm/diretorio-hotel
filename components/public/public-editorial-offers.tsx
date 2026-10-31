"use client";

import {useEffect, useId, useRef, useState} from 'react';
import Image from 'next/image';
import {ArrowUpRight, ChevronLeft, ChevronRight, Tag} from 'lucide-react';
import {communicationCopy, communicationExcerpt, publicCommunicationUrl} from '@/lib/public-communications';
import type {PublicHotelPromotionalBanner} from '@/lib/public-hotel-data';
import type {SupportedPublicLanguage} from '@/lib/public-language';

export function PublicEditorialOffers({banners,language}:{banners:PublicHotelPromotionalBanner[];language:SupportedPublicLanguage}) {
  const copy=communicationCopy(language),trackId=useId();
  const track=useRef<HTMLDivElement>(null),active=useRef(0);
  const [index,setIndex]=useState(0),[failedImages,setFailedImages]=useState<Set<string>>(()=>new Set());
  const multiple=banners.length>1;
  function move(next:number) {
    const node=track.current,target=Math.max(0,Math.min(next,banners.length-1));
    if(!node?.children[target])return;
    active.current=target;setIndex(target);
    node.scrollTo({left:(node.children[target] as HTMLElement).offsetLeft,behavior:'auto'});
  }
  function syncPosition() {
    const node=track.current;if(!node)return;
    let closest=0,distance=Infinity;
    Array.from(node.children).forEach((child,i)=>{const delta=Math.abs((child as HTMLElement).offsetLeft-node.scrollLeft);if(delta<distance){closest=i;distance=delta;}});
    if(active.current!==closest){active.current=closest;setIndex(closest);}
  }
  useEffect(()=>{
    const node=track.current;if(!node)return;
    const observer=new ResizeObserver(()=>{const child=node.children[active.current] as HTMLElement|undefined;if(child)node.scrollTo({left:child.offsetLeft,behavior:'auto'});});
    observer.observe(node);return()=>observer.disconnect();
  },[banners.length]);
  if(!banners.length)return null;
  return <section className="v4-communications v4-editorial-offers" aria-label={copy.offers} aria-roledescription={multiple?copy.carousel:undefined} data-v4-offers data-offer-count={banners.length}>
    <h2>{copy.offers}</h2>
    <div ref={track} id={trackId} className="v4-offer-cards" tabIndex={multiple?0:undefined} role="region" aria-label={copy.carousel} onScroll={syncPosition} onKeyDown={event=>{
      if(event.target!==event.currentTarget)return;
      const target=event.key==='ArrowRight'?index+1:event.key==='ArrowLeft'?index-1:event.key==='Home'?0:event.key==='End'?banners.length-1:null;
      if(target!==null){event.preventDefault();move(target);}
    }}>
      {banners.map((row,i)=>{
        const image=failedImages.has(row.id)?null:publicCommunicationUrl(row.image_url),cta=publicCommunicationUrl(row.cta_url,'link'),summary=communicationExcerpt(row.title,row.subtitle);
        return <article key={row.id} data-banner-id={row.id} data-with-image={image?'true':'false'} role="group" aria-label={copy.slide(i+1,banners.length)} inert={i!==index}>
          {image?<Image src={image} alt={row.title} width={640} height={480} unoptimized className="v4-offer-image" onError={()=>setFailedImages(previous=>new Set(previous).add(row.id))}/>:null}
          <div className="v4-offer-content"><p className="v4-communication-category"><Tag aria-hidden/>{copy.promotion}</p><h3>{row.title}</h3>
            {summary?<p className="v4-communication-summary">{summary}</p>:null}
            {row.ends_at?<p className="v4-communication-period">{copy.until} {new Intl.DateTimeFormat(language,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(row.ends_at))}</p>:null}
            {cta?<a href={cta} target="_blank" rel="noopener noreferrer" data-analytics-event="website_click" data-analytics-label={row.title}>{row.cta_label||copy.more}<ArrowUpRight aria-hidden/></a>:null}
          </div>
        </article>;
      })}
    </div>
    {multiple?<div className="v4-carousel-controls" role="group" aria-label={copy.carousel}>
      <button type="button" aria-label={copy.previous} aria-controls={trackId} disabled={index===0} onClick={()=>move(index-1)}><ChevronLeft aria-hidden/></button>
      <div className="v4-carousel-dots">{banners.map((row,i)=><button type="button" key={row.id} aria-label={copy.slide(i+1,banners.length)} aria-controls={trackId} aria-current={i===index?'true':undefined} onClick={()=>move(i)}><span aria-hidden/></button>)}</div>
      <span className="v4-carousel-position" aria-live="polite" aria-atomic="true">{index+1} / {banners.length}</span>
      <button type="button" aria-label={copy.next} aria-controls={trackId} disabled={index===banners.length-1} onClick={()=>move(index+1)}><ChevronRight aria-hidden/></button>
    </div>:null}
  </section>;
}
