'use client';

import {useState} from 'react';
import Image from 'next/image';
import {Plane} from 'lucide-react';
import {getAirlineLogo,type AirlineIdentity} from '@/lib/airline-identity';

/** Fixed geometry for both the official local mark and the existing airplane fallback. */
export function AirlineLogo({airline}:{airline:AirlineIdentity|null}){
 const logo=getAirlineLogo(airline);
 const [failedSrc,setFailedSrc]=useState<string|null>(null);
 const available=logo&&failedSrc!==logo.src;
 return <div data-airline-mark={available?airline?.code:'fallback'} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[19px] ${available?'bg-white':'bg-[var(--hotel-accent-soft)] text-[color:var(--hotel-accent)]'}`}>
  {available?<Image key={logo.src} src={logo.src} width={logo.width} height={logo.height} alt={airline!.shortName} unoptimized className="h-auto max-h-12 w-12 object-contain" onError={()=>setFailedSrc(logo.src)}/>:<Plane className="h-7 w-7" aria-hidden="true"/>}
 </div>;
}
