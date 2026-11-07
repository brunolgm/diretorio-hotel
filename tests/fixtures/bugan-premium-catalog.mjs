import {reviewGraph,simulatedOffer,previewId} from './bugan-menu-homologation.mjs';

// Editorial relation recorded by plano-publicacao-editorial.json / the publication script.
// Keep the earlier one-menu draft fixture intact: this is the subsequent published topology.
export const eventCategorySourceId='1994997';
export function premiumReviewGraph(source){
 const graph=reviewGraph(source),shared=graph.menus[0];
 const event={...shared,id:previewId(6),name:'Eventos gastronômicos'};
 const category=graph.categories.find(c=>c.id===previewId(4,eventCategorySourceId));
 if(!category)throw Error('Published event category missing from fixture source');
 category.menu_id=event.id;
 graph.menus.push(event);
 graph.outlet_menus.push({hotel_id:shared.hotel_id,outlet_id:previewId(1),menu_id:event.id,sort_order:1});
 return graph;
}

export function premiumSimulatedOffer(source,instant){
 const graph=premiumReviewGraph(source),offer=simulatedOffer(source,instant);
 for(const outlet of offer.outlets){
  const menuIds=new Set(graph.outlet_menus.filter(l=>l.outlet_id===outlet.id).map(l=>l.menu_id));
  const categoryIds=new Set(graph.categories.filter(c=>menuIds.has(c.menu_id)).map(c=>c.id));
  outlet.products=outlet.products.filter(p=>categoryIds.has(p.category_id));
  const offeredCategories=new Set(outlet.products.map(p=>p.category_id));
  outlet.menus=graph.menus.filter(m=>menuIds.has(m.id)).map(m=>({id:m.id,name:m.name,categories:graph.categories.filter(c=>c.menu_id===m.id&&offeredCategories.has(c.id)).map(c=>({id:c.id,name:c.name}))}));
 }
 return offer;
}
