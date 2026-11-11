'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Commissioning} from '@/lib/fb/printing/commissioning';

export function usePrintingCommissioning(enabled:boolean,accessSignature:string){
 const [data,setData]=useState<Commissioning|null>(null),[stale,setStale]=useState(true),[dataSignature,setDataSignature]=useState('');
 const scope=useRef(accessSignature);
 const epoch=useRef(0),active=useRef(true),controller=useRef<AbortController|null>(null);
 const cancel=useCallback(()=>{epoch.current++;controller.current?.abort();},[]);
 const refresh=useCallback(async()=>{
  if(scope.current!==accessSignature)return;
  const version=++epoch.current;controller.current?.abort();
  if(!enabled||document.hidden||!navigator.onLine)return;
  const c=new AbortController();controller.current=c;
  try{const r=await fetch('/api/admin/fb-printing/commissioning',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])});
   if(!r.ok)throw Error('unavailable');const next:Commissioning=await r.json();
   if(active.current&&version===epoch.current&&!c.signal.aborted&&scope.current===accessSignature){setData(next);setDataSignature(accessSignature);setStale(false);}
  }catch{if(active.current&&version===epoch.current){setData(null);setStale(true);}}
 },[enabled,accessSignature]);
 useEffect(()=>{scope.current=accessSignature;active.current=true;const invalidate=()=>{cancel();setData(null);setStale(true);};
  const resume=()=>document.hidden||!navigator.onLine?invalidate():void refresh();
  const initial=setTimeout(()=>void refresh(),0);const timer=setInterval(()=>{if(!document.hidden&&navigator.onLine)void refresh();},15000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('offline',resume);window.addEventListener('online',resume);
  return()=>{active.current=false;cancel();clearTimeout(initial);clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('offline',resume);window.removeEventListener('online',resume);};
 },[refresh,accessSignature,cancel]);
 return {actorId:enabled?data?.actor_id:undefined,data:enabled&&dataSignature===accessSignature?data:null,stale:stale||dataSignature!==accessSignature,refresh};
}
