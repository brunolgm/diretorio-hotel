'use client';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {orderCopy,type Language} from '@/lib/fb/orders/journey';
import {LayoutGrid,UtensilsCrossed,Leaf,Pizza,Sandwich,Soup,CookingPot,Wine,IceCreamBowl,Search,SlidersHorizontal,ChevronDown} from 'lucide-react';
import './fb-catalog.css';
import {fbCatalogCount} from '@/lib/fb/public-copy';

const copy={pt:{all:'Todas',more:'+ Mais categorias',none:'Nenhum item encontrado.',loading:'Carregando categoria…'},en:{all:'All',more:'+ More categories',none:'No items found.',loading:'Loading category…'},es:{all:'Todas',more:'+ Más categorías',none:'No se encontraron productos.',loading:'Cargando categoría…'}};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const subscribeSupport=()=>()=>{};
const missingObserver=()=>!('IntersectionObserver' in window);
const serverSupport=()=>false;
function CategoryIcon({name}:{name:string}){
 const value=normalize(name);
 const Icon=/salad|ensalad/.test(value)?Leaf:/pizza/.test(value)?Pizza:/sandu|sandw|bocad/.test(value)?Sandwich:/sopa|soup|caldo/.test(value)?Soup:/massa|pasta/.test(value)?CookingPot:/bebida|drink|vinho|wine/.test(value)?Wine:/sobremesa|dessert|postre/.test(value)?IceCreamBowl:UtensilsCrossed;
 return <Icon aria-hidden/>;
}
type CatalogItem={id:string;category_id:string|null;name:string;kind?:string;description?:string|null;short_description?:string|null;full_description?:string|null;image?:string|null;image_url?:string|null;dietary?:string|null;dietary_info?:string|null};

function ProgressiveCategory({eager,label,children}:{eager:boolean;label:string;children:()=>ReactNode}){
 const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(eager);
 useEffect(()=>{
  if(eager||visible)return;
  if(!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'300px'});
  if(ref.current)observer.observe(ref.current);
  return()=>observer.disconnect();
 },[eager,visible]);
 return <div ref={ref}>{eager||visible?children():<div className="fb-catalog-placeholder" role="status">{label}</div>}</div>;
}

export function FbCatalog<T extends CatalogItem>({categories,items,language,renderItem,listClass='fb-catalog-products'}:{categories:{id:string;name:string}[];items:T[];language:Language;renderItem:(item:T)=>ReactNode;listClass?:string}){
 const [category,setCategory]=useState(''),[search,setSearch]=useState('');
 const [photosOnly,setPhotosOnly]=useState(false),[dietaryOnly,setDietaryOnly]=useState(false);
 // Unsupported browsers fall back after hydration, preserving the server snapshot.
 const noObserver=useSyncExternalStore(subscribeSupport,missingObserver,serverSupport);
 const t=copy[language],order=orderCopy(language),query=normalize(search.trim());
 const unique=Array.from(new Map(items.map(i=>[(i.kind??'item')+i.id,i])).values());
 const categoryId=(i:T)=>i.category_id??'__uncategorized';
 const fallback={id:'__uncategorized',name:{pt:'Outros',en:'Other',es:'Otros'}[language]};
 const available=Array.from(new Map([...categories,...(unique.some(i=>!i.category_id)?[fallback]:[])].map(c=>[c.id,c])).values()).filter(c=>unique.some(i=>categoryId(i)===c.id));
 // Keep editorial order within the primary categories; one-item special menus stay in More.
 const relevant=available.filter(c=>unique.filter(i=>categoryId(i)===c.id).length>1);
 const primary=[...relevant,...available.filter(c=>!relevant.includes(c))].slice(0,6),extra=available.filter(c=>!primary.includes(c));
 const selected=available.some(c=>c.id===category)?category:'';
 const results=unique.filter(i=>(query?normalize([i.name,i.description,i.short_description,i.full_description].filter(Boolean).join(' ')).includes(query):!selected||categoryId(i)===selected)&&(!photosOnly||Boolean(i.image||i.image_url))&&(!dietaryOnly||Boolean(i.dietary||i.dietary_info)));
 const groups=available.filter(c=>results.some(i=>categoryId(i)===c.id));
 const choose=(id:string)=>setCategory(id);
 const filtersCopy={pt:{filters:'Filtros',photos:'Somente com foto',dietary:'Com informação alimentar',clear:'Limpar filtros'},en:{filters:'Filters',photos:'With a photo',dietary:'With dietary information',clear:'Clear filters'},es:{filters:'Filtros',photos:'Con foto',dietary:'Con información alimentaria',clear:'Limpiar filtros'}}[language];
 return <div className="fb-catalog" data-fb-catalog>
  <nav className="fb-catalog-filters" aria-label={order.category}>
   {[{id:'',name:t.all},...primary,...(selected&&extra.some(c=>c.id===selected)?extra.filter(c=>c.id===selected):[])].map(c=><button type="button" key={c.id} aria-pressed={!query&&selected===c.id} onClick={()=>choose(c.id)}>{c.id?<CategoryIcon name={c.name}/>:<LayoutGrid aria-hidden/>}<span>{c.name}</span></button>)}
   {extra.length?<details className="fb-more-categories"><summary><span>{t.more}</span><ChevronDown aria-hidden/></summary><div>{extra.map(c=><button type="button" key={c.id} aria-pressed={!query&&selected===c.id} onClick={e=>{choose(c.id);const details=e.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}}}>{c.name}</button>)}</div></details>:null}
  </nav>
  <div className="fb-catalog-tools"><label className="fb-catalog-search"><Search aria-hidden/><input aria-label={order.search} placeholder={order.search+'…'} type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><details className="fb-catalog-options"><summary><SlidersHorizontal aria-hidden/><span>{filtersCopy.filters}{photosOnly||dietaryOnly?' · '+(Number(photosOnly)+Number(dietaryOnly)):''}</span><ChevronDown aria-hidden/></summary><div><label><input type="checkbox" checked={photosOnly} onChange={e=>setPhotosOnly(e.target.checked)}/>{filtersCopy.photos}</label><label><input type="checkbox" checked={dietaryOnly} onChange={e=>setDietaryOnly(e.target.checked)}/>{filtersCopy.dietary}</label><button type="button" onClick={()=>{setPhotosOnly(false);setDietaryOnly(false);}}>{filtersCopy.clear}</button></div></details></div>
  {query?<p role="status">{fbCatalogCount(results.length,'item',language)}</p>:null}
  {!results.length?<p role="status">{t.none}</p>:null}
  {groups.map((c,index)=><section className="fb-catalog-category" data-catalog-category={c.id} key={c.id}><h4><CategoryIcon name={c.name}/><span>{c.name}</span><small>· {fbCatalogCount(results.filter(i=>categoryId(i)===c.id).length,'item',language)}</small></h4><ProgressiveCategory key={query||selected?'filtered':'all'} eager={noObserver||Boolean(query||selected||photosOnly||dietaryOnly)||index<2} label={t.loading}>{()=> <ul className={listClass}>{results.filter(i=>categoryId(i)===c.id).map(renderItem)}</ul>}</ProgressiveCategory></section>)}
 </div>;
}
