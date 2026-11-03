'use client';
import { useActionState, useState } from 'react';
import { saveFbAction,deleteFbAction,moveFbAction,uploadFbImageAction,removeFbImageAction } from '@/app/admin/cardapio/actions';
import { FB_FIELDS,FB_FLAGS,fbTextLimit,fbPriceInput } from '@/lib/fb/validation';
import { OUTLET_TYPES,type FbKind,type FbRecord,type FbGraph } from '@/lib/fb/types';
import type { PublicHotelSection } from '@/lib/public-hotel-data';
import { fbImageUrl } from '@/lib/fb/media';
import Image from 'next/image';
const labels:Record<string,string>={name:'Nome',short_description:'Descrição curta',full_description:'Descrição completa',opening_hours:'Horários informados',location_info:'Localização',type:'Tipo',is_featured:'Destaque',action_type:'Ação',external_url:'URL externa HTTPS',service_id:'Serviço associado',menu_ids:'Cardápios associados',is_published:'Publicado',sort_order:'Ordem',menu_id:'Cardápio',category_id:'Categoria',description:'Descrição',price_amount_minor:'Preço na moeda informada (BRL: 25,90)',currency:'Moeda (ex.: BRL)',price_on_request:'Sob consulta (remove preço numérico)',is_available:'Disponível editorialmente',allergens_info:'Alergênicos informados',dietary_info:'Informações alimentares'};
const typeLabels:Record<string,string>={restaurant:'Restaurante',bar:'Bar',room_service:'Room Service',breakfast:'Café da manhã',cafe:'Café',other:'Outro'};
const inputClass='mt-2 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-[var(--admin-text)]';
export function FbEditor({kind,row,graph,services,canManage}:{kind:FbKind;row?:FbRecord;graph:FbGraph;services:Pick<PublicHotelSection,'id'|'title'|'enabled'>[];canManage:boolean}) {
 const [state,action,pending]=useActionState(saveFbAction,{});
 const values=(row||{}) as unknown as Record<string,unknown>;
 const [actionType,setActionType]=useState(String(values.action_type||'none'));
 return <form action={action} className="space-y-4">
   <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={row?.id||''}/><input type="hidden" name="revision" value={row?.revision||0}/>
   {state.error?<p role="alert" className="text-red-700">{state.error}</p>:null}
   <fieldset disabled={!canManage||pending} className="grid min-w-0 gap-4 md:grid-cols-2">
    {FB_FIELDS[kind].map(key=>{
      if(key==='menu_ids')return <fieldset key={key} className="md:col-span-2"><legend className="font-medium">{labels[key]}</legend>{graph.menus.length?graph.menus.map(menu=><label key={menu.id} className="mr-5 inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="menu_ids" value={menu.id} defaultChecked={graph.outlet_menus.some(l=>l.outlet_id===row?.id&&l.menu_id===menu.id)}/>{menu.name}</label>):<p>Cadastre um cardápio para associar explicitamente.</p>}</fieldset>;
      if(FB_FLAGS.includes(key))return <label key={key} className="flex min-h-11 items-center gap-3"><input type="checkbox" name={key} defaultChecked={typeof values[key]==='boolean'?values[key] as boolean:key==='is_available'}/>{labels[key]}</label>;
      const options=key==='type'?OUTLET_TYPES.map(t=>({id:t,name:typeLabels[t]})):key==='action_type'?[{id:'none',name:'Sem ação'},{id:'service',name:'Serviço existente'},{id:'external_url',name:'URL externa'}]:key==='service_id'?services.map(s=>({id:s.id,name:s.title+(s.enabled?'':' (desabilitado)')})):key==='menu_id'?graph.menus:key==='category_id'?graph.categories:null;
      const value=key==='service_id'?graph.service_links.find(l=>l.outlet_id===row?.id)?.service_id:key==='price_amount_minor'?fbPriceInput(typeof values[key]==='number'?values[key] as number:null,String(values.currency||'BRL')):String(values[key]??(key==='currency'?'BRL':key==='type'?'restaurant':key==='action_type'?'none':key==='sort_order'?0:''));
      const disabled=key==='service_id'&&actionType!=='service'||key==='external_url'&&actionType!=='external_url';
      return <label key={key} className={key.includes('description')?'md:col-span-2':''}><span className="text-sm font-medium">{labels[key]}</span>{options?<select name={key} className={inputClass} disabled={disabled} defaultValue={value} onChange={key==='action_type'?e=>setActionType(e.target.value):undefined} required={['menu_id','category_id','type','action_type'].includes(key)}>{!['type','action_type'].includes(key)?<option value="">Selecione</option>:null}{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>:key.includes('description')||key.includes('info')||key==='opening_hours'?<textarea name={key} defaultValue={value} className={inputClass} maxLength={fbTextLimit(key)} rows={key==='full_description'?5:3}/>:<input name={key} defaultValue={value} className={inputClass} type={key==='sort_order'?'number':key==='external_url'?'url':'text'} inputMode={key==='price_amount_minor'?'decimal':undefined} pattern={key==='price_amount_minor'?'[0-9]+([,.][0-9]{1,3})?':undefined} min={0} max={key==='sort_order'?100000:undefined} maxLength={key==='price_amount_minor'?13:key==='currency'?3:fbTextLimit(key)} disabled={disabled} required={key==='name'||key==='currency'}/>}</label>;
    })}
   </fieldset>
   {canManage?<button disabled={pending} className="min-h-11 rounded-lg bg-[var(--admin-accent)] px-5 font-semibold text-white">{pending?'Salvando…':'Salvar conteúdo PT'}</button>:<p>Acesso somente para leitura.</p>}
 </form>;
}
export function FbReorderForm({kind,rows,parentId,canManage}:{kind:FbKind;rows:Pick<FbRecord,'id'|'name'|'revision'>[];parentId?:string;canManage:boolean}) {
 const [selectedId,setSelectedId]=useState(rows[0]?.id||'');
 const selected=rows.find(row=>row.id===selectedId)||rows[0];
 if(!canManage||rows.length<2||!selected)return null;
 return <form action={moveFbAction} className="my-4 flex flex-wrap items-end gap-3"><input type="hidden" name="kind" value={kind}/><input type="hidden" name="revision" value={selected.revision}/><input type="hidden" name="parent_id" value={parentId||''}/><input type="hidden" name="rows" value={JSON.stringify(rows.map(r=>({id:r.id,revision:r.revision})))}/><label className="min-w-0 flex-1">Reordenar conteúdo<select name="id" className={inputClass} value={selected.id} onChange={e=>setSelectedId(e.target.value)}>{rows.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="min-h-11 px-3 underline" name="direction" value="up">Subir</button><button className="min-h-11 px-3 underline" name="direction" value="down">Descer</button></form>;
}
export function FbRecordActions({kind,row,canManage}:{kind:FbKind;row:Pick<FbRecord,'id'|'revision'>;canManage:boolean}) {
 if(!canManage)return null;
 const hidden=<><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="revision" value={row.revision}/></>;
 return <form action={deleteFbAction} onSubmit={e=>{if(!window.confirm('Excluir definitivamente este conteúdo e seus dependentes?'))e.preventDefault();}}>{hidden}<input type="hidden" name="confirm_delete" value="yes"/><button className="min-h-11 px-3 text-red-700 underline">Excluir definitivamente</button></form>;
}
export function FbImagePanel({kind,row,canManage}:{kind:FbKind;row:FbRecord;canManage:boolean}) {
 if(!['outlet','item'].includes(kind))return null;
 const path='main_image_path' in row?row.main_image_path:null;
 const url=fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,path,row.hotel_id,kind,row.id);
 const hidden=<><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="revision" value={row.revision}/></>;
 return <section className="space-y-4"><h2 className="font-semibold">Imagem principal</h2>{url?<Image unoptimized src={url} alt={row.name} width={900} height={600} className="max-h-80 rounded-xl object-cover"/>:<p>Sem imagem associada.</p>}{canManage?<><form action={uploadFbImageAction}>{hidden}<label className="block">JPEG, PNG ou WebP, até 2 MiB<input className="mt-2 block" name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label><button className="mt-3 min-h-11 underline">Enviar imagem</button></form>{path?<form action={removeFbImageAction}>{hidden}<button className="min-h-11 underline">Remover imagem</button></form>:null}</>:null}</section>;
}
