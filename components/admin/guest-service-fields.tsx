'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { GuestServiceExplorer } from '@/components/public/guest-service-explorer';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { guestServiceInteraction, isOwnRoomServiceLink, guestServiceGroup, guestServiceText, readGuestServicePresentation } from '@/lib/guest-service-presentation';
import type { GuestServiceItem } from '@/lib/guest-service-catalog';
import type { PublicHotelSection } from '@/lib/public-hotel-data';
import { AdminField, AdminHelpText, AdminSelect, AdminTextInput } from '@/components/admin/ui';
import { readOptionalUrl } from '@/lib/form-utils';
import { GUEST_SERVICE_TEXT_FIELDS, parseGuestServicePresentation } from '@/lib/guest-service-presentation';

type GuestServiceFieldsProps = { initial?: unknown; title?: string; content?: string | null; icon?: string | null; themePreset?: string | null; serviceId?: string; hotelId?: string; hotelSlug?: string; hotelSubdomain?: string | null; canonicalRoomHref?: string | null; category?: string | null; actionType?: PublicHotelSection['service_action_type']; url?: string | null; cta?: string | null; hasGuide?: boolean; internalHref?: string | null; minDetailLength?: number };

export function GuestServiceFields({ initial, title = 'Nome do serviço', content = null, icon = null, themePreset = null, serviceId = 'preview', hotelId = 'preview-hotel', hotelSlug = 'preview-hotel', hotelSubdomain = null, canonicalRoomHref = null, category = null, actionType = 'standard', url = null, cta = null, hasGuide = false, internalHref = null, minDetailLength = 60 }: GuestServiceFieldsProps) {
  const value = parseGuestServicePresentation(initial);
  const container = useRef<HTMLDetailsElement>(null);
  const [preview, setPreview] = useState({ config: value, title, content, icon, category, actionType, url, cta });
  const update = useCallback((form: HTMLFormElement) => {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '').trim() || null;
    setPreview({ config: parseGuestServicePresentation(readGuestServicePresentation(data)), title: text('title') || title, content: data.has('content') ? text('content') : content, icon: data.has('icon') ? text('icon') : icon, category: data.has('category') ? text('category') : category, actionType: (text('service_action_type') || actionType) as PublicHotelSection['service_action_type'], url: data.has('url') ? readOptionalUrl(data,'url') : url, cta: data.has('cta') ? text('cta') : cta });
  }, [title, content, icon, category, actionType, url, cta]);
  function refresh(event: SyntheticEvent<HTMLDetailsElement>) {
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
  return <details ref={container} onChange={refresh} onToggle={refresh} className="col-span-full rounded-2xl border border-slate-200 p-4">
    <summary className="min-h-11 cursor-pointer font-semibold">Apresentação ao hóspede</summary>
    <input type="hidden" name="guest_presentation_present" value="1" />
    <AdminHelpText>O resumo aparece na lista; a descrição completa permanece no detalhe. Deixe em automático para preservar o comportamento existente. Esta configuração não habilita pedidos ou atendimento digital.</AdminHelpText>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <AdminField label="Área pública"><AdminSelect name="guest_area" defaultValue={value.area || ''}>
        <option value="">Automática (Serviços)</option><option value="services">Serviços</option><option value="information">Informações</option><option value="hotel">Hotel / Início</option><option value="dining">Gastronomia</option><option value="contact">Contato</option>
      </AdminSelect></AdminField>
      <AdminField label="Agrupamento"><AdminSelect name="guest_group" defaultValue={value.group || ''}>
        <option value="">Automático pela categoria</option><option value="comfort">Conforto e conveniência</option><option value="wellness">Lazer e bem-estar</option><option value="mobility">Mobilidade</option><option value="original">Usar categoria cadastrada</option>
      </AdminSelect></AdminField>
      <AdminField label="Interação visual"><AdminSelect name="guest_interaction" defaultValue={value.interaction || 'auto'}>
        <option value="auto">Automática</option><option value="inline">Informação direta</option><option value="detail">Detalhe complementar</option><option value="page">Página dedicada</option><option value="external">Link externo existente</option><option value="assistance">Orientações de atendimento</option><option value="guide">Guia estruturado</option>
      </AdminSelect></AdminField>
    </div>
    <AdminHelpText>Idiomas opcionais, com fallback por campo para português. Revise as traduções abaixo; título e descrição continuam usando o fluxo de tradução do cadastro.</AdminHelpText>
    <div className="mt-4 grid gap-4 md:grid-cols-3">{(['pt', 'en', 'es'] as const).map(language => <fieldset key={language} className="space-y-3"><legend className="mb-3 font-medium">{language.toUpperCase()}</legend>{GUEST_SERVICE_TEXT_FIELDS.map(field => <AdminField key={field} label={{ summary: 'Resumo curto', hours: 'Horário', location: 'Localização', conditions: 'Condições de utilização' }[field]}><AdminTextInput name={`guest_${field}_${language}`} defaultValue={value[field]?.[language] || ''} maxLength={field === 'conditions' ? 4000 : 300} /></AdminField>)}</fieldset>)}</div>
    <section className="mt-6 border-t border-slate-200 pt-4"><h3 className="font-semibold">Prévia da apresentação pública</h3><p className="my-2 text-sm text-slate-600">Confira o comportamento público em português. Links mostram o destino sem sair da prévia; ela não autoriza atendimento ou pedidos.</p><div style={resolveHotelTheme(themePreset, null).cssVars}><GuestServiceExplorer preview language="pt" themeStyle={resolveHotelTheme(themePreset, null).cssVars} items={previewItems} /></div></section>
  </details>;
}
