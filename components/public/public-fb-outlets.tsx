'use client';
import {useEffect,useRef,useSyncExternalStore,type MouseEvent} from 'react';
import {FbCatalog} from './fb-catalog';
import {fbCatalogCount} from '@/lib/fb/public-copy';
import Image from 'next/image';
import {ConciergeBell,UtensilsCrossed,Leaf} from 'lucide-react';
import type {FbOutlet,FbMenu,FbCategory,FbItem} from '@/lib/fb/types';
import type {Language,NativeOutlet} from '@/lib/fb/orders/journey';
type OutletPresentation={outlet:FbOutlet;native?:NativeOutlet;image:string|null;destination:{href:string;kind:string}|null;menus:FbMenu[];categories:FbCategory[];items:(FbItem&{image:string|null;price:string|null})[]};
import { NativeOrderingOutlet } from './native-ordering-outlet';
const subscribeOutlet=(listener:()=>void)=>{window.addEventListener('hashchange',listener);window.addEventListener('popstate',listener);return()=>{window.removeEventListener('hashchange',listener);window.removeEventListener('popstate',listener);};};
const outletHash=()=>window.location.hash;
const serverHash=()=>'';

export function PublicFbOutlets({outlets,language,slug,hasRoomContext,premium,premiumLayout=false}:{outlets:OutletPresentation[];language:Language;slug:string;hasRoomContext:boolean;premium:boolean;premiumLayout?:boolean}) {
  const root=useRef<HTMLDivElement>(null);
  const hash=useSyncExternalStore(subscribeOutlet,outletHash,serverHash);
  useEffect(()=>{const article=Array.from(root.current?.querySelectorAll('article[id]')??[]).find(el=>'#'+el.id===hash);const details=article?.querySelector('.fb-editorial-outlet>details');if(details instanceof HTMLDetailsElement)details.open=true;if(premiumLayout&&hash.startsWith('#outlet-'))window.scrollTo({top:0});else if(!premiumLayout)article?.scrollIntoView({block:'start'});},[hash,premiumLayout]);
  function chooseOutlet(event:MouseEvent<HTMLAnchorElement>){
   if(!premiumLayout||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();if(event.currentTarget.hash!==window.location.hash){window.history.pushState(null,'',event.currentTarget.href);window.dispatchEvent(new HashChangeEvent('hashchange'));}
  }
  const graph = {outlets:outlets.map(row=>row.outlet)};
  const t = language === 'en' ? {empty:'No dining options published yet.',menus:'Menus',open:'Open configured channel',allergens:'Allergens',dietary:'Dietary information',featured:'Featured',types:{restaurant:'Restaurant',bar:'Bar',room_service:'Room Service',breakfast:'Breakfast',cafe:'Café',other:'Other'}} : language === 'es' ? {empty:'Aún no hay opciones gastronómicas publicadas.',menus:'Menús',open:'Abrir canal configurado',allergens:'Alérgenos',dietary:'Información alimentaria',featured:'Destacado',types:{restaurant:'Restaurante',bar:'Bar',room_service:'Room Service',breakfast:'Desayuno',cafe:'Café',other:'Otro'}} : {empty:'Nenhuma opção gastronômica publicada ainda.',menus:'Cardápios',open:'Abrir canal configurado',allergens:'Alergênicos',dietary:'Informações alimentares',featured:'Destaque',types:{restaurant:'Restaurante',bar:'Bar',room_service:'Room Service',breakfast:'Café da manhã',cafe:'Café',other:'Outro'}};
  if (!graph?.outlets.length) return <p className="p-6 text-[var(--hotel-text-muted)]">{t.empty}</p>;
  const selected=graph.outlets.find(o=>hash==='#outlet-'+o.id)?.id??(premiumLayout?graph.outlets[0]?.id:undefined);
  const current=outlets.find(row=>row.outlet.id===selected)??outlets[0];
  const canOrder=Boolean(current.native?.available&&!current.native.hidden&&current.native.products.some(p=>p.available)&&(current.native.pickup||current.native.room_delivery&&hasRoomContext));
  const context={pt:{consult:'Consulta de cardápio',order:'Pedidos disponíveis',menu:'Cardápio para consulta',categories:'categorias',items:'itens'},en:{consult:'View menu',order:'Ordering available',menu:'Menu for browsing',categories:'categories',items:'items'},es:{consult:'Consulta de menú',order:'Pedidos disponibles',menu:'Menú para consulta',categories:'categorías',items:'productos'}}[language];
  const countItems=current.native?current.native.products:current.items;
  const countCategories=new Set(countItems.map(i=>i.category_id));
  return <>{premiumLayout?<div className="fb-outlet-bar"><nav className="fb-outlet-options" aria-label={t.menus}>{outlets.map(({outlet,native})=>{const Icon=outlet.type==='room_service'?ConciergeBell:UtensilsCrossed;const order=Boolean(native?.available&&!native.hidden&&native.products.some(p=>p.available)&&(native.pickup||native.room_delivery&&hasRoomContext));return <div key={outlet.id} className="fb-outlet-option"><a onClick={chooseOutlet} href={'#outlet-'+outlet.id} aria-current={selected===outlet.id?'page':undefined}><Icon aria-hidden/><span>{outlet.name}</span></a><small>{order?context.order:context.consult}</small></div>;})}</nav><p className="fb-outlet-summary"><span>{canOrder?context.order:context.menu}</span><span>{fbCatalogCount(countCategories.size,'category',language)} · {fbCatalogCount(countItems.length,'item',language)}</span></p></div>:<nav className="fb-catalog-filters" aria-label={t.menus}><a className="min-h-11 content-center px-3 underline" href="#outlets" aria-current={!selected?'page':undefined}>{t.menus}</a>{graph.outlets.map(o=><a className="min-h-11 content-center rounded-xl border border-[var(--hotel-border)] px-4" href={'#outlet-'+o.id} key={o.id} aria-current={selected===o.id?'page':undefined}>{o.name}</a>)}</nav>}<div ref={root} data-fb-native className="grid min-w-0 items-start gap-5 md:grid-cols-2">{graph.outlets.map(outlet => {
    const {native,image,destination,menus,categories,items}=outlets.find(row=>row.outlet.id===outlet.id)!;
    if(native) return <NativeOrderingOutlet concealed={Boolean(selected&&selected!==outlet.id)} key={outlet.id} initial={native} slug={slug} language={language} hasRoomContext={hasRoomContext} premium={premium}/>;
    return <article hidden={Boolean(selected&&selected!==outlet.id)} key={outlet.id} id={'outlet-'+outlet.id} className={"fb-editorial-outlet "+(selected?'md:col-span-2 ':'')+"min-w-0 overflow-hidden rounded-2xl border border-[var(--hotel-border)] bg-[var(--hotel-surface)] text-[var(--hotel-text)]"}>
      {image ? <Image unoptimized src={image} alt={outlet.name} width={1200} height={700} className="aspect-[16/9] w-full object-cover" /> : null}
      <details open={premiumLayout||undefined} className="p-5"><summary className="cursor-pointer break-words text-xl font-semibold text-[var(--hotel-primary)]">{outlet.name}<span className="mt-2 block text-xs font-normal">{t.types[outlet.type]}{outlet.is_featured ? ' · '+t.featured : ''}</span>{outlet.short_description ? <span className="mt-3 block text-sm font-normal leading-6">{outlet.short_description}</span> : null}{outlet.opening_hours ? <span className="mt-3 block whitespace-pre-line text-sm font-normal">{outlet.opening_hours}</span> : null}</summary>
        {outlet.full_description ? <p className="mt-4 whitespace-pre-line break-words text-sm leading-6">{outlet.full_description}</p> : null}
        {outlet.location_info ? <p className="mt-3 whitespace-pre-line text-sm">{outlet.location_info}</p> : null}
        {destination ? <a href={destination.href} target={destination.kind==='external'?'_blank':undefined} rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[var(--hotel-border)] px-4 text-sm font-semibold">{t.open}</a> : null}
        {menus.map(menu=><section className="fb-menu-heading" key={menu.id} id={'menu-'+outlet.id+'-'+menu.id} ><h3 className="text-lg font-semibold">{menu.name}</h3>{menu.short_description?<p>{menu.short_description}</p>:null}</section>)}
        <FbCatalog active={!selected||selected===outlet.id} language={language} categories={categories} items={items} renderItem={item=>{
          const image=item.image,price=item.price;
          return <li key={item.id} className="fb-catalog-product" data-fb-catalog-product={item.id}><div className="fb-product-copy"><h5>{item.name}</h5>{item.short_description||item.full_description?<p className="fb-product-description">{item.short_description||item.full_description}</p>:null}{item.dietary_info?<p className="fb-product-dietary"><Leaf aria-hidden/>{item.dietary_info}</p>:null}{price?<p className="fb-product-price">{price}</p>:null}{item.allergens_info?<details className="fb-product-allergens"><summary>{t.allergens}</summary><p>{item.allergens_info}</p></details>:null}</div>{image?<Image unoptimized src={image} alt="" width={240} height={180}/>:null}</li>;
        }}/>

      </details>
    </article>;
  })}</div></>;
}
