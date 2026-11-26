'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight, Clock3, MapPin, Search, X } from 'lucide-react';
import { ServiceIcon } from '@/components/service-icon';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { normalizeGuestSearch } from '@/lib/guest-service-presentation';
import type { GuestServiceItem } from '@/lib/guest-service-catalog';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const copy = {
  pt: { search: 'Buscar serviços', all: 'Todos', clear: 'Limpar busca e filtros', close: 'Fechar', empty: 'Nenhum serviço encontrado', hint: 'Tente outro termo ou veja todos os serviços.', one: 'serviço encontrado', many: 'serviços encontrados', details: 'Ver detalhes', conditions: 'Condições de utilização' },
  en: { search: 'Search services', all: 'All', clear: 'Clear search and filters', close: 'Close', empty: 'No services found', hint: 'Try another term or view all services.', one: 'service found', many: 'services found', details: 'View details', conditions: 'Terms of use' },
  es: { search: 'Buscar servicios', all: 'Todos', clear: 'Borrar búsqueda y filtros', close: 'Cerrar', empty: 'No se encontraron servicios', hint: 'Pruebe otro término o vea todos los servicios.', one: 'servicio encontrado', many: 'servicios encontrados', details: 'Ver detalles', conditions: 'Condiciones de uso' },
};

function Metadata({ item }: { item: GuestServiceItem }) {
  return item.hours || item.location ? <span className="guest-service-metadata">{item.hours ? <span><Clock3 aria-hidden />{item.hours}</span> : null}{item.location ? <span><MapPin aria-hidden />{item.location}</span> : null}</span> : null;
}

/** The same accessible dialog primitive powers a mobile sheet and desktop modal. */
export function GuestServiceExplorer({ items, language, themeStyle }: { items: GuestServiceItem[]; language: SupportedPublicLanguage; themeStyle?: CSSProperties }) {
  const labels = copy[language];
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<GuestServiceItem | null>(null);
  const historyOpen = useRef(false), trigger = useRef<HTMLElement | null>(null);
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items]);
  const visible = useMemo(() => items.filter(i => (category === 'all' || i.category === category) && normalizeGuestSearch([i.title, i.content, i.summary, i.hours, i.location, i.conditions, i.category].join(' ')).includes(normalizeGuestSearch(query))), [category, items, query]);
  const groups = categories.map(name => ({ name, items: visible.filter(i => i.category === name) })).filter(g => g.items.length);
  useEffect(() => {
    const pop = () => { if (historyOpen.current) { historyOpen.current = false; setSelected(null); trigger.current?.focus({ preventScroll: true }); } };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  function open(item: GuestServiceItem, element: HTMLElement) {
    trigger.current = element;
    window.history.pushState({ ...window.history.state, guestServiceDetail: item.id }, '', window.location.href);
    historyOpen.current = true;
    setSelected(item);
  }
  function close() {
    setSelected(null);
    if (historyOpen.current) { historyOpen.current = false; window.history.back(); }
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  function reset() { setQuery(''); setCategory('all'); }
  return <div className="guest-services">
    <div className="guest-service-search"><Search aria-hidden /><input type="search" aria-label={labels.search} placeholder={labels.search} value={query} onChange={event => setQuery(event.target.value)} />{query ? <button type="button" onClick={reset} aria-label={labels.clear}><X aria-hidden /></button> : null}</div>
    {items.length >= 8 && categories.length > 1 ? <div className="guest-service-categories" aria-label={labels.all}>{['all', ...categories].map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name === 'all' ? labels.all : name}</button>)}</div> : null}
    <div role="status" className="guest-service-result">{query || category !== 'all' ? `${visible.length} ${visible.length === 1 ? labels.one : labels.many}` : ''}</div>
    {groups.length ? <div className="guest-service-groups">{groups.map(group => <section key={group.name} className="guest-service-group"><h2>{group.name}</h2><div className="guest-service-surface">{group.items.map(item => {
      const actionable = item.interaction !== 'inline';
      const summary = item.interaction === 'inline' ? [item.content || item.summary, item.conditions].filter(Boolean).join('\n') : item.summary || item.content?.split(/\n|(?<=[.!?])\s/)[0];
      const body = <><span className="guest-service-icon"><ServiceIcon iconName={item.icon} className="h-5 w-5" /></span><span className="guest-service-text"><strong>{item.title}</strong>{summary ? <span className="guest-service-summary">{summary}</span> : null}<Metadata item={item} /></span>{actionable ? <ChevronRight aria-hidden className="guest-service-chevron" /> : null}</>;
      return <div key={item.id} className="guest-service-row">{item.interaction === 'page' && item.href ? <a href={item.href} target={item.isExternal ? '_blank' : undefined} rel={item.isExternal ? 'noreferrer' : undefined}>{body}</a> : item.interaction === 'detail' ? <button type="button" aria-haspopup="dialog" onClick={event => open(item, event.currentTarget)}>{body}</button> : <div>{body}</div>}</div>;
    })}</div></section>)}</div> : <div className="guest-service-empty"><Search aria-hidden /><h2>{labels.empty}</h2><p>{labels.hint}</p><button type="button" onClick={reset}>{labels.clear}</button></div>}
    <Dialog open={Boolean(selected)} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="guest-service-sheet" style={themeStyle} showCloseButton={false}>
        {selected ? <><div className="guest-service-sheet-heading"><span className="guest-service-icon"><ServiceIcon iconName={selected.icon} className="h-6 w-6" /></span><DialogTitle>{selected.title}</DialogTitle><DialogClose aria-label={labels.close}><X aria-hidden /></DialogClose></div><Metadata item={selected} /><DialogDescription className="guest-service-description">{selected.content || selected.summary}</DialogDescription>{selected.isExternal && selected.href ? <a className="guest-service-sheet-cta" href={selected.href} target="_blank" rel="noreferrer">{selected.cta || labels.details}</a> : null}{selected.conditions ? <section><h3>{labels.conditions}</h3><p className="guest-service-description">{selected.conditions}</p></section> : null}</> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
