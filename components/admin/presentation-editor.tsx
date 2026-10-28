'use client';
import {useState} from 'react';
import {BENEFIT_ICONS,type EditorialText,type PublicPresentation} from '@/lib/public-presentation';
export function PresentationEditor({initial,revision,action}:{initial:PublicPresentation;revision:number;action:(form:FormData)=>Promise<void>}){
 const [config,setConfig]=useState(initial);
 const [cardKeys,setCardKeys]=useState(()=>initial.tourism.cards.map((_,i)=>'card-'+i));
 const edit=(fn:(c:PublicPresentation)=>void)=>setConfig(prev=>{const next=structuredClone(prev);fn(next);return next;});
 const fields=(label:string,text:EditorialText,change:(lang:keyof EditorialText,value:string)=>void,maxLength:number)=><fieldset className="space-y-2"><legend className="font-medium">{label}</legend><div className="grid gap-3 md:grid-cols-3">{(['pt','en','es'] as const).map(lang=><label key={lang} className="text-sm">{lang.toUpperCase()}<input className="mt-1 w-full rounded border p-2" value={text[lang]} maxLength={maxLength} onChange={e=>change(lang,e.target.value)}/></label>)}</div></fieldset>;
 return <form action={action} className="space-y-6">
  <input type="hidden" name="revision" value={revision}/><input type="hidden" name="configuration" value={JSON.stringify(config)}/>
  <fieldset className="space-y-3 rounded-xl border p-4"><legend>Hero</legend>
   <label className="flex gap-2"><input type="checkbox" checked={config.heroTitleMode==='hotel_name'} onChange={e=>edit(c=>{c.heroTitleMode=e.target.checked?'hotel_name':'media_title';})}/>Usar nome do hotel como título</label>
   <label className="flex gap-2"><input type="checkbox" checked={!!config.heroDesktopFocal} onChange={e=>edit(c=>{c.heroDesktopFocal=e.target.checked?{x:50,y:50}:null;})}/>Ajustar enquadramento desktop nesta composição</label>
   {config.heroDesktopFocal? <div className="flex gap-4">{(['x','y'] as const).map(axis=><label key={axis}>Focal {axis.toUpperCase()} (%)<input type="number" min={0} max={100} required value={config.heroDesktopFocal![axis]} onChange={e=>edit(c=>{c.heroDesktopFocal![axis]=Number(e.target.value);})} className="ml-2 w-20 rounded border p-2"/></label>)}</div>:null}
   <p className="text-sm">O enquadramento mobile e os textos da mídia permanecem independentes.</p>
  </fieldset>
  <section className="space-y-4"><h2 className="text-xl font-semibold">Benefícios editoriais</h2>{config.benefits.map((b,i)=><fieldset key={i} className="space-y-3 rounded-xl border p-4">
   <label>Ícone <select value={b.icon} onChange={e=>edit(c=>{c.benefits[i].icon=e.target.value as typeof b.icon;})} className="rounded border p-2">{BENEFIT_ICONS.map(icon=><option key={icon} value={icon}>{{location:'Localização',bed:'Hospedagem',pool:'Piscina',fitness:'Bem-estar'}[icon]}</option>)}</select></label>
   {fields('Benefício',b.label,(lang,value)=>edit(c=>{c.benefits[i].label[lang]=value;}),120)}
   <button type="button" onClick={()=>edit(c=>{c.benefits.splice(i,1);})} className="underline">Remover benefício</button>
  </fieldset>)}<button type="button" disabled={config.benefits.length>=8} onClick={()=>edit(c=>{c.benefits.push({icon:'location',label:{pt:'',en:'',es:''}});})} className="rounded border p-3">Adicionar benefício</button></section>
  <section className="space-y-4"><h2 className="text-xl font-semibold">Apresentação editorial de Turismo</h2><p>Imagens ilustrativas e títulos editoriais. Os cards levam ao catálogo de Turismo e só aparecem quando o módulo e o conteúdo canônico são elegíveis.</p>
   {fields('Título',config.tourism.title,(lang,value)=>edit(c=>{c.tourism.title[lang]=value;}),160)}
   {fields('Texto de apoio',config.tourism.description,(lang,value)=>edit(c=>{c.tourism.description[lang]=value;}),600)}
   {config.tourism.cards.map((card,i)=><fieldset key={cardKeys[i]} className="space-y-3 rounded-xl border p-4"><legend>Card {i+1}</legend>
    {fields('Título do card',card.title,(lang,value)=>edit(c=>{c.tourism.cards[i].title[lang]=value;}),120)}
    <label className="block">Imagem ilustrativa {card.image_path?'(imagem já associada)':''}<input className="block py-2" type="file" name={`image_${i}`} accept="image/jpeg,image/png,image/webp"/></label>
    <div className="flex gap-4"><button type="button" disabled={i===0} onClick={()=>{setCardKeys(keys=>{const next=[...keys];[next[i-1],next[i]]=[next[i],next[i-1]];return next;});edit(c=>{[c.tourism.cards[i-1],c.tourism.cards[i]]=[c.tourism.cards[i],c.tourism.cards[i-1]];});}}>Mover para cima</button><button type="button" onClick={()=>{setCardKeys(keys=>keys.filter((_,index)=>index!==i));edit(c=>{c.tourism.cards.splice(i,1);});}} className="underline">Remover card</button></div>
   </fieldset>)}
   <button type="button" disabled={config.tourism.cards.length>=16} onClick={()=>{setCardKeys(keys=>[...keys,crypto.randomUUID()]);edit(c=>{c.tourism.cards.push({title:{pt:'',en:'',es:''},image_path:null});});}} className="rounded border p-3">Adicionar card</button>
  </section><button className="rounded bg-[var(--admin-accent)] px-5 py-3 text-white">Salvar apresentação</button>
 </form>;
}
