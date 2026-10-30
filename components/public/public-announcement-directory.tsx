import {AlertTriangle,Wrench,Info,Tag} from 'lucide-react';
import {communicationEligible,communicationCopy} from '@/lib/public-communications';
import type {PublicHotelAnnouncement} from '@/lib/public-hotel-data';
import type {SupportedPublicLanguage} from '@/lib/public-language';
export function PublicAnnouncementDirectory({hotelId,rows,language}:{hotelId:string;rows:PublicHotelAnnouncement[];language:SupportedPublicLanguage}){
 const copy=communicationCopy(language);
 const groups=[{key:'alerta',label:copy.alert,Icon:AlertTriangle},{key:'manutencao',label:copy.maintenance,Icon:Wrench},{key:'informativo',label:copy.information,Icon:Info},{key:'promocao',label:copy.promotion,Icon:Tag}].map(group=>({...group,items:rows.filter(row=>row.category===group.key&&communicationEligible(row,hotelId))})).filter(group=>group.items.length);
 if(!groups.length)return null;
 return <div className="public-communication-directory" data-communication-directory>
  {groups.length>1?<nav className="public-internal-anchors" aria-label={copy.all}>{groups.map(g=><a key={g.key} href={'#communication-category-'+g.key}><g.Icon aria-hidden/>{g.label}<span>{g.items.length}</span></a>)}</nav>:null}
  {groups.map(({key,label,Icon,items})=><section key={key} id={'communication-category-'+key} data-communication-category={key}>
   <h2 className="public-communication-group"><Icon aria-hidden/>{label}</h2><div className="public-communication-grid">{items.map(row=><article key={row.id} id={'announcement-'+row.id}>
    <div className="public-communication-icon"><Icon aria-hidden/></div><div><p className="public-communication-category">{label}</p><h3>{row.title}</h3>
     {row.starts_at||row.ends_at?<p className="public-communication-period">{[row.starts_at,row.ends_at].filter(Boolean).map(date=>new Intl.DateTimeFormat(language,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date!))).join(' — ')}</p>:null}
     {row.body?<p className="public-communication-body">{row.body}</p>:null}</div>
   </article>)}</div>
  </section>)}
 </div>;
}
