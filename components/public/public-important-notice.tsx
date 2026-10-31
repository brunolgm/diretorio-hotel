"use client";
import {useSyncExternalStore} from 'react';
import {AlertTriangle,ArrowRight,X} from 'lucide-react';
import {communicationCopy,communicationExcerpt} from '@/lib/public-communications';
import {publicNoticeKey,dismissedNoticeKeys} from '@/lib/public-notice-view';
import type {PublicHotelAnnouncement} from '@/lib/public-hotel-data';
const storageKey='libguest.notice.dismiss.v1',eventName='libguest:notice-dismissed';let memory='';
function snapshot(){try{return localStorage.getItem(storageKey)??memory;}catch{return memory;}}
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener(eventName,listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener);};}
const serverSnapshot=()=>'';
export function PublicImportantNotice({rows,language,announcementsHref}:{rows:PublicHotelAnnouncement[];language:'pt'|'en'|'es';announcementsHref:string}){
 const raw=useSyncExternalStore(subscribe,snapshot,serverSnapshot),dismissed=dismissedNoticeKeys(raw),visible=rows.filter(row=>!dismissed.includes(publicNoticeKey(row))),row=visible[0],copy=communicationCopy(language);
 if(!row)return null;
 const excerpt=communicationExcerpt(row.title,row.body);
 function dismiss(){memory=JSON.stringify([...dismissed,publicNoticeKey(row)].slice(-50));try{localStorage.setItem(storageKey,memory);}catch{}window.dispatchEvent(new Event(eventName));requestAnimationFrame(()=>{Array.from(document.querySelectorAll<HTMLElement>('[data-v4-alerts] a,[data-v3-accesses] a,.public-v4-tasks a')).find(el=>el.getClientRects().length)?.focus();});}
 return <aside className="v4-attention" aria-label={copy.important} data-v4-alerts data-important-count={visible.length}>
  <div className="v4-important-row" data-important-notice data-notice-category={row.category}>
   <AlertTriangle aria-hidden/><div className="v4-important-copy"><strong className="v4-important-category">{copy.importantLabel}</strong><p>{row.title}{excerpt?<>{row.title?' — ':''}{excerpt}</>:null}</p></div>
   <a className="v4-important-read" href={announcementsHref+'#announcement-'+row.id} aria-label={copy.details+': '+row.title}><span className="v4-important-details-label">{copy.details}</span><ArrowRight aria-hidden/></a>
   {visible.length>1?<a className="v4-important-more" href={announcementsHref}>{copy.otherNotices(visible.length-1)}</a>:null}
   <button type="button" className="v4-important-close" aria-label={copy.dismiss} onClick={dismiss}><X aria-hidden/></button>
  </div>
 </aside>;
}
