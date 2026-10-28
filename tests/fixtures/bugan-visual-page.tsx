import { notFound } from 'next/navigation';
import { PublicTourismContent } from '@/components/public/public-tourism-content';
import { ExperienceMediaEditor } from '@/components/admin/experience-media-editor';
import type { ExperienceMedia } from '@/lib/public-experience-media';
import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { HotelPublicAreaContent } from '@/components/public/hotel-public-area-content';
import { HotelPublicFlightCenter } from '@/components/public/hotel-public-flight-center';
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { ExperienceHeader } from '@/components/admin/experience/experience-header';
import { ExperienceMetrics } from '@/components/admin/experience/experience-metrics';
import { ExperienceTabs } from '@/components/admin/experience/experience-tabs';
import { HomeCompositionCard } from '@/components/admin/experience/home-composition-card';
import { getAdminThemeStyle, resolveAdminTheme } from '@/lib/admin-theme';
import { getAdminNavigationForRole } from '@/lib/admin-navigation';
import { BASELINE_MODULE_KEYS } from '@/lib/modules/catalog';
import { getDefaultExperienceLayout } from '@/lib/experience-layout';
import type { PublicHotelPageData, PublicHotel, PublicFlightCenterData } from '@/lib/public-hotel-data';
import type { DomainContext } from '@/lib/domain-context';

// Permanent synthetic fixture; the runner installs/removes its development-only route.
export default async function QA({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const q=await searchParams;
  const language=q.lang === 'en' ? 'en' : q.lang === 'es' ? 'es' : 'pt';
  const theme=q.theme || 'bugan';
  const hotel={ id:'b0600000-0000-4000-8000-000000000001',name:'Bugan Recife',city:'Recife, PE',slug:'bugan-recife',subdomain:'buganrecife',brand_code:theme,theme_preset:theme,theme_primary_color:null,logo_url:null,hero_image_url:null,wifi_name:'REDE SINTÉTICA',breakfast_hours:'HORÁRIO SINTÉTICO',checkout_time:'HORÁRIO SINTÉTICO',checkin_time:null,website_url:'https://example.invalid',booking_url:q.reserve==='yes'?'https://example.invalid/book':null,instagram_url:null,whatsapp_number:null } as PublicHotel;
  const layout=getDefaultExperienceLayout().map((b)=>({...b, position:({hero:1,quick_info:2,announcements:3,services:4,contact:5,departments:6,policies:7,banners:8})[b.blockKey]}));
  const data={hotel,layout,banners:q.banner==='yes'?[{ id:'synthetic-banner',hotel_id:hotel.id,title:'BANNER SINTÉTICO',subtitle:'Somente fixture de teste local',image_url:q.image==='yes'?'/brand/mercure/mercure-hero-fallback.webp':null,cta_label:null,cta_url:null,starts_at:null,ends_at:null }]:[],announcements:q.empty==='yes'?[]:[{id:'test',title:'Fixture',content:'Synthetic'}],sections:q.empty==='yes'?[]:[{id:'test',title:'Fixture',content:'Synthetic',icon:'info'}],departments:q.full==='yes'?[{id:'test'}]:[],policies:q.full==='yes'?[{id:'test'}]:[],flightHomeCard:q.flights==='yes'?{title:null,description:null}:null,hasFallbackContent:false} as unknown as PublicHotelPageData;
  if(q.cards) data.layout=data.layout.map(b=>({...b,isEnabled:b.blockKey==='hero'||['quick_info','announcements','services','contact','departments','policies'].slice(0,Number(q.cards)).includes(b.blockKey)}));
  const media = ['hero','about','restaurant','accommodation'].map((slot,index)=>({
    hotel_id:hotel.id,slot,image_path:q.hero==='no'?null:`${hotel.id}/hero/${slot}/b0600000-0000-4000-8000-000000000003.png`,
    mobile_image_path:q.mobile==='yes'&&slot==='hero'?`${hotel.id}/hero/${slot}/b0600000-0000-4000-8000-000000000004.png`:null,
    focal_x:50,focal_y:55,mobile_focal_x:68,mobile_focal_y:45,alt_text:'Fotografia real fornecida para homologação local',
    title:['Bugan Recife','Design, conforto e a energia de Recife.','Restaurante Filipe','Conforto em cada detalhe.'][index],
    description:index===0?'Seu hotel, sua cidade, experiências únicas.':'Conteúdo editorial de demonstração local. A publicação dos dados definitivos pertence ao Prompt 2.',
    cta_label:'',cta_url:null,is_published:true,revision:1,
  })) as ExperienceMedia[];
  data.experienceMedia=q.media==='yes'?media:[];
  if(q.area==='turismo' && data.sections.length) data.sections[0].title='Turismo legado sintético';
  data.tourismHomeAvailable=q.tourism==='yes';
  data.tourismPreview=q.tourism==='yes'?[{id:'b0600000-0000-4000-8000-000000000005',hotel_id:hotel.id,slug:'item-sintetico',name:'Item sintético de Turismo',short_description:'Fixture de teste. Não representa recomendação real.',full_description:'Texto fonte PT.',type:'PLACE',category_key:'sights',is_published:true,main_image_path:null,sort_order:0} as NonNullable<PublicHotelPageData['tourismPreview']>[number]]:[];
  if(q.cards) {
    const count=Number(q.cards);
    data.experienceMedia=count>=2?media:[];
    data.tourismHomeAvailable=count>=4;
    data.flightHomeCard=count>=5?{title:null,description:null}:null;
    data.layout=data.layout.map(b=>({...b,isEnabled:b.blockKey==='hero'||(b.blockKey==='quick_info')||(b.blockKey==='services'&&count>=3)||(b.blockKey==='contact'&&count>=6)}));
  }
  const domain={kind:'localhost',host:'localhost',hostname:'localhost',productRootDomain:'libguest.digital',isPotentialHotelSubdomain:false,shouldUseSlugFallback:true} as DomainContext;
  const enabled=new Set(BASELINE_MODULE_KEYS);
  const navGroups=getAdminNavigationForRole('administrador',enabled);
  const adminTheme=resolveAdminTheme(theme);
  async function noop(){'use server';}
  const sidebar={hotelName:hotel.name,hotelCity:hotel.city,hotelLogoUrl:null,themeLabel:adminTheme.label,navGroups,userName:'Usuário sintético',userRole:'administrador',signOutAction:noop};
  if(q.admin==='yes') return <AdminThemeProvider theme={adminTheme}>
    <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block"><AdminSidebar {...sidebar}/></aside>
    <div className="min-w-0 lg:pl-64"><header className="flex min-h-14 items-center gap-3 border-b border-[var(--admin-border)] px-4 lg:hidden"><MobileMenu {...sidebar} themeCode={adminTheme.code} themePreset={adminTheme.themePreset} logoTreatment={adminTheme.logoTreatment} themeStyle={getAdminThemeStyle(adminTheme)}/><span>Bugan Recife · TESTE LOCAL</span></header>
    <main className="space-y-4 p-4 md:p-6"><ExperienceHeader hotelName="Bugan Recife · TESTE LOCAL" publicUrl="/bugan-qa-local" dateLabel="Fixture local" timeLabel="Sem dados reais"/>
    <ExperienceMetrics status={{label:'Em preparação',description:'Fixture local',active:false}} lastUpdated="Não registrada" languages={['PT','EN','ES']} publishedAreas={0} totalAreas={6} featuredItems={0} hrefs={{languages:'/admin/idiomas',featured:'/admin/banners'}}/>
    <ExperienceTabs activeTab="composicao" previewEnabled/><HomeCompositionCard layout={data.layout} enabledModules={enabled} canEdit={false}/></main></div>
  </AdminThemeProvider>;
  if(q.tourismpage==='yes') return <PublicTourismContent data={{hotel,items:data.tourismPreview??[]}} language={language} domainContext={domain} preferSubdomainRoot={false} detail={q.detail==='yes'}/>;
  if(q.mediaadmin==='yes') return <ExperienceMediaEditor rows={media} urls={Object.fromEntries(media.map(m=>[m.slot,{desktop:'http://127.0.0.1:54321/storage/v1/object/public/hotel-assets/'+m.image_path,mobile:null}]))} action={noop}/>;
  if(q.area) return <HotelPublicAreaContent pageData={data} area={q.area as 'informacoes'} language={language} domainContext={domain} preferSubdomainRoot={false}/>;
  if(q.flightpage==='yes') return <HotelPublicFlightCenter data={{hotel,airports:[],navigationAvailability:{services:true,menu:false,information:true,contact:true},settings:{departurePlanningEnabled:false,transferEnabled:false,wakeUpEnabled:false,breakfastBoxEnabled:false,receptionEnabled:false,officialLinksEnabled:false,departureNotice:null}} as PublicFlightCenterData} language={language} tab="meu-voo" domainContext={domain} preferSubdomainRoot={false}/>;
  return <HotelPublicPageContent {...data} language={language} domainContext={domain} preferSubdomainRoot={q.subdomain==='yes'} activeRoomContext={q.room==='yes'?{roomNumber:'TESTE',label:null}:null}/>;
}
