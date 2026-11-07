import {createRoot} from 'react-dom/client';
import {HotelPublicPageContent} from '../../components/public/hotel-public-page-content';
import {HotelPublicAreaContent} from '../../components/public/hotel-public-area-content';
import type {FbGraph} from '../../lib/fb/types';
import {fbFixture} from '../fixtures/fb';
import {previewId} from '../fixtures/bugan-menu-homologation.mjs';
import {premiumReviewGraph,premiumSimulatedOffer} from '../fixtures/bugan-premium-catalog.mjs';
import source from '../../docs/bootstrap/bugan-cardapio-v2/lote-rascunho.json';
import approvedHotel from '../../docs/bootstrap/bugan-recife-20261028.json';
import {resolveDomainContext} from '../../lib/domain-context';
const args=new URLSearchParams(location.search),language=(args.get('lang')??'pt') as 'pt'|'en'|'es';
const data=fbFixture(Number(args.get('hotel')??4),language);
const graph=premiumReviewGraph(source) as unknown as FbGraph;
// Rehome only fixture identifiers to the selected synthetic hotel.
for(const rows of Object.values(graph))for(const row of rows)row.hotel_id=data.hotel.id;
data.fb=graph;
data.ordering=args.get('on')==='1'?premiumSimulatedOffer(source,'2026-11-10T11:00:00-03:00'):undefined;
// Genuine source photographs are cached only in out/. No catalogue import is simulated.
const photos=await (await fetch('/__review/photos')).json() as string[];
const photoByItem=new Map(source.itens.filter(i=>photos.includes(i.goomer_id)).map(i=>[previewId(5,i.goomer_id),i.goomer_id]));
const imagePath=(itemId:string)=>data.hotel.id+'/fb/item/'+itemId+'/55000000-0000-4000-8000-000000000100.jpg';
if(args.get('photos')!=='0'){
 for(const item of graph.items)if(photoByItem.has(item.id))item.main_image_path=imagePath(item.id);
 for(const outlet of data.ordering?.outlets??[])for(const product of outlet.products)if(photoByItem.has(product.id))product.image_url='http://127.0.0.1:4199/storage/v1/object/public/hotel-assets/'+imagePath(product.id);
}
if(data.hotel.theme_preset==='bugan'){
 data.hotel.slug='bugan-recife';data.hotel.subdomain='buganrecife';data.hotel.city='Recife';
 data.hotel.logo_url='/__review/logo.png';data.hotel.booking_url=approvedHotel.hotel.booking_url;
 data.layout.push({blockKey:'quick_info',isEnabled:true,position:5});data.tourismHomeAvailable=true;
 data.experienceMedia=approvedHotel.media.filter(m=>m.key==='hero').map(m=>({...m.values,hotel_id:data.hotel.id,slot:'hero',image_path:data.hotel.id+'/hero/hero/55000000-0000-4000-8000-000000000101.webp',mobile_image_path:null,revision:1,focal_x:50,focal_y:42,alt_text:'Piscina e terraço do Bugan Recife',is_published:true,cta_url:null,cta_label:''})) as typeof data.experienceMedia;
}
data.flightHomeCard={title:null,description:null};
data.hotel.whatsapp_number='558100000000';data.layout.push({blockKey:'contact',isEnabled:true,position:4});
if(args.get('off')==='1')data.fb=null;
const domain=resolveDomainContext('localhost');
const original=window.fetch.bind(window);
window.fetch=async(input,options)=>{
 const url=new URL(String(input),location.href);
 if(options?.method==='POST'){document.body.dataset.post=String(input);return new Response(JSON.stringify({error:'forbidden'}),{status:403});}
 if(url.pathname.endsWith('/offer'))return Response.json(data.ordering??{outlets:[],has_room_context:false});
 return original(input,options);
};
const props={pageData:data,language,domainContext:domain,preferSubdomainRoot:false};
createRoot(document.getElementById('root')!).render(args.get('view')==='home'?<HotelPublicPageContent {...data} language={language} domainContext={domain} preferSubdomainRoot={false}/>:<HotelPublicAreaContent {...props} area="cardapio"/>);
