'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { GuestServiceExplorer } from '@/components/public/guest-service-explorer';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { guestServiceInteraction, isOwnRoomServiceLink, guestServiceGroup, guestServiceText, readGuestServicePresentation } from '@/lib/guest-service-presentation';
import type { GuestServiceItem } from '@/lib/guest-service-catalog';
import type { PublicHotelSection } from '@/lib/public-hotel-data';
import { ServiceGuidedFields } from './service-guided-fields';
import { AdminField, AdminHelpText, AdminSelect, AdminTextInput, AdminTextarea } from '@/components/admin/ui';
import { readOptionalUrl } from '@/lib/form-utils';
import { GUEST_SERVICE_TEXT_FIELDS, parseGuestServicePresentation } from '@/lib/guest-service-presentation';

type GuestServiceFieldsProps = { initial?: unknown; title?: string; content?: string | null; icon?: string | null; themePreset?: string | null; serviceId?: string; hotelId?: string; hotelSlug?: string; hotelSubdomain?: string | null; canonicalRoomHref?: string | null; category?: string | null; actionType?: PublicHotelSection['service_action_type']; url?: string | null; cta?: string | null; hasGuide?: boolean; internalHref?: string | null; minDetailLength?: number; categoryOptions?:string[]; sortOrder?:number; enabled?:boolean; allowRoomActions?:boolean };

export function GuestServiceFields({ initial, title = 'Nome do serviço', content = null, icon = null, themePreset = null, serviceId = 'preview', hotelId = 'preview-hotel', hotelSlug = 'preview-hotel', hotelSubdomain = null, canonicalRoomHref = null, category = null, actionType = 'standard', url = null, cta = null, hasGuide = false, internalHref = null, minDetailLength = 60, categoryOptions = [], sortOrder = 0, enabled = true, allowRoomActions = false }: GuestServiceFieldsProps) {
  const value = parseGuestServicePresentation(initial);
  const container = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState({ config: value, title, content, icon, category, actionType, url, cta });
  const update = useCallback((form: HTMLFormElement) => {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '').trim() || null;
    setPreview({ config: parseGuestServicePresentation(readGuestServicePresentation(data)), title: text('title') || title, content: data.has('content') ? text('content') : content, icon: data.has('icon') ? text('icon') : icon, category: data.has('category') ? text('category') : category, actionType: (text('service_action_type') || actionType) as PublicHotelSection['service_action_type'], url: data.has('url') ? readOptionalUrl(data,'url') : url, cta: data.has('cta') ? text('cta') : cta });
  }, [title, content, icon, category, actionType, url, cta]);
  function refresh(event: SyntheticEvent<HTMLDivElement>) {
    const form = event.currentTarget.closest('form');
    if (form) update(form);
  }
  useEffect(() => {
    const form = container.current?.closest('form');
    if (!form) return;
    const listener = () => update(form);
    form.addEventListener('input', listener);
    form.addEventListener('change', listener);
    return () => { form.removeEventListener('input', listener); form.removeEventListener('change', listener); };
  }, [update]);
  const previewSection: PublicHotelSection = { id: serviceId, hotel_id: hotelId, title: preview.title, content: preview.content, icon: preview.icon, category: preview.category, service_action_type: preview.actionType, url: preview.url, cta: preview.cta, guest_presentation: preview.config, enabled: true, sort_order: 0, created_at: null, updated_at: null };
  // Destinations are supplied by the canonical server route builder. This preview never navigates or authorizes.
  const guide = hasGuide || /^(canais de tv|diretório canais - novotel)$/i.test(preview.title);
  const roomPage = isOwnRoomServiceLink(preview.url,{slug:hotelSlug,subdomain:hotelSubdomain},'libguest.digital');
  const destination = roomPage && canonicalRoomHref ? {href:canonicalRoomHref,isExternal:false} : guide || preview.actionType === 'room_restaurant_menu' ? internalHref ? {href:internalHref,isExternal:false} : null : preview.url ? {href:preview.url,isExternal:true} : internalHref && (preview.content?.trim().length || 0) >= minDetailLength ? {href:internalHref,isExternal:false} : null;
  const conditions = guestServiceText(preview.config,'conditions','pt');
  const interaction = guestServiceInteraction(preview.config,previewSection,destination,guide || roomPage,conditions);
  const previewItems: GuestServiceItem[] = [{id:serviceId,title:preview.title,content:preview.content,summary:guestServiceText(preview.config,'summary','pt'),hours:guestServiceText(preview.config,'hours','pt'),location:guestServiceText(preview.config,'location','pt'),conditions,icon:preview.icon,category:guestServiceGroup(previewSection,'pt'),area:preview.config.area || 'services',href:interaction==='detail'&&!destination?.isExternal&&preview.config.interaction!=='assistance'?null:destination?.href || null,isExternal:destination?.isExternal || false,cta:preview.cta,interaction}];
  return <div ref={container} onChange={refresh} className="col-span-full space-y-5">
    <input type="hidden" name="guest_presentation_present" value="1" />
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-lg font-semibold">1. Informações básicas</h2><AdminHelpText>Preencha em português. Inglês e espanhol são gerados ao salvar, sem preencher três vezes.</AdminHelpText><div className="mt-5 grid gap-4 md:grid-cols-2">
      <AdminField label="Nome do serviço" className="md:col-span-2"><AdminTextInput name="title" defaultValue={title==='Nome do serviço'?'':title} required maxLength={300} placeholder="Ex.: Lavanderia" /></AdminField>
      <AdminField label="Descrição completa" className="md:col-span-2"><AdminTextarea name="content" defaultValue={content||''} maxLength={30000} placeholder="Explique como utilizar o serviço e preserve as orientações do hotel." /></AdminField>
      {GUEST_SERVICE_TEXT_FIELDS.map(field=><AdminField key={field} label={{summary:'Resumo curto',hours:'Horário',location:'Localização',conditions:'Condições de utilização'}[field]} className={field==='conditions'?'md:col-span-2':undefined}>{field==='conditions'?<AdminTextarea name={`guest_${field}_pt`} defaultValue={value[field]?.pt||''} maxLength={4000} placeholder="Somente condições já definidas pelo hotel."/>:<AdminTextInput name={`guest_${field}_pt`} defaultValue={value[field]?.pt||''} maxLength={300} placeholder={{summary:'Ex.: Coleta e entrega de roupas',hours:'Ex.: Coleta até 14h',location:'Ex.: Piso L'}[field]}/>}</AdminField>)}
      <ServiceGuidedFields categoryOptions={categoryOptions} initialIcon={icon} initialCategory={category}/>
    </div></section>
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-lg font-semibold">2. Apresentação ao hóspede</h2><AdminHelpText>Use Automático para começar. Estas opções organizam o conteúdo e não habilitam pedidos.</AdminHelpText>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <AdminField label="Área pública"><AdminSelect name="guest_area" defaultValue={value.area||''}><option value="">Automática pelo conteúdo</option><option value="services">Serviços</option><option value="information">Informações</option><option value="hotel">Hotel / Início</option><option value="dining">Gastronomia</option><option value="contact">Contato</option></AdminSelect></AdminField>
        <AdminField label="Agrupamento"><AdminSelect name="guest_group" defaultValue={value.group||''}><option value="">Automático pela categoria</option><option value="comfort">Conforto e conveniência</option><option value="wellness">Lazer e bem-estar</option><option value="mobility">Mobilidade</option><option value="original">Usar categoria cadastrada</option></AdminSelect></AdminField>
        <AdminField label="Interação visual"><AdminSelect name="guest_interaction" defaultValue={value.interaction||'auto'}><option value="auto">Automática</option><option value="inline">Informação direta</option><option value="detail">Detalhe complementar</option>{internalHref||preview.url?<option value="page">Página dedicada existente</option>:null}{preview.url||preview.actionType==='external_url'?<option value="external">Link externo existente</option>:null}<option value="assistance">Orientações de atendimento</option>{hasGuide?<option value="guide">Guia vinculado</option>:null}</AdminSelect></AdminField>
        <AdminField label="Ordem de exibição"><AdminTextInput type="number" name="sort_order" min={0} defaultValue={sortOrder}/></AdminField>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="enabled" defaultChecked={enabled}/>Visível no diretório</label>
      </div>
      <section className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold">Prévia da apresentação pública</h3><p className="my-2 text-sm text-slate-600">A prévia acompanha o formulário. Links mostram o destino sem sair desta página.</p><div style={resolveHotelTheme(themePreset,null).cssVars}><GuestServiceExplorer preview language="pt" themeStyle={resolveHotelTheme(themePreset,null).cssVars} items={previewItems}/></div></section>
    </section>
    <details className="rounded-2xl border border-slate-200 p-5"><summary className="min-h-11 cursor-pointer text-lg font-semibold">3. Ações e configurações avançadas</summary><AdminHelpText>Opcional. Um serviço informativo não exige link nem configuração operacional.</AdminHelpText>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><AdminField label="Tipo de ação do serviço"><AdminSelect name="service_action_type" defaultValue={actionType}><option value="standard">Padrão</option><option value="external_url">Link externo</option>{allowRoomActions||actionType==='room_restaurant_menu'?<option value="room_restaurant_menu">Cardápio por apartamento</option>:null}</AdminSelect></AdminField>
      {preview.config.interaction!=='inline'?<AdminField label="Texto do botão"><AdminTextInput name="cta" defaultValue={cta||''} maxLength={300} placeholder="Ex.: Consultar cardápio"/></AdminField>:<input type="hidden" name="cta" value={preview.cta||''}/>}
      {preview.actionType==='external_url'||preview.url||['page','external','assistance'].includes(preview.config.interaction||'')?<AdminField label="Link ou canal existente"><AdminTextInput name="url" defaultValue={url||''} placeholder="https://..." required={preview.actionType==='external_url'}/><AdminHelpText>Use somente o destino oficial já autorizado pelo hotel.</AdminHelpText></AdminField>:<input type="hidden" name="url" value=""/>}
      {hasGuide?<p className="text-sm text-slate-600">Este serviço possui guia vinculado. O guia mantém seu editor e destino próprios abaixo.</p>:null}
      {preview.actionType==='room_restaurant_menu'?<p className="text-sm text-slate-600">O destino por apartamento continua sendo resolvido pelo QR existente.</p>:null}</div>
    </details>
  </div>;
}
