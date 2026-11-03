import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {fbFixture} from '../fixtures/fb';
import {HotelPublicAreaContent} from '../../components/public/hotel-public-area-content';
import {HotelPublicPageContent} from '../../components/public/hotel-public-page-content';
import {FbEditor,FbReorderForm,FbRecordActions} from '../../components/admin/fb-editor';
import {HotelServiceDetailContent} from '../../components/public/hotel-service-detail-content';
import {FB_KINDS} from '../../lib/fb/types';
import type {DomainContext} from '../../lib/domain-context';
Object.assign(globalThis,{location:{search:''}});
let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Network forbidden in SSR fixture');};
let count=0;
for(let index=0;index<6;index++)for(const language of ['pt','en','es'] as const)for(const enabled of [false,true])for(const content of [false,true])for(const destination of [false,true]){
 const data=fbFixture(index,language);if(!content){data.fb!.outlets=[];data.sections=[];}if(!destination){data.fb!.service_links=[];data.fb!.outlets.forEach(o=>o.action_type='none');data.sections.forEach(s=>s.url=null);}if(!enabled)data.fb=null;
 const domain={kind:'product-subdomain',isPotentialHotelSubdomain:true,productRootDomain:'libguest.digital',subdomain:data.hotel.subdomain,navigationScope:'authenticated-preview'} as DomainContext;
 const area=renderToStaticMarkup(<HotelPublicAreaContent pageData={data} area="cardapio" language={language} domainContext={domain} preferSubdomainRoot/>);
 assert.equal(area.includes('data-fb-native'),enabled&&content);assert.ok(area.includes('<h1'));
 if(index===4&&enabled&&content&&destination)assert.ok(area.includes('https://hotel-bugan.goomer.app/menu'));
 count++;
 const home=renderToStaticMarkup(<HotelPublicPageContent {...data} language={language} domainContext={domain} preferSubdomainRoot/>);assert.ok(home.includes('<h1'));assert.ok(!home.includes(fbFixture((index+1)%6).hotel.id));count++;
}
for(let index=0;index<6;index++)for(const kind of FB_KINDS)for(const canManage of [false,true]){
 const data=fbFixture(index),graph=data.fb!;const row={outlet:graph.outlets[0],menu:graph.menus[0],category:graph.categories[0],item:graph.items[0]}[kind];
 const html=renderToStaticMarkup(<FbEditor kind={kind} row={row} graph={graph} services={data.sections} canManage={canManage}/>);
 assert.equal(html.includes('Salvar conteúdo PT'),canManage);assert.equal(html.includes('<fieldset disabled'),!canManage);count++;
}
for(let index=0;index<6;index++)for(const language of ['pt','en','es'] as const)for(const roomRestaurantState of ['missing-context','invalid-context','missing-menu'] as const){
 const data=fbFixture(index,language);const section={...data.sections[1],service_action_type:'room_restaurant_menu' as const};
 const domain={kind:'product-subdomain',isPotentialHotelSubdomain:true,productRootDomain:'libguest.digital',subdomain:data.hotel.subdomain} as DomainContext;
 const html=renderToStaticMarkup(<HotelServiceDetailContent hotel={data.hotel} section={section} language={language} domainContext={domain} hasFallbackContent={false} roomRestaurantState={roomRestaurantState} experienceVersion="v4"/>);
 assert.ok(html.includes('<h1'));assert.ok(!html.includes('roomToken'));count++;
}
{
 const data=fbFixture(0);const rows=Array.from({length:100},(_,i)=>({...data.fb!.items[0],id:'item-'+i}));
 const html=renderToStaticMarkup(<><FbReorderForm kind="item" rows={rows} canManage/>{rows.map(row=><FbRecordActions key={row.id} kind="item" row={row} canManage/>)}</>);
 assert.equal((html.match(/name="rows"/g)||[]).length,1,'one shared snapshot, never quadratic hidden payload');count++;
}
assert.equal(calls,0);console.log(JSON.stringify({suite:'fb-ssr',passed:count,failed:0,networkCalls:calls}));
