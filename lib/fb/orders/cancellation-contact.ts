import {publishedContactPhones} from '../../contact-phones.ts';
export interface ContactSource {label:string;description:string|null;url:string|null}
export interface CancellationContact {label:string;phone:string;href:string;source:'service'|'department'}
export function cancellationContact(sources:{specific:ContactSource|null;departments:ContactSource[]}):CancellationContact|null{
 const food=/(room\s*service|restaurante?|gastronom|food|beverage|servi[cç]o.*quarto|servicio.*habita)/i;
 const reception=/(recep[cç]|reception|front.?desk|contato geral|general contact|contacto general)/i;
 const candidates=[...(sources.specific?[{...sources.specific,source:'service' as const}]:[]),...sources.departments.filter(d=>food.test(d.label)).map(d=>({...d,source:'department' as const})),...sources.departments.filter(d=>reception.test(d.label)).map(d=>({...d,source:'department' as const}))];
 for(const c of candidates){const direct=c.url?.match(/^tel:(\+[1-9][0-9 ()\-.]{6,24}[0-9])$/);const number=direct?.[1].replace(/[^+0-9]/g,'');const phone=number&&/^\+[1-9]\d{7,14}$/.test(number)?{label:direct![1],href:'tel:'+number}:publishedContactPhones(c.description,c.url)[0];if(phone)return {label:c.label,phone:phone.label,href:phone.href,source:c.source};}
 return null;
}
