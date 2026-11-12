import type {PanelOrder} from '../orders/operations';

export const KDS_STATES = ['registered','accepted','preparing','ready','out_for_delivery','delivered'] as const;
export const KDS_STATUS_LABELS:Record<string,string>={registered:'Novos pedidos',accepted:'Aceitos',preparing:'Em preparo',ready:'Prontos',out_for_delivery:'Em entrega',delivered:'Concluídos',cancelled:'Cancelados'};
export interface KdsSettings {
 layout:'kanban'|'compact'|'tickets'; theme:'dark'|'light'; contrast:boolean; font_size:number; ticket_limit:number;
 sort:'oldest'|'newest'; states:string[]; show_code:boolean; show_items:boolean; attention_minutes:number|null; critical_minutes:number|null; sound:boolean;
}
export const DEFAULT_KDS_SETTINGS:KdsSettings={layout:'kanban',theme:'dark',contrast:false,font_size:20,ticket_limit:24,sort:'oldest',states:['registered','accepted','preparing','ready','out_for_delivery'],show_code:true,show_items:true,attention_minutes:null,critical_minutes:null,sound:false};
export interface KdsScreen {id:string;hotel_id:string;name:string;location:string;mode:'monitor'|'operational'|'dispatch';active:boolean;revision:number;sector_ids:string[];settings:KdsSettings;device_name:string|null;last_seen_at:string|null;paired:boolean}
export interface KdsAdmin {hotel_id:string;hotel_name:string;screens:KdsScreen[];sectors:{id:string;name:string}[]}
export interface KdsTicket {id:string;order_id:string;sector_id:string;sector_name:string;status:string;revision:number;created_at:string;fulfilment:string;can_transition:boolean;lines:{id:string;name:string;quantity:number;options:string[]}[]}
export interface KdsSnapshot {screen:KdsScreen;hotel_name:string;tickets:KdsTicket[];total:number;updated_at:string}
export function elapsedMinutes(created:string,now:number){return Math.max(0,Math.floor((now-Date.parse(created))/60000));}
export function alertLevel(minutes:number,settings:KdsSettings){return settings.critical_minutes!==null&&minutes>=settings.critical_minutes?'critical':settings.attention_minutes!==null&&minutes>=settings.attention_minutes?'attention':'normal';}
export function orderMatches(order:PanelOrder,filters:{q:string;sector:string;status:string;since:string},now:number){
 return (!filters.q||[order.order_id,...order.lines.map(l=>l.name)].join(' ').toLocaleLowerCase('pt-BR').includes(filters.q.trim().toLocaleLowerCase('pt-BR')))
 &&(!filters.sector||order.groups.some(g=>g.sector_id===filters.sector))&&(!filters.status||order.groups.some(g=>(!filters.sector||g.sector_id===filters.sector)&&g.status===filters.status))
 &&(!filters.since||Date.parse(order.created_at)>=now-Number(filters.since)*3600000);
}
