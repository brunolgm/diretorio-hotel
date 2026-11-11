import Image from 'next/image';
import type {PublicHotel} from '@/lib/public-hotel-data';
import type {Language} from '@/lib/fb/orders/journey';
import {resolveHotelTheme} from '@/lib/hotel-theme';
import {OrderTracking} from './order-tracking';
import './smartmenu.css';

export function SmartMenuTracking({hotel, id, language, menuHref}: {hotel: PublicHotel; id: string; language: Language; menuHref: string}) {
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  return <main className="hotel-theme-page smartmenu" style={theme.cssVars} data-hotel-theme={theme.preset} data-smartmenu>
    <header className="smartmenu-header"><a className="smartmenu-brand" href={menuHref}>{hotel.logo_url ? <Image unoptimized src={hotel.logo_url} alt={hotel.name} width={160} height={70}/> : hotel.name}</a><a href={menuHref}>{ {pt: 'Voltar ao Room Service', en: 'Back to Room Service', es: 'Volver al Room Service'}[language] }</a></header>
    <OrderTracking slug={hotel.slug} id={id} language={language} smartMenu/>
  </main>;
}
