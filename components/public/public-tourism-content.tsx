import {ArrowLeft,ArrowUpRight,MapPin} from 'lucide-react';
import {TourismImage} from '@/components/tourism-image';
import {PublicAreaHero} from '@/components/public/public-area-hero';
import {PublicAnalytics} from '@/components/public/public-analytics';
import {resolveHotelTheme} from '@/lib/hotel-theme';
import {TOURISM_TYPES,TOURISM_CATEGORIES} from '@/lib/tourism/catalog';
import {tourismPublicCopy} from '@/lib/tourism/public-copy';
import {tourismFilter,tourismHttpsUrl,tourismPhone,type PublicTourismData} from '@/lib/tourism/public';
import {tourismCollection,tourismHasUsefulDetails} from '@/lib/tourism/editorial';
import {tourismImageUrl} from '@/lib/tourism/media';
import type {DomainContext} from '@/lib/domain-context';
import {buildPublicHotelAreaHref,buildPublicHotelHref,buildPublicHotelTourismItemHref} from '@/lib/public-routes';

export function PublicTourismContent({data,language,domainContext,preferSubdomainRoot,detail=false,filter,collection,category:categoryFilter}:{
 data:PublicTourismData;language:'pt'|'en'|'es';domainContext:DomainContext;preferSubdomainRoot:boolean;detail?:boolean;filter?:string;collection?:string;category?:string;
}){
 const {hotel}=data,theme=resolveHotelTheme(hotel.theme_preset,hotel.theme_primary_color),copy=tourismPublicCopy(language);
 const route={slug:hotel.slug,language,domainContext,preferSubdomainRoot};
 const generalHref=buildPublicHotelAreaHref({...route,area:'turismo'}),homeHref=buildPublicHotelHref(route);
 const addCollection=(href:string)=>collection?href+(href.includes('?')?'&':'?')+'collection='+encodeURIComponent(collection):href;
 const catalogHref=addCollection(generalHref);
 const selected=tourismCollection(data.presentation,collection,data.items,hotel.id,language),item=detail?data.items[0]:null;
 const types=TOURISM_TYPES.filter(t=>selected.items.some(i=>i.type===t.key));
 const type=types.some(t=>t.key===tourismFilter(filter))?tourismFilter(filter):null;
 const typed=type?selected.items.filter(i=>i.type===type):selected.items;
 const categories=TOURISM_CATEGORIES.filter(c=>typed.some(i=>i.type===c.type&&i.category_key===c.key));
 const selectedCategory=categories.some(c=>c.key===categoryFilter)?categoryFilter:null;
 const shown=selectedCategory?typed.filter(i=>i.category_key===selectedCategory):typed;
 const labels=language==='en'?{all:'View all attractions',apply:'Filter',type:'Type',category:'Category',selection:'Selection unavailable',extra:'About this place'}:language==='es'?{all:'Ver todas las atracciones',apply:'Filtrar',type:'Tipo',category:'Categoría',selection:'Selección no disponible',extra:'Sobre este lugar'}:{all:'Ver todas as atrações',apply:'Filtrar',type:'Tipo',category:'Categoria',selection:'Seleção indisponível',extra:'Sobre este lugar'};
 const languageBase=item?buildPublicHotelTourismItemHref({...route,language:'pt',itemSlug:item.slug,collection}):addCollection(buildPublicHotelAreaHref({...route,language:'pt',area:'turismo'}));
 const image=(i:typeof data.items[number])=>tourismImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,i.main_image_path,hotel.id,i.id);
 const category=(i:typeof data.items[number])=>TOURISM_CATEGORIES.find(c=>c.type===i.type&&c.key===i.category_key)?.labels[language];
 const externalLinks=item?[
  {href:tourismHttpsUrl(item.official_website_url),label:copy.website},
  {href:tourismHttpsUrl(item.map_url),label:copy.map},
  {href:tourismPhone(item.whatsapp_number)?`https://wa.me/${item.whatsapp_number!.slice(1)}`:null,label:copy.whatsapp},
 ]:[];
 return <main className="hotel-theme-page min-h-dvh" style={theme.cssVars} data-hotel-theme={theme.preset} data-public-internal-v4={data.presentation?.experienceVersion==='v4'?'':undefined}>
  <PublicAnalytics hotelSlug={hotel.slug} language={language}/>
  <div data-public-internal-body className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
   <PublicAreaHero hotel={hotel} language={language} languageBasePath={languageBase} homeHref={detail?catalogHref:homeHref} backLabel={detail?copy.back:copy.home} title={item?.name||selected.title||(selected.found?copy.title:labels.selection)} description={item?.short_description||selected.description||copy.intro} icon={MapPin}/>
   {collection?<a className="my-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[color:var(--hotel-accent)]" href={generalHref}><ArrowLeft className="h-4 w-4" aria-hidden/>{labels.all}</a>:null}
   {!detail?<>
    {selected.items.length?<form className="tourism-filters my-4 flex flex-wrap items-end gap-2" method="get" action={generalHref.split('?')[0]}>
     {language!=='pt'?<input type="hidden" name="lang" value={language}/>:null}{collection?<input type="hidden" name="collection" value={collection}/>:null}
     {types.length>1?<label className="text-xs">{labels.type}<select name="type" defaultValue={type??''} className="mt-1 block min-h-11 w-full rounded-xl border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] px-3 text-sm"><option value="">{copy.all}</option>{types.map(t=><option key={t.key} value={t.key}>{t.labels[language]}</option>)}</select></label>:null}
     {categories.length>1?<label className="text-xs">{labels.category}<select name="category" defaultValue={selectedCategory??''} className="mt-1 block min-h-11 w-full rounded-xl border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] px-3 text-sm"><option value="">{copy.all}</option>{categories.map(c=><option key={c.key} value={c.key}>{c.labels[language]}</option>)}</select></label>:null}
     {type&&types.length<=1?<input type="hidden" name="type" value={type}/>:null}
     {types.length>1||categories.length>1?<button className="min-h-11 rounded-xl bg-[var(--hotel-accent)] px-4 text-sm text-[color:var(--hotel-accent-foreground)]">{labels.apply}</button>:null}
    </form>:null}
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(row=>{
     const useful=tourismHasUsefulDetails(row),Tag=useful?'a':'article';
     return <Tag key={row.id} data-tourism-item={useful?'':undefined} href={useful?buildPublicHotelTourismItemHref({...route,itemSlug:row.slug,collection}):undefined} className="hotel-theme-card min-w-0 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hotel-accent)]">
      {image(row)?<TourismImage src={image(row)} alt={row.name}/>:null}
      <p className="text-xs text-[color:var(--hotel-text-muted)]">{category(row)||TOURISM_TYPES.find(t=>t.key===row.type)?.labels[language]}</p>
      <h2 className="mt-2 break-words text-xl font-semibold">{row.name}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{row.short_description}</p>
      {row.recommended_by_hotel?<p className="mt-3 text-xs">{copy.recommended}</p>:null}
      {useful?<span className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--hotel-accent)]">{copy.open}<ArrowUpRight className="h-4 w-4" aria-hidden/></span>:null}
     </Tag>;
    })}</div>{!shown.length?<p className="hotel-theme-card mt-4 p-5" role="status">{copy.empty}</p>:null}
   </>:item?<article className="hotel-theme-card mt-4 space-y-5 p-5 md:p-7">
    {image(item)?<div className="max-w-3xl"><TourismImage src={image(item)} alt={item.name}/></div>:null}
    <p className="text-sm text-[color:var(--hotel-text-muted)]">{category(item)}</p>
    {item.full_description?.trim()&&item.full_description.trim()!==item.short_description.trim()?<section><h2 className="font-semibold">{labels.extra}</h2><p className="mt-2 whitespace-pre-wrap break-words leading-7">{item.full_description}</p></section>:null}
    <dl className="grid gap-4 sm:grid-cols-2">{[{label:copy.address,value:item.address},{label:copy.hours,value:item.opening_hours},{label:copy.price,value:item.price_info},{label:copy.duration,value:item.duration_info}].filter(f=>f.value).map(f=><div key={f.label}><dt className="text-sm font-semibold">{f.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{f.value}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-3">{externalLinks.filter(l=>l.href).map(l=><a key={l.label} href={l.href!} target="_blank" rel="noopener noreferrer" aria-label={`${l.label} — ${copy.external}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--hotel-border)] px-4 text-sm">{l.label}<ArrowUpRight className="h-4 w-4" aria-hidden/></a>)}{tourismPhone(item.phone)?<a href={`tel:${item.phone}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm">{copy.phone}: {item.phone}</a>:null}</div>
   </article>:null}
   <footer className="py-8 text-center text-xs text-[color:var(--hotel-text-muted)]">Powered by LibGuest</footer>
  </div>
 </main>;
}
