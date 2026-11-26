import {AlertTriangle,Wrench,Info,Tag} from 'lucide-react';
import {eligibleAnnouncementRows,communicationCopy} from '@/lib/public-communications';
import type {PublicHotelAnnouncement} from '@/lib/public-hotel-data';
import type {SupportedPublicLanguage} from '@/lib/public-language';
export function PublicAnnouncementDirectory({hotelId,rows,language}:{hotelId:string;rows:PublicHotelAnnouncement[];language:SupportedPublicLanguage}){
 const copy=communicationCopy(language);
 const eligible=eligibleAnnouncementRows(hotelId,rows,true);
 const labels=language==='en'?{alert:'Important alerts',maintenance:'Maintenance',information:'Information',promotion:'Promotions and news',empty:'No current announcements',emptyDetail:'When the hotel publishes new announcements, you can find them here.'}:language==='es'?{alert:'Alertas importantes',maintenance:'Mantenimiento',information:'Informativos',promotion:'Promociones y novedades',empty:'No hay comunicados vigentes',emptyDetail:'Los nuevos comunicados del hotel aparecerán aquí.'}:{alert:'Alertas importantes',maintenance:'Manutenções',information:'Informativos',promotion:'Promoções e novidades',empty:'Nenhum comunicado vigente',emptyDetail:'Os novos comunicados do hotel aparecerão aqui.'};
 const groups=[{key:'alerta',label:labels.alert,Icon:AlertTriangle},{key:'manutencao',label:labels.maintenance,Icon:Wrench},{key:'informativo',label:labels.information,Icon:Info},{key:'promocao',label:labels.promotion,Icon:Tag}].map(group=>({...group,items:eligible.filter(row=>row.category===group.key)})).filter(group=>group.items.length);
 if(!groups.length)return <div className="public-communication-empty" data-communication-empty><Info aria-hidden/><h2>{labels.empty}</h2><p>{labels.emptyDetail}</p></div>;
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
