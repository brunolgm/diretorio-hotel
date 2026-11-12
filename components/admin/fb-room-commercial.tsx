'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveRoomCommercialDraft } from '@/app/admin/cardapio/comercial/actions';
import { money } from '@/lib/fb/orders/journey';
import type { ComboDraft, CommercialItem, ModifierDraft, RoomCommercial } from '@/lib/fb/room-commercial';
import { AdminSurface } from './ui';

const path = '/admin/cardapio/comercial';
const field = 'min-h-11 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2';
const secondary = 'inline-flex min-h-11 items-center rounded-lg border border-[var(--admin-border)] px-3 py-2';
const primary = 'inline-flex min-h-11 items-center rounded-lg bg-[var(--admin-accent)] px-4 py-2 font-semibold text-[var(--admin-accent-foreground,#fff)] disabled:opacity-50';
const block = 'space-y-3 rounded-xl border border-[var(--admin-border)] p-3';
const toPrice = (amount: number) => (amount / 100).toFixed(2);
const toMinor = (amount: string) => Math.round(Number(amount) * 100);
const labelOf = (items: CommercialItem[], id: string) => items.find(item => item.id === id)?.name ?? 'Produto fora da oferta atual';

type Kind = 'combo' | 'group';
type Props = { data: RoomCommercial; kind: Kind | null; draft?: ComboDraft | ModifierDraft };

function DraftEditor({ data, kind, draft }: Omit<Props,'kind'> & {kind: Kind}) {
  const combo = draft && 'slots' in draft ? draft : undefined;
  const group = draft && 'options' in draft ? draft : undefined;
  const [name, setName] = useState(draft?.name ?? (kind === 'group' ? 'Adicionais' : ''));
  const [menu, setMenu] = useState(combo?.menu_id ?? data.menus[0]?.id ?? '');
  const [price, setPrice] = useState(combo ? toPrice(combo.amount_minor) : '');
  const [slots, setSlots] = useState(combo?.slots ?? [{ name: '', choices: [''] }, { name: '', choices: [''] }]);
  const [item, setItem] = useState(group?.item_id ?? '');
  const [maximum, setMaximum] = useState(group?.max_selected ?? 1);
  const [options, setOptions] = useState(group?.options.map(value => ({
    name: value.name, price: toPrice(value.amount_minor),
  })) ?? [{ name: '', price: '' }]);
  const [state, submit, pending] = useActionState(saveRoomCommercialDraft, {});
  const menuItems = data.items.filter(item => item.menu_id === menu);
  const payload = kind === 'combo'
    ? { name, menu_id: menu, amount_minor: toMinor(price), slots }
    : { name, item_id: item, max_selected: maximum, options: options.map(value => ({ name:value.name, amount_minor:toMinor(value.price) })) };

  return <AdminSurface>
    <h2 className="mb-4 text-xl font-semibold">{draft ? 'Editar rascunho' : kind === 'combo' ? 'Novo combo' : 'Novo grupo de adicionais'}</h2>
    <form action={submit} className="space-y-4">
      <input type="hidden" name="kind" value={kind}/>
      <input type="hidden" name="id" value={draft?.id ?? ''}/>
      <input type="hidden" name="revision" value={draft?.revision ?? 0}/>
      <input type="hidden" name="draft" value={JSON.stringify(payload)}/>
      <label className="block">Nome<input className={field} required maxLength={160} value={name} onChange={event=>setName(event.target.value)}/></label>
      {kind === 'combo' ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Cardápio<select className={field} required value={menu} onChange={event=>{
            setMenu(event.target.value);
            setSlots(current=>current.map(slot=>({...slot,choices:slot.choices.map(()=> '')})));
          }}>
            <option value="">Selecione um cardápio</option>
            {data.menus.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          <label>Preço do combo (R$)<input className={field} required type="number" min="0" max="1000000" step=".01" value={price} onChange={event=>setPrice(event.target.value)}/></label>
        </div>
        <p className="text-sm text-[var(--admin-muted)]">O hóspede escolhe um produto em cada componente obrigatório.</p>
        {slots.map((slot,index)=><fieldset key={index} className={block}>
          <legend className="px-1 font-medium">Componente {index+1}</legend>
          <label className="block">Nome do componente<input className={field} required maxLength={160} value={slot.name}
            onChange={event=>setSlots(current=>current.map((value,i)=>i===index?{...value,name:event.target.value}:value))}/></label>
          {slot.choices.map((id,choiceIndex)=><div key={choiceIndex} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">Produto {choiceIndex+1}
              <select className={field} required value={id} onChange={event=>setSlots(current=>current.map((value,i)=>i===index
                ? {...value,choices:value.choices.map((choice,j)=>j===choiceIndex?event.target.value:choice)}:value))}>
                <option value="">Selecione um produto</option>
                {menuItems.map(value=><option key={value.id} value={value.id} disabled={value.id!==id&&slot.choices.includes(value.id)}>{value.name}</option>)}
              </select>
            </label>
            {slot.choices.length>1?<button type="button" className={secondary}
              onClick={()=>setSlots(current=>current.map((value,i)=>i===index?{...value,choices:value.choices.filter((_,j)=>j!==choiceIndex)}:value))}>Remover opção</button>:null}
          </div>)}
          <div className="flex flex-wrap gap-2">
            {slot.choices.length<8?<button type="button" className={secondary}
              onClick={()=>setSlots(current=>current.map((value,i)=>i===index?{...value,choices:[...value.choices,'']}:value))}>Adicionar opção</button>:null}
            {slots.length>2?<button type="button" className={secondary} onClick={()=>setSlots(current=>current.filter((_,i)=>i!==index))}>Remover componente</button>:null}
          </div>
        </fieldset>)}
        {slots.length<8?<button type="button" className={secondary} onClick={()=>setSlots(current=>[...current,{name:'',choices:['']}])}>Adicionar componente</button>:null}
      </> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Produto<select className={field} required value={item} disabled={Boolean(group)} onChange={event=>setItem(event.target.value)}>
            <option value="">Selecione um produto</option>
            {data.items.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          <label>Máximo de escolhas por produto<input className={field} required type="number" min={1} max={options.length}
            value={Number.isNaN(maximum) ? '' : maximum} onChange={event=>setMaximum(event.target.valueAsNumber)}/></label>
        </div>
        <p className="text-sm text-[var(--admin-muted)]">A escolha de adicionais é opcional.</p>
        {options.map((option,index)=><fieldset key={index} className={block}>
          <legend className="px-1 font-medium">Adicional {index+1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Nome da opção<input className={field} required maxLength={160} value={option.name} onChange={event=>setOptions(current=>
              current.map((value,i)=>i===index?{...value,name:event.target.value}:value))}/></label>
            <label>Acréscimo (R$)<input className={field} required type="number" min="0" max="1000000" step=".01" value={option.price}
              onChange={event=>setOptions(current=>current.map((value,i)=>i===index?{...value,price:event.target.value}:value))}/></label>
          </div>
          {options.length>1?<button type="button" className={secondary} onClick={()=>{
            setMaximum(current=>Math.min(current,options.length-1));
            setOptions(current=>current.filter((_,i)=>i!==index));
          }}>Remover adicional</button>:null}
        </fieldset>)}
        {options.length<12?<button type="button" className={secondary} onClick={()=>setOptions(current=>[...current,{name:'',price:''}])}>Adicionar adicional</button>:null}
      </>}
      {state.error?<p role="alert" className="text-red-700">{state.error}</p>:null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primary}>{pending ? 'Salvando…' : 'Salvar rascunho'}</button>
        <Link href={path} className={secondary}>Cancelar</Link>
      </div>
    </form>
  </AdminSurface>;
}

export function FbRoomCommercial({ data, kind, draft }: Props) {
  if (kind) return <DraftEditor data={data} kind={kind} draft={draft}/>;
  return <div className="grid gap-4 xl:grid-cols-2">
    <AdminSurface className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Combos</h2><Link href={path+'?tipo=combo'} className={secondary}>Novo combo</Link></div>
      {data.combos.length === 0 ? <p>Nenhum combo do Room Service.</p> : null}
      {data.combos.map(combo=><article key={combo.id} className={block}>
        <h3 className="font-semibold">{combo.name} · {money(combo.amount_minor,'BRL','pt')}</h3>
        <p className="text-sm">{combo.active?'Publicado':'Rascunho'}</p>
        <ul className="space-y-1">{combo.slots.map((slot,index)=><li key={index}><strong>{slot.name}</strong> · {slot.choices.map(id=>labelOf(data.items,id)).join(' ou ')}</li>)}</ul>
        {!combo.active?<Link className="underline" href={path+'?tipo=combo&editar='+combo.id}>Editar {combo.name}</Link>:null}
      </article>)}
    </AdminSurface>
    <AdminSurface className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Adicionais</h2><Link href={path+'?tipo=group'} className={secondary}>Novo grupo de adicionais</Link></div>
      {data.groups.length === 0 ? <p>Nenhum grupo do Room Service.</p> : null}
      {data.groups.map(group=><article key={group.id} className={block}>
        <h3 className="font-semibold">{labelOf(data.items,group.item_id)} · {group.name}</h3>
        <p className="text-sm">{group.active?'Ativo':'Rascunho'} · até {group.max_selected} {group.max_selected===1?'opção':'opções'}</p>
        <ul className="space-y-1">{group.options.map((option,index)=><li key={index}>{option.name} · +{money(option.amount_minor,'BRL','pt')}</li>)}</ul>
        {!group.active?<Link className="underline" href={path+'?tipo=group&editar='+group.id}>Editar {group.name} de {labelOf(data.items,group.item_id)}</Link>:null}
      </article>)}
    </AdminSurface>
  </div>;
}
