import type {Language,RoomServiceHours} from '@/lib/fb/orders/journey';
import {roomServiceHoursCopy} from '@/lib/fb/room-service-hours';

export function SmartMenuHours({hours,language,available}:{hours?:RoomServiceHours;language:Language;available:boolean}){
  if(!hours)return null;
  const copy=roomServiceHoursCopy(hours,language,available);
  return <div className="smartmenu-hours" data-smartmenu-hours>
    <p>{copy.hours}</p>
    {copy.notice?<p role="status" className="smartmenu-hours-notice">{copy.notice}</p>:null}
  </div>;
}
