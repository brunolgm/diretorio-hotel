import type { CSSProperties } from 'react';
import { Wifi, Coffee, Clock3, ChevronDown, ChevronRight, ConciergeBell, Utensils, Plane, MessageCircle } from 'lucide-react';
import {getPublicCopy} from '@/lib/public-copy';
import {getUniversalMobileHome} from '@/lib/public-experience-v4';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {SupportedPublicLanguage} from '@/lib/public-language';

export function PublicExperienceMobileTasks({pageData,language,domainContext,preferSubdomainRoot,style}:{pageData:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean;style?:CSSProperties}){
 const copy=getPublicCopy(language),model=getUniversalMobileHome(pageData,language,domainContext,preferSubdomainRoot);
 const actions={services:{label:copy.navigationServices,icon:ConciergeBell},dining:{label:copy.universalDining,icon:Utensils},flights:{label:copy.universalFlights,icon:Plane},contact:{label:copy.universalContact,icon:MessageCircle}};
 const hasEssentials=model.wifi||model.breakfast||model.checkin||model.checkout;
 if(!hasEssentials&&!model.actions.length)return null;
 return <div className="public-v4-mobile-home" style={style} data-public-v4-mobile>
  {hasEssentials?<section aria-label={copy.universalEssentialsTitle} className="public-v4-essentials">
   <h2>{copy.universalEssentialsTitle}</h2><div className="public-v4-essential-grid">
    {model.wifi?<details className="public-v4-wifi"><summary><Wifi aria-hidden/><span><strong>{copy.wifi}</strong><span>{model.wifi.name}</span></span><ChevronDown aria-hidden className="public-v4-disclosure"/></summary><div className="public-v4-instructions"><h3>{copy.universalWifiInstructions}</h3>{model.wifi.instructions?<p>{model.wifi.instructions}</p>:null}{model.wifi.password?<p>{copy.passwordLabel(model.wifi.password)}</p>:!model.wifi.instructions?<p>{copy.askFrontDesk}</p>:null}</div></details>:null}
    {model.breakfast?<details className="public-v4-breakfast"><summary><Coffee aria-hidden/><span><strong>{copy.breakfast}</strong><span>{copy.universalViewHours}</span></span><ChevronDown aria-hidden className="public-v4-disclosure"/></summary><p className="public-v4-instructions">{model.breakfast}</p></details>:null}
    {model.checkin||model.checkout?<div className="public-v4-stay-hours"><h3><Clock3 aria-hidden/>{copy.universalStayHours}</h3><dl>{model.checkin?<div><dt>{copy.checkIn}</dt><dd>{model.checkin}</dd></div>:null}{model.checkout?<div><dt>{copy.checkOut}</dt><dd>{model.checkout}</dd></div>:null}</dl></div>:null}
   </div>
  </section>:null}
  {model.actions.length?<section aria-label={copy.universalTasksTitle} className="public-v4-tasks"><h2>{copy.universalTasksTitle}</h2><nav aria-label={copy.universalTasksTitle}>{model.actions.map(action=>{const item=actions[action.key],Icon=item.icon;return <a key={action.key} href={action.href} data-v4-action={action.key}><Icon aria-hidden/><span>{item.label}</span><ChevronRight aria-hidden className="public-v4-action-arrow"/></a>;})}</nav></section>:null}
 </div>;
}
