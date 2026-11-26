'use client';
import {useActionState,useState} from 'react';
import {saveRoomNameTranslation} from '@/app/admin/cardapio/comercial/traducoes/actions';
import {ROOM_NAME_KINDS,roomNameKindLabels,type RoomNameEditorRow,type RoomNameActionState} from '@/lib/fb/room-name-translations';
import {AdminSurface} from './ui';

const field='min-h-11 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2';
const button='min-h-11 rounded-lg border border-[var(--admin-border)] px-4 py-2 disabled:opacity-50';

function TranslationCard({row}:{row:RoomNameEditorRow}) {
  const [en,setEn]=useState(row.name_en??''),[es,setEs]=useState(row.name_es??'');
  const [state,submit,pending]=useActionState<RoomNameActionState,FormData>(saveRoomNameTranslation,{});
  const saved=state.success&&state.saved_en===en.trim()&&state.saved_es===es.trim();
  return <article className="space-y-3 rounded-xl border border-[var(--admin-border)] p-4" aria-label={row.source_name+' · '+row.context_name}>
    <div><p className="text-xs text-[var(--admin-muted)]">{roomNameKindLabels[row.kind]} · {row.context_name}</p>
      <h2 className="font-semibold">{row.source_name}</h2><p className="text-sm text-[var(--admin-muted)]">Nome original em português</p></div>
    {row.stale&&!saved?<p role="status" className="text-sm">O nome em português mudou. Revise as duas traduções antes de salvar.</p>:null}
    <form action={submit} className="space-y-3">
      <input type="hidden" name="kind" value={row.kind}/><input type="hidden" name="id" value={row.id}/>
      <input type="hidden" name="source_name" value={row.source_name}/><input type="hidden" name="revision" value={state.revision??row.revision}/>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">Nome em inglês<input className={field} name="name_en" lang="en" maxLength={160} value={en} onChange={event=>setEn(event.target.value)}/></label>
        <label className="block">Nome em espanhol<input className={field} name="name_es" lang="es" maxLength={160} value={es} onChange={event=>setEs(event.target.value)}/></label>
      </div>
      <p className="text-xs text-[var(--admin-muted)]">Um campo vazio mantém o nome em português nesse idioma.</p>
      {state.error?<p role="alert" className="text-sm">{state.error}</p>:null}
      {saved?<p role="status" className="text-sm">{state.success}</p>:null}
      <button className={button+' bg-[var(--admin-accent)] text-[var(--admin-accent-foreground,#fff)]'} type="submit" disabled={pending}>{pending?'Salvando…':'Salvar traduções'}</button>
    </form>
  </article>;
}

export function FbRoomNameTranslations({rows}:{rows:RoomNameEditorRow[]}) {
  const [search,setSearch]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(0);
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const filtered=rows.filter(row=>(!kind||row.kind===kind)&&(!query||[row.source_name,row.context_name,row.name_en,row.name_es].some(text=>text?.toLocaleLowerCase('pt-BR').includes(query))));
  const pages=Math.max(1,Math.ceil(filtered.length/20)),currentPage=Math.min(page,pages-1);
  return <AdminSurface className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Buscar nomes<input className={field} type="search" value={search} placeholder="Nome em português, inglês ou espanhol" onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
      <label>Tipo de conteúdo<select className={field} value={kind} onChange={event=>{setKind(event.target.value);setPage(0);}}>
        <option value="">Todos os tipos ({rows.length})</option>{ROOM_NAME_KINDS.map(value=><option key={value} value={value}>{roomNameKindLabels[value]} ({rows.filter(row=>row.kind===value).length})</option>)}
      </select></label>
    </div>
    <p role="status" className="text-sm">{filtered.length} nome(s) encontrado(s) · página {currentPage+1} de {pages}</p>
    {!filtered.length?<p>Nenhum nome encontrado. Tente outra busca ou tipo.</p>:null}
    <div className="space-y-3">{filtered.slice(currentPage*20,currentPage*20+20).map(row=><TranslationCard key={row.kind+':'+row.id+':'+row.source_name} row={row}/>)}</div>
    {pages>1?<nav aria-label="Páginas das traduções" className="flex flex-wrap gap-2">
      <button className={button} type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Página anterior</button>
      <button className={button} type="button" disabled={currentPage+1===pages} onClick={()=>setPage(currentPage+1)}>Próxima página</button>
    </nav>:null}
  </AdminSurface>;
}
