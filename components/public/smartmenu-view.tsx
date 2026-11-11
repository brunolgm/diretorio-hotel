import Image from 'next/image';
import {ConciergeBell, ArrowLeft, ShoppingBag, ShieldCheck} from 'lucide-react';
import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {Language, NativeOutlet} from '@/lib/fb/orders/journey';
import {resolveHotelTheme} from '@/lib/hotel-theme';
import {buildPublicHotelHref, buildRoomServiceHref} from '@/lib/public-routes';
import {NativeOrderingOutlet} from './native-ordering-outlet';
import {LanguageSwitcher} from './language-switcher';
import './smartmenu.css';
const copy = {
  pt: {back: 'Voltar ao LibGuest', title: 'Gastronomia no conforto do seu quarto', intro: 'Escolha seus favoritos e aproveite o Room Service.', menu: 'Cardápio exclusivo', delivery: 'Entrega no quarto', room: 'Apartamento validado pelo QR', browse: 'Consulte o cardápio. Para pedir no quarto, acesse seu QR válido.', hours: 'Horários informados pelo hotel', cart: 'Seu pedido', skip: 'Pular para o cardápio'},
  en: {back: 'Back to LibGuest', title: 'Dining in the comfort of your room', intro: 'Choose your favourites and enjoy Room Service.', menu: 'Room Service menu', delivery: 'Room delivery', room: 'Room validated by QR', browse: 'Browse the menu. To order room delivery, open your valid room QR.', hours: 'Hours provided by the hotel', cart: 'Your order', skip: 'Skip to menu'},
  es: {back: 'Volver a LibGuest', title: 'Gastronomía en la comodidad de tu habitación', intro: 'Elige tus favoritos y disfruta del Room Service.', menu: 'Menú exclusivo', delivery: 'Entrega en la habitación', room: 'Habitación validada por QR', browse: 'Consulta el menú. Para pedir en la habitación, abre tu QR válido.', hours: 'Horarios informados por el hotel', cart: 'Tu pedido', skip: 'Saltar al menú'},
};

export function SmartMenuView({pageData, language, domainContext, preferSubdomainRoot=false, initial, hasRoomContext, image, description, openingHours}: {
  pageData: PublicHotelPageData; language: Language; domainContext: DomainContext; preferSubdomainRoot?: boolean;
  initial: NativeOutlet; hasRoomContext: boolean; image: string | null; description: string | null; openingHours: string | null;
}) {
  const {hotel} = pageData;
  const route = {slug: hotel.slug, language, domainContext, preferSubdomainRoot};
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const t = copy[language];
  return <main className="hotel-theme-page smartmenu" style={theme.cssVars} data-hotel-theme={theme.preset} data-smartmenu data-smartmenu-premium={pageData.presentation?.experienceVersion === 'v4' && theme.preset === 'bugan'}>
    <a className="smartmenu-skip" href="#smartmenu-catalog">{t.skip}</a>
    <header className="smartmenu-header">
      <a className="smartmenu-brand" href={buildPublicHotelHref(route)}>{hotel.logo_url ? <Image unoptimized src={hotel.logo_url} alt={hotel.name} width={160} height={70}/> : <span>{hotel.name}</span>}</a>
      <a className="smartmenu-back" href={buildPublicHotelHref(route)}><ArrowLeft aria-hidden/><span>{t.back}</span></a>
      <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={buildRoomServiceHref(route)}/>
      <a href="#smartmenu-cart" className="smartmenu-cart-link" aria-label={t.cart}><ShoppingBag aria-hidden/><span>{t.cart}</span></a>
    </header>
    <div className="smartmenu-body">
      <section className="smartmenu-hero" aria-labelledby="smartmenu-title">
        {image ? <Image unoptimized priority src={image} alt="" width={1400} height={500}/> : null}
        <div><p className="smartmenu-eyebrow">Room Service</p><h1 id="smartmenu-title">{t.title}</h1><p>{description || t.intro}</p><ul><li><ConciergeBell aria-hidden/>{t.menu}</li><li><ShieldCheck aria-hidden/>{t.delivery}</li></ul></div>
      </section>
      <div className="smartmenu-service"><p>{hasRoomContext ? t.room : t.browse}</p>{openingHours ? <details><summary>{t.hours}</summary><p>{openingHours}</p></details> : null}</div>
      <NativeOrderingOutlet initial={initial} slug={hotel.slug} language={language} hasRoomContext={hasRoomContext} premium={pageData.presentation?.experienceVersion === 'v4'} smartMenu/>
    </div>
  </main>;
}
