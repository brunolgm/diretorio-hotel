'use client';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {orderCopy,type Language} from '@/lib/fb/orders/journey';
import {LayoutGrid,UtensilsCrossed,Leaf,Pizza,Sandwich,Soup,CookingPot,Wine,IceCreamBowl,Search,SlidersHorizontal,ChevronDown,Layers} from 'lucide-react';
import './fb-catalog.css';
import {fbCatalogCount} from '@/lib/fb/public-copy';

const copy={pt:{all:'Todas',more:'+ Mais categorias',none:'Nenhum item encontrado.',loading:'Carregando mais categorias…'},en:{all:'All',more:'+ More categories',none:'No items found.',loading:'Loading more categories…'},es:{all:'Todas',more:'+ Más categorías',none:'No se encontraron productos.',loading:'Cargando más categorías…'}};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const subscribeSupport=()=>()=>{};
const missingObserver=()=>!('IntersectionObserver' in window);
const serverSupport=()=>false;
function CategoryIcon({name}:{name:string}){
 const value=normalize(name);
 const Icon=value==='combos'?Layers:/salad|ensalad/.test(value)?Leaf:/pizza/.test(value)?Pizza:/sandu|sandw|bocad/.test(value)?Sandwich:/sopa|soup|caldo/.test(value)?Soup:/massa|pasta/.test(value)?CookingPot:/bebida|drink|vinho|wine/.test(value)?Wine:/sobremesa|dessert|postre/.test(value)?IceCreamBowl:UtensilsCrossed;
 return <Icon aria-hidden/>;
}
type CatalogItem={id:string;category_id:string|null;name:string;kind?:string;description?:string|null;short_description?:string|null;full_description?:string|null;image?:string|null;image_url?:string|null;dietary?:string|null;dietary_info?:string|null};

function CategoryPicker({categories,selected,onSelect,label,language}:{categories:{id:string;name:string}[];selected:string;onSelect:(id:string)=>void;label:string;language:Language}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const close={pt:'Fechar categorias',en:'Close categories',es:'Cerrar categorías'}[language];
 return <span className="smartmenu-category-picker">
  <button type="button" data-smartmenu-more onClick={()=>dialog.current?.showModal()}>{label}<ChevronDown aria-hidden/></button>
  <dialog ref={dialog} aria-label={orderCopy(language).category} className="smartmenu-category-dialog">
   <header><h3>{orderCopy(language).category}</h3><button type="button" aria-label={close} onClick={()=>dialog.current?.close()}>×</button></header>
   <div>{categories.map(category=><button type="button" key={category.id} aria-pressed={selected===category.id} onClick={()=>{onSelect(category.id);dialog.current?.close();}}>{category.name}</button>)}</div>
  </dialog>
 </span>;
}

// Mount complete category blocks in small batches, never placeholders for future groups.
function ProgressiveCategories({total,eager,active,label,children}:{total:number;eager:boolean;active:boolean;label:string;children:(limit:number)=>ReactNode}){
 const sentinel=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(2);
 const limit=eager?total:Math.min(visible,total);
 useEffect(()=>{
  if(eager||!active||limit>=total||!sentinel.current||!('IntersectionObserver' in window))return;
  let advanced=false;
  const observer=new IntersectionObserver(entries=>{
   if(!advanced&&entries.some(entry=>entry.isIntersecting)){
    advanced=true;observer.disconnect();setVisible(count=>Math.min(count+2,total));
   }
  },{rootMargin:'200px'});
  observer.observe(sentinel.current);
  return()=>observer.disconnect();
 },[eager,active,limit,total]);
 return <>{children(limit)}{limit<total?<div ref={sentinel} className="fb-catalog-more" data-catalog-sentinel role={label?'status':undefined}>{label}</div>:null}</>;
}

export function FbCatalog<T extends CatalogItem>({categories,items,language,renderItem,listClass='fb-catalog-products',active=true,compact=false,pauseProgression=false,comboCategory=false}:{categories:{id:string;name:string}[];items:T[];language:Language;renderItem:(item:T)=>ReactNode;listClass?:string;active?:boolean;compact?:boolean;pauseProgression?:boolean;comboCategory?:boolean}){
 const [category,setCategory]=useState(''),[search,setSearch]=useState('');
 const [itemLimit,setItemLimit]=useState(12);
 const categoryNav=useRef<HTMLElement>(null);
 const [photosOnly,setPhotosOnly]=useState(false),[dietaryOnly,setDietaryOnly]=useState(false);
 // Unsupported browsers fall back after hydration, preserving the server snapshot.
 const noObserver=useSyncExternalStore(subscribeSupport,missingObserver,serverSupport);
 const t=copy[language],order=orderCopy(language),query=normalize(search.trim());
 const unique=Array.from(new Map(items.map(i=>[(i.kind??'item')+i.id,i])).values());
 const combos={id:'__smartmenu_combos',name:'Combos'};
 const categoryId=(i:T)=>comboCategory&&i.kind==='combo'?combos.id:i.category_id??'__uncategorized';
 const fallback={id:'__uncategorized',name:{pt:'Outros',en:'Other',es:'Otros'}[language]};
 const available=Array.from(new Map([...categories,combos,fallback].map(c=>[c.id,c])).values()).filter(c=>unique.some(i=>categoryId(i)===c.id));
 // Keep editorial order within the primary categories; one-item special menus stay in More.
 const relevant=available.filter(c=>unique.filter(i=>categoryId(i)===c.id).length>1);
 const featured=available.filter(category=>category.id===combos.id);
 const primary=compact?[...featured,...available.filter(category=>category.id!==combos.id)].slice(0,5):[...relevant,...available.filter(c=>!relevant.includes(c))].slice(0,6),extra=available.filter(c=>!primary.includes(c));
 const selected=available.some(c=>c.id===category)?category:'';
 const results=unique.filter(i=>(query?normalize([i.name,i.description,i.short_description,i.full_description,compact?available.find(c=>c.id===categoryId(i))?.name:null].filter(Boolean).join(' ')).includes(query):!selected||categoryId(i)===selected)&&(!photosOnly||Boolean(i.image||i.image_url))&&(!dietaryOnly||Boolean(i.dietary||i.dietary_info)));
 const displayedResults=compact&&query?results.slice(0,itemLimit):results;
 const groups=available.filter(c=>displayedResults.some(i=>categoryId(i)===c.id));
 const choose=(id:string)=>{setCategory(id);if(compact){setSearch('');setItemLimit(12);}};
 const categoryCopy={pt:{previous:'Categorias anteriores',next:'Próximas categorias',view:'Ver',moreItems:'Carregar mais itens'},en:{previous:'Previous categories',next:'Next categories',view:'View',moreItems:'Load more items'},es:{previous:'Categorías anteriores',next:'Categorías siguientes',view:'Ver',moreItems:'Cargar más productos'}}[language];
 const filtersCopy={pt:{filters:'Filtros',photos:'Somente com foto',dietary:'Com informação alimentar',clear:'Limpar filtros'},en:{filters:'Filters',photos:'With a photo',dietary:'With dietary information',clear:'Clear filters'},es:{filters:'Filtros',photos:'Con foto',dietary:'Con información alimentaria',clear:'Limpiar filtros'}}[language];
 return <div className="fb-catalog" data-fb-catalog>
  {compact?<div className="smartmenu-category-controls"><button type="button" aria-label={categoryCopy.previous} onClick={()=>categoryNav.current?.scrollBy({left:-240})}>←</button><button type="button" aria-label={categoryCopy.next} onClick={()=>categoryNav.current?.scrollBy({left:240})}>→</button></div>:null}
  <nav ref={categoryNav} className="fb-catalog-filters" aria-label={order.category}>
   {[{id:'',name:t.all},...primary,...(selected&&extra.some(c=>c.id===selected)?extra.filter(c=>c.id===selected):[])].map(c=><button type="button" key={c.id} aria-pressed={!query&&selected===c.id} onClick={()=>choose(c.id)}>{c.id?<CategoryIcon name={c.name}/>:<LayoutGrid aria-hidden/>}<span>{c.name}</span></button>)}
   {extra.length?compact?<CategoryPicker categories={available} selected={selected} onSelect={choose} label={{pt:'+ Mais',en:'+ More',es:'+ Más'}[language]} language={language}/>:<details className="fb-more-categories"><summary><span>{t.more}</span><ChevronDown aria-hidden/></summary><div>{extra.map(c=><button type="button" key={c.id} aria-pressed={!query&&selected===c.id} onClick={e=>{choose(c.id);const details=e.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}}}>{c.name}</button>)}</div></details>:null}
  </nav>
  <div className="fb-catalog-tools"><label className="fb-catalog-search"><Search aria-hidden/><input aria-label={order.search} placeholder={order.search+'…'} type="search" value={search} onChange={e=>{setSearch(e.target.value);if(compact)setItemLimit(12);}}/></label><details className="fb-catalog-options"><summary><SlidersHorizontal aria-hidden/><span>{filtersCopy.filters}{photosOnly||dietaryOnly?' · '+(Number(photosOnly)+Number(dietaryOnly)):''}</span><ChevronDown aria-hidden/></summary><div><label><input type="checkbox" checked={photosOnly} onChange={e=>setPhotosOnly(e.target.checked)}/>{filtersCopy.photos}</label><label><input type="checkbox" checked={dietaryOnly} onChange={e=>setDietaryOnly(e.target.checked)}/>{filtersCopy.dietary}</label><button type="button" onClick={()=>{setPhotosOnly(false);setDietaryOnly(false);}}>{filtersCopy.clear}</button></div></details></div>
  {query?<p role="status">{fbCatalogCount(results.length,'item',language)}</p>:null}
  {!results.length?<p role="status">{t.none}</p>:null}
  <ProgressiveCategories key={String(active)+':'+(query||selected||photosOnly||dietaryOnly?'filtered':'all')+':'+groups.map(c=>c.id).join(',')} total={groups.length} active={active&&!pauseProgression} eager={noObserver||Boolean(query||selected||photosOnly||dietaryOnly)} label={pauseProgression?'':t.loading}>{limit=>groups.slice(0,limit).map(c=>{
   const categoryItems=displayedResults.filter(i=>categoryId(i)===c.id);
   const visibleItems=compact?categoryItems.slice(0,query||selected?itemLimit:3):categoryItems;
   return <section className="fb-catalog-category" data-catalog-category={c.id} key={c.id}><h4><CategoryIcon name={c.name}/><span>{c.name}</span><small>· {fbCatalogCount(categoryItems.length,'item',language)}</small></h4><ul className={listClass}>{visibleItems.map(renderItem)}</ul>{compact&&categoryItems.length>visibleItems.length?<button className="smartmenu-category-more" type="button" onClick={()=>{if(query||selected)setItemLimit(n=>n+12);else choose(c.id);}}>{query||selected?categoryCopy.moreItems:categoryCopy.view+' '+c.name}</button>:null}</section>;
  })}</ProgressiveCategories>
  {compact&&query&&results.length>itemLimit?<button type="button" className="smartmenu-category-more" onClick={()=>setItemLimit(n=>n+12)}>{categoryCopy.moreItems}</button>:null}
 </div>;
}
