import Image from 'next/image';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { DomainContext } from '@/lib/domain-context';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { eligibleFbGraph, fbOutletDestination, fbPrice } from '@/lib/fb/public';
import { fbImageUrl } from '@/lib/fb/media';

export function PublicFbContent({pageData,language,domainContext,preferSubdomainRoot}:{pageData:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean}) {
  const graph = eligibleFbGraph(pageData.fb,pageData.hotel.id);
  const t = language === 'en' ? {empty:'No dining options published yet.',menus:'Menus',open:'Open configured channel',allergens:'Allergens',dietary:'Dietary information',featured:'Featured',types:{restaurant:'Restaurant',bar:'Bar',room_service:'Room Service',breakfast:'Breakfast',cafe:'Café',other:'Other'}} : language === 'es' ? {empty:'Aún no hay opciones gastronómicas publicadas.',menus:'Menús',open:'Abrir canal configurado',allergens:'Alérgenos',dietary:'Información alimentaria',featured:'Destacado',types:{restaurant:'Restaurante',bar:'Bar',room_service:'Room Service',breakfast:'Desayuno',cafe:'Café',other:'Otro'}} : {empty:'Nenhuma opção gastronômica publicada ainda.',menus:'Cardápios',open:'Abrir canal configurado',allergens:'Alergênicos',dietary:'Informações alimentares',featured:'Destaque',types:{restaurant:'Restaurante',bar:'Bar',room_service:'Room Service',breakfast:'Café da manhã',cafe:'Café',other:'Outro'}};
  if (!graph?.outlets.length) return <p className="p-6 text-[var(--hotel-text-muted)]">{t.empty}</p>;
  return <div data-fb-native className="grid min-w-0 items-start gap-5 md:grid-cols-2">{graph.outlets.map(outlet => {
    const image = fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,outlet.main_image_path,pageData.hotel.id,'outlet',outlet.id);
    const destination = fbOutletDestination(outlet,graph,pageData.hotel,pageData.sections,language,domainContext,preferSubdomainRoot);
    const menuIds = new Set(graph.outlet_menus.filter(l=>l.outlet_id===outlet.id).map(l=>l.menu_id));
    const menus = graph.menus.filter(m=>menuIds.has(m.id));
    return <article key={outlet.id} id={'outlet-'+outlet.id} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--hotel-border)] bg-[var(--hotel-surface)] text-[var(--hotel-text)]">
      {image ? <Image unoptimized src={image} alt={outlet.name} width={1200} height={700} className="aspect-[16/9] w-full object-cover" /> : null}
      <details className="p-5"><summary className="cursor-pointer break-words text-xl font-semibold text-[var(--hotel-primary)]">{outlet.name}<span className="mt-2 block text-xs font-normal">{t.types[outlet.type]}{outlet.is_featured ? ' · '+t.featured : ''}</span>{outlet.short_description ? <span className="mt-3 block text-sm font-normal leading-6">{outlet.short_description}</span> : null}{outlet.opening_hours ? <span className="mt-3 block whitespace-pre-line text-sm font-normal">{outlet.opening_hours}</span> : null}</summary>
        {outlet.full_description ? <p className="mt-4 whitespace-pre-line break-words text-sm leading-6">{outlet.full_description}</p> : null}
        {outlet.location_info ? <p className="mt-3 whitespace-pre-line text-sm">{outlet.location_info}</p> : null}
        {destination ? <a href={destination.href} target={destination.kind==='external'?'_blank':undefined} rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[var(--hotel-border)] px-4 text-sm font-semibold">{t.open}</a> : null}
        {menus.length ? <nav aria-label={t.menus} className="mt-5 flex flex-wrap gap-3">{menus.map(menu=><a key={menu.id} className="min-h-11 content-center underline" href={'#menu-'+outlet.id+'-'+menu.id}>{menu.name}</a>)}</nav> : null}
        {menus.map(menu=><section key={menu.id} id={'menu-'+outlet.id+'-'+menu.id} className="mt-6 scroll-mt-6 border-t border-[var(--hotel-border)] pt-5"><h3 className="break-words text-lg font-semibold">{menu.name}</h3>{menu.short_description ? <p className="mt-2 text-sm">{menu.short_description}</p> : null}
          <nav aria-label={menu.name} className="my-3 flex flex-wrap gap-3">{graph.categories.filter(c=>c.menu_id===menu.id&&graph.items.some(i=>i.category_id===c.id)).map(c=><a className="min-h-11 content-center text-sm underline" key={c.id} href={'#category-'+outlet.id+'-'+c.id}>{c.name}</a>)}</nav>
          {graph.categories.filter(c=>c.menu_id===menu.id).map(category=>{
            const items=graph.items.filter(i=>i.category_id===category.id);if(!items.length)return null;
            return <section key={category.id} id={'category-'+outlet.id+'-'+category.id} className="mt-5 scroll-mt-6"><h4 className="break-words font-semibold">{category.name}</h4>{category.description?<p className="mt-1 text-sm">{category.description}</p>:null}<ul className="mt-3 space-y-4">{items.map(item=>{
              const image=fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,item.main_image_path,pageData.hotel.id,'item',item.id);const price=fbPrice(item,language);
              return <li key={item.id} className="min-w-0 rounded-xl border border-[var(--hotel-border)] p-4">{image?<Image unoptimized src={image} alt={item.name} width={600} height={400} className="mb-3 aspect-[3/2] w-full rounded-lg object-cover"/>:null}<h5 className="break-words font-semibold">{item.name}</h5>{item.short_description?<p className="mt-2 break-words text-sm">{item.short_description}</p>:null}{item.full_description?<p className="mt-2 whitespace-pre-line break-words text-sm">{item.full_description}</p>:null}{price?<p className="mt-3 font-semibold">{price}</p>:null}{item.allergens_info?<p className="mt-2 break-words text-xs">{t.allergens}: {item.allergens_info}</p>:null}{item.dietary_info?<p className="mt-2 break-words text-xs">{t.dietary}: {item.dietary_info}</p>:null}</li>;
            })}</ul></section>;
          })}</section>)}
      </details>
    </article>;
  })}</div>;
}
