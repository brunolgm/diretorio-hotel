import {notFound} from 'next/navigation';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {Language} from '@/lib/fb/orders/journey';
import {roomServiceProjection} from '@/lib/fb/smartmenu-projection';
import {nativeOffer} from '@/lib/fb/orders/offer.server';
import {fbImageUrl} from '@/lib/fb/media';
import {SmartMenuView} from './smartmenu-view';
import {localizeBuganRoomEditorial} from '@/lib/fb/bugan-room-editorial';
import {loadBuganRoomNames} from '@/lib/fb/room-name-translations.server';

export async function SmartMenuPage({pageData, language, domainContext, preferSubdomainRoot = false}: {
  pageData: PublicHotelPageData; language: Language; domainContext: DomainContext; preferSubdomainRoot?: boolean;
}) {
  let offer;
  const namesPromise=loadBuganRoomNames(pageData.hotel.slug,pageData.hotel.id,language);
  try { offer = await nativeOffer(pageData.hotel.slug, pageData.hotel.id, language,namesPromise); }
  catch { /* A failed operational read leaves browsing available with ordering disabled. */ }
  const names=await namesPromise;
  const projection = roomServiceProjection(pageData.fb, pageData.hotel.id, offer);
  if (!projection) notFound();
  const {hotel} = pageData;
  const {outlet, hasRoomContext} = projection;
  const image = fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, outlet.main_image_path, hotel.id, 'outlet', outlet.id);
  const editorial = localizeBuganRoomEditorial(hotel.slug, hotel.id, language, [projection.native],names)[0];
  const initial = {...editorial, image_url: image, products: editorial.products.map(product => ({
    ...product, image_url: product.image_url ?? fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, pageData.fb?.items.find(item => item.id === product.id && item.hotel_id === hotel.id)?.main_image_path ?? null, hotel.id, 'item', product.id),
  }))};
  return <SmartMenuView pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} initial={initial} hasRoomContext={hasRoomContext} image={image} description={outlet.short_description} openingHours={outlet.opening_hours}/>;
}
