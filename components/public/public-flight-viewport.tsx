'use client';
import {useEffect} from 'react';

/** The soft keyboard may resize only the visual viewport, leaving 100dvh unchanged. */
export function PublicFlightViewport(){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('main[data-flight-viewport]'),viewport=window.visualViewport;
  if(!root||!viewport)return;
  const update=()=>{
   root.style.setProperty('--public-flight-viewport-height',`${viewport.height}px`);
   const active=document.activeElement;
   if(viewport.height<window.innerHeight-80&&active instanceof HTMLElement&&root.contains(active)&&active.matches('input,select,textarea')){
    requestAnimationFrame(()=>active.scrollIntoView({block:'center',inline:'nearest'}));
   }
  };
  update();viewport.addEventListener('resize',update);
  return ()=>{viewport.removeEventListener('resize',update);root.style.removeProperty('--public-flight-viewport-height');};
 },[]);
 return null;
}
