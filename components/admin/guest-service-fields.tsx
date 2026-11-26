'use client';

import { useState, type SyntheticEvent } from 'react';
import { GuestServiceExplorer } from '@/components/public/guest-service-explorer';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { guestServiceGroup, guestServiceText, readGuestServicePresentation } from '@/lib/guest-service-presentation';
import { AdminField, AdminHelpText, AdminSelect, AdminTextInput } from '@/components/admin/ui';
import { GUEST_SERVICE_TEXT_FIELDS, parseGuestServicePresentation } from '@/lib/guest-service-presentation';

export function GuestServiceFields({ initial, title = 'Nome do serviço', content = null, icon = null, themePreset = null }: { initial?: unknown; title?: string; content?: string | null; icon?: string | null; themePreset?: string | null }) {
  const value = parseGuestServicePresentation(initial);
  const [preview, setPreview] = useState({ config: value, title, content, icon });
  function refresh(event: SyntheticEvent<HTMLDetailsElement>) {
    const form = event.currentTarget.closest('form');
    if (!form) return;
    const data = new FormData(form);
    setPreview({ config: parseGuestServicePresentation(readGuestServicePresentation(data)), title: String(data.get('title') || title), content: String(data.get('content') || content || ''), icon: String(data.get('icon') || icon || '') });
  }
  return <details onChange={refresh} onToggle={refresh} className="col-span-full rounded-2xl border border-slate-200 p-4">
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
    <section className="mt-6 border-t border-slate-200 pt-4"><h3 className="font-semibold">Prévia da apresentação pública</h3><p className="my-2 text-sm text-slate-600">Confira resumo e detalhes em português. Os canais reais continuam definidos no cadastro.</p><div style={resolveHotelTheme(themePreset, null).cssVars}><GuestServiceExplorer language="pt" themeStyle={resolveHotelTheme(themePreset, null).cssVars} items={[{ id: 'admin-preview', title: preview.title, content: preview.content, icon: preview.icon, summary: guestServiceText(preview.config, 'summary', 'pt'), hours: guestServiceText(preview.config, 'hours', 'pt'), location: guestServiceText(preview.config, 'location', 'pt'), conditions: guestServiceText(preview.config, 'conditions', 'pt'), category: guestServiceGroup({ category: null, icon: preview.icon, guest_presentation: preview.config }, 'pt'), href: null, isExternal: false, cta: null, area: 'services', interaction: preview.config.interaction === 'inline' ? 'inline' : 'detail' }]} /></div></section>
  </details>;
}
