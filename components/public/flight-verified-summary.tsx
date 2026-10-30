import { Clock3, DoorOpen, Radio, Plane } from 'lucide-react';
import type { FlightDisplay } from '@/lib/guest-flight-status';
import { getPremiumFlightCopy, getPublicFlightCenterCopy } from '@/lib/public-flight-center-copy';
import type { SupportedPublicLanguage } from '@/lib/public-language';

/** Shared V4 presentation of the existing closed provider projection. No network. */
export function FlightVerifiedSummary({data,language,timezone,stale}:{
  data:FlightDisplay;language:SupportedPublicLanguage;timezone:string|null;stale:boolean;
}){
  const copy=getPublicFlightCenterCopy(language).flightData,premium=getPremiumFlightCopy(language);
  const date=(value:string)=>new Intl.DateTimeFormat(language,{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));
  const stamp=(value:string)=>new Intl.DateTimeFormat(language,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:timezone??'UTC'}).format(new Date(value));
  const times=[{label:copy.scheduled,value:data.scheduled},{label:copy.estimated,value:data.estimated},{label:copy.actual,value:data.actual}].filter((row):row is {label:string;value:string}=>Boolean(row.value));
  return <div className="flight-verified-summary">
    <div className="flight-verification-heading">
      <p className="flight-verification-level">{data.live&&data.status==='inFlight'?premium.liveVerified:premium.scheduleVerified}</p>
      <p className="flight-status-badge" data-flight-operational-status data-state={data.status}><Plane aria-hidden="true"/>{copy.statuses[data.status]}</p>
    </div>
    <dl className="flight-time-facts">{times.map(({label,value})=><div key={label}>
      <dt><Clock3 aria-hidden="true"/>{label}</dt><dd><strong>{value.slice(11,16)}</strong>{label===copy.scheduled||value.slice(0,10)!==data.scheduled.slice(0,10)?<span>{date(value)}</span>:null}</dd>
    </div>)}</dl>
    <dl className="flight-location-facts">
      <div><dt><DoorOpen aria-hidden="true"/>{copy.terminal}</dt><dd>{data.terminal??'—'}</dd></div>
      <div><dt><DoorOpen aria-hidden="true"/>{copy.gate}</dt><dd>{data.gate??'—'}</dd></div>
    </dl>
    <div className="flight-provenance"><Radio aria-hidden="true"/><div>
      {data.consultedAt?<p data-flight-consulted>{premium.consulted}: <time dateTime={data.consultedAt}>{stamp(data.consultedAt)}</time> · {copy.source}</p>:<p>{copy.source}</p>}
      {data.sourceUpdatedAt?<p data-flight-source-updated>{premium.sourceUpdated}: <time dateTime={data.sourceUpdatedAt}>{stamp(data.sourceUpdatedAt)}</time></p>:null}
      <p>{copy.local}</p>{stale?<p role="status">{premium.stale}</p>:null}
    </div></div>
  </div>;
}
