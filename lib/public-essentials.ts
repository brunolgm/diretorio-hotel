import type {PublicHotelPageData} from './public-hotel-data';
import type {SupportedPublicLanguage} from './public-language';
const dayLabels={pt:['Segunda a sexta','Sábados, domingos e feriados'],en:['Monday to Friday','Saturdays, Sundays and public holidays'],es:['Lunes a viernes','Sábados, domingos y festivos']};
/** Known day groups only; unrecognised editorial schedules remain verbatim. */
export function breakfastPeriods(value:string|null|undefined,language:SupportedPublicLanguage){
 if(!value?.trim())return [];
 const periods=value.split(/[;\n]+/).map(s=>s.trim()).filter(Boolean).map(part=>{
  const time=part.match(/(\d{1,2}[:h]\d{2})\s*[–—-]\s*(\d{1,2}[:h]\d{2})\s*$/);
  if(!time||time.slice(1).some(t=>{const [h,m]=t.split(/[:h]/).map(Number);return h>23||m>59;}))return null;
  const days=part.slice(0,time.index).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—-]/g,'-').trim();
  const group=/^(seg(?:unda)?\s*(?:-feira)?\s*(?:-|a)\s*sex(?:ta)?(?:-feira)?|monday to friday|lunes a viernes)$/.test(days)?0:/^(sabados?,\s*domingos?\s*e\s*feriados|saturdays, sundays and public holidays|sabados, domingos y festivos)$/.test(days)?1:null;
  return group===null?null:{days:dayLabels[language][group],hours:`${time[1].replace('h',':')}–${time[2].replace('h',':')}`};
 });
 return periods.every(p=>p!==null)?periods:[];
}
/** Same tenant-filtered, translated source used by the approved Home. */
export function getPublicEssentials(data:PublicHotelPageData,language:SupportedPublicLanguage){
 const enabled=(key:string)=>data.layout.some(b=>b.blockKey===key&&b.isEnabled);
 const sections=data.sections.filter(s=>s.hotel_id===data.hotel.id&&s.enabled);
 const wifi=enabled('quick_info')&&data.hotel.wifi_name?.trim()?{name:data.hotel.wifi_name,password:data.hotel.wifi_password?.trim()||null,instructions:enabled('services')?sections.find(s=>s.icon==='Wifi'&&s.content?.trim())?.content??null:null}:null;
 const raw=enabled('quick_info')?data.hotel.breakfast_hours?.trim()||null:null,periods=breakfastPeriods(raw,language);
 return {wifi,breakfast:periods.length?periods.map(p=>`${p.days}: ${p.hours}`).join('; '):raw,breakfastPeriods:periods,checkin:enabled('quick_info')?data.hotel.checkin_time?.trim()||null:null,checkout:enabled('quick_info')?data.hotel.checkout_time?.trim()||null:null};
}
