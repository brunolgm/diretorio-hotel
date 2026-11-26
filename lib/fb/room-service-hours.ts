import type {Language,RoomServiceHours} from './orders/journey';

export function parseRoomServiceHours(value:unknown):RoomServiceHours|undefined {
  if(!value||typeof value!=='object')return;
  const row=value as RoomServiceHours;
  if(typeof row.timezone!=='string'||!Number.isInteger(row.start_minute)||!Number.isInteger(row.end_minute)
    ||row.start_minute<0||row.end_minute>1439||row.end_minute<=row.start_minute
    ||typeof row.outside_regular_hours!=='boolean'||row.reopens_at!==null&&(typeof row.reopens_at!=='string'||!Number.isFinite(Date.parse(row.reopens_at))))return;
  try{new Intl.DateTimeFormat('en',{timeZone:row.timezone}).format(0);}catch{return;}
  return row;
}

function time(minute:number,language:Language){
  const hour=Math.floor(minute/60),part=minute%60,mm=String(part).padStart(2,'0');
  return language==='pt'?hour+'h'+(part?mm:''):language==='en'?(hour%12||12)+':'+mm+' '+(hour<12?'AM':'PM'):hour+':'+mm;
}

/** Display server facts only; the guest device clock never controls this message. */
export function roomServiceHoursCopy(hours:RoomServiceHours,language:Language,available:boolean){
  const start=time(hours.start_minute,language),end=time(hours.end_minute,language);
  const closed=!available&&hours.outside_regular_hours;
  let reopening:string|undefined;
  if(closed&&hours.reopens_at){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:hours.timezone,hourCycle:'h23',hour:'numeric',minute:'numeric'}).formatToParts(new Date(hours.reopens_at));
    const hour=Number(parts.find(part=>part.type==='hour')?.value),minute=Number(parts.find(part=>part.type==='minute')?.value);
    reopening=time(hour*60+minute,language);
  }
  const copy={
    pt:{hours:`Todos os dias, das ${start} às ${end}.`,closed:'Room Service fechado.',reopens:reopening?`Reabre às ${reopening}.`:''},
    en:{hours:`Daily, ${start}–${end}.`,closed:'Room Service is closed.',reopens:reopening?`Reopens at ${reopening}.`:''},
    es:{hours:`Todos los días, de ${start} a ${end}.`,closed:'Room Service cerrado.',reopens:reopening?`Reabre a las ${reopening}.`:''},
  }[language];
  return {hours:copy.hours,notice:closed?[copy.closed,copy.reopens].filter(Boolean).join(' '):null};
}
