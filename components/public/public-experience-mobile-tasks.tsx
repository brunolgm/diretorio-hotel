import {FlightHomeAccess} from './home-saved-flight';
import type { CSSProperties } from 'react';
import { Wifi, Coffee, Clock3, ChevronDown, ChevronRight, ConciergeBell, Utensils, Plane, MessageCircle } from 'lucide-react';
import {getPublicEssentials} from '@/lib/public-essentials';
import {getPublicCopy} from '@/lib/public-copy';
import {getUniversalMobileHome} from '@/lib/public-experience-v4';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {SupportedPublicLanguage} from '@/lib/public-language';

export function PublicExperienceMobileTasks({pageData,language,domainContext,preferSubdomainRoot,style,desktopEssentials=false}:{pageData:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean;style?:CSSProperties;desktopEssentials?:boolean}){
 const copy=getPublicCopy(language),model=getUniversalMobileHome(pageData,language,domainContext,preferSubdomainRoot);
 const actions={services:{label:copy.navigationServices,icon:ConciergeBell},dining:{label:copy.universalDining,icon:Utensils},flights:{label:copy.universalFlights,icon:Plane},contact:{label:copy.universalContact,icon:MessageCircle}};
 const compact=desktopEssentials&&pageData.hotel.theme_preset==='bugan';
 const periods=compact?getPublicEssentials(pageData,language).breakfastPeriods:[];
 const connect={pt:'Como conectar',en:'How to connect',es:'Cómo conectarse'}[language];
 const hasEssentials=model.wifi||model.breakfast||model.checkin||model.checkout;
 if(!hasEssentials&&!model.actions.length)return null;
 return <div className="public-v4-mobile-home" style={style} data-public-v4-mobile data-compact-home={compact?true:undefined} data-desktop-essentials={desktopEssentials?true:undefined}>
  {hasEssentials?<section aria-label={copy.universalEssentialsTitle} className="public-v4-essentials">
   <h2>{copy.universalEssentialsTitle}</h2><div className="public-v4-essential-grid">
    {model.wifi?<details className="public-v4-wifi"><summary><Wifi aria-hidden/><span><strong>{copy.wifi}</strong><span>{model.wifi.name}</span></span><ChevronDown aria-hidden className="public-v4-disclosure"/></summary><div className="public-v4-instructions"><h3>{copy.universalWifiInstructions}</h3>{model.wifi.instructions?<p>{model.wifi.instructions}</p>:null}{model.wifi.password?<p>{copy.passwordLabel(model.wifi.password)}</p>:!model.wifi.instructions?<p>{copy.askFrontDesk}</p>:null}</div></details>:null}
    {model.breakfast?<details className="public-v4-breakfast"><summary><Coffee aria-hidden/><span><strong>{copy.breakfast}</strong><span>{copy.universalViewHours}</span></span><ChevronDown aria-hidden className="public-v4-disclosure"/></summary><p className="public-v4-instructions">{model.breakfast}</p></details>:null}
    {model.checkin||model.checkout?<div className="public-v4-stay-hours"><h3><Clock3 aria-hidden/>{copy.universalStayHours}</h3><dl>{model.checkin?<div><dt>{copy.checkIn}</dt><dd>{model.checkin}</dd></div>:null}{model.checkout?<div><dt>{copy.checkOut}</dt><dd>{model.checkout}</dd></div>:null}</dl></div>:null}
   </div>
   {compact?<div className="public-v4-compact-grid">
    {model.wifi?<div className="public-v4-compact-group"><Wifi aria-hidden/><div><h3>{copy.wifi}</h3><p>{model.wifi.name}</p><details className="public-v4-compact-wifi"><summary>{connect}<ChevronDown aria-hidden/></summary><div className="public-v4-instructions">{model.wifi.instructions?<p>{model.wifi.instructions}</p>:null}{model.wifi.password?<p>{copy.passwordLabel(model.wifi.password)}</p>:!model.wifi.instructions?<p>{copy.askFrontDesk}</p>:null}</div></details></div></div>:null}
    {model.breakfast?<div className="public-v4-compact-group"><Coffee aria-hidden/><div><h3>{copy.breakfast}</h3>{periods.length?<dl>{periods.map(p=><div key={p.days}><dt>{p.days}</dt><dd>{p.hours}</dd></div>)}</dl>:<p className="public-v4-compact-breakfast">{model.breakfast}</p>}</div></div>:null}
    {model.checkin||model.checkout?<div className="public-v4-compact-group"><Clock3 aria-hidden/><div><h3>{copy.universalStayHours}</h3><dl className="public-v4-compact-hours">{model.checkin?<div><dt>{copy.checkIn}</dt><dd>{model.checkin}</dd></div>:null}{model.checkout?<div><dt>{copy.checkOut}</dt><dd>{model.checkout}</dd></div>:null}</dl></div></div>:null}
   </div>:null}
  </section>:null}
  {model.actions.length?<section aria-label={copy.universalTasksTitle} className="public-v4-tasks"><h2>{copy.universalTasksTitle}</h2><nav aria-label={copy.universalTasksTitle}>{model.actions.map(action=>{const item=actions[action.key],Icon=item.icon;return action.key==='flights'?<FlightHomeAccess key={action.key} hotelId={pageData.hotel.id} href={action.href} language={language} enabled={domainContext.navigationScope!=='authenticated-preview'} label={item.label} icon={<Icon aria-hidden/>} arrow={<ChevronRight aria-hidden className="public-v4-action-arrow"/>} action={action.key}/>:<a key={action.key} href={action.href} data-v4-action={action.key}><Icon aria-hidden/><span>{item.label}</span><ChevronRight aria-hidden className="public-v4-action-arrow"/></a>;})}</nav></section>:null}
 </div>;
}
