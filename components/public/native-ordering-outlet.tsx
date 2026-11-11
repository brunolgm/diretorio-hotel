'use client';
import Image from 'next/image';
import {FbCatalog} from './fb-catalog';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {money,orderCopy,publicOrderStatus,type Basket,type ComboChoice,type Language,type LineIntent,type ModifierGroup,type NativeOutlet,type OrderIntent,type Product,type Quote,type Receipt} from '@/lib/fb/orders/journey';
import './native-ordering.css';
import {SmartMenuProduct, SmartMenuRecommendations, SmartMenuCartItem, smartMenuCopy} from './smartmenu-parts';
import {smartLineEstimate} from '@/lib/fb/smartmenu';

async function post<T>(slug:string,operation:string,body:unknown):Promise<T>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch('/api/fb/hotel/'+slug+'/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(body),signal:controller.signal});const data=await r.json();if(!r.ok)throw new ApiError(typeof data.error==='string'?data.error:'unavailable');return data;}finally{clearTimeout(timer);}}
class ApiError extends Error {}
type CartLine={clientId:string;intent:LineIntent;currency:string};
type Attempt={key:string;quote:Quote;intent:OrderIntent};
function requiredGroups(groups:ModifierGroup[],selected:string[]){return groups.every(g=>{const n=g.options.filter(o=>selected.includes(o.id)).length;return n>=g.min&&n<=g.max;});}

function ModifierFields({groups,selected,onChange,language,prefix,currency}:{groups:ModifierGroup[];selected:string[];onChange:(ids:string[])=>void;language:Language;prefix:string;currency:string}){
 const t=orderCopy(language);
 return groups.map(g=><fieldset key={g.id} className="fb-order-fieldset"><legend>{g.name} · {g.min}–{g.max}</legend>{g.options.map(o=><label key={o.id} className="fb-order-option"><input type={g.selection==='single'?'radio':'checkbox'} name={prefix+g.id} value={o.id} checked={selected.includes(o.id)} onChange={e=>{
  const other=selected.filter(id=>g.selection==='single'?!g.options.some(x=>x.id===id):id!==o.id);
  onChange(e.target.checked?[...other,o.id]:other);
 }}/><span>{o.name}{o.amount_minor>0?<> · {t.extra} {money(o.amount_minor,currency,language)}</>:null}</span></label>)}{g.min===0&&g.selection==='single'?<button type="button" onClick={()=>onChange(selected.filter(id=>!g.options.some(o=>o.id===id)))}>{t.remove}</button>:null}</fieldset>);
}
function Composer({product,language,onClose,onAdd,smartMenu=false,allowAdd=true,replacing=false}:{product:Product;language:Language;onClose:()=>void;onAdd:(line:LineIntent)=>void;smartMenu?:boolean;allowAdd?:boolean;replacing?:boolean}){
 const t=orderCopy(language);const dialog=useRef<HTMLDialogElement>(null);
 const [options,setOptions]=useState<string[]>([]);const [choices,setChoices]=useState<Record<string,string[]>>({});const [choiceOptions,setChoiceOptions]=useState<Record<string,string[]>>({});const [quantity,setQuantity]=useState(1);const [note,setNote]=useState('');const [error,setError]=useState('');
 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();},[]);
 useEffect(()=>{
  if(!smartMenu)return;
  const node=dialog.current;
  const viewport=window.visualViewport;
  const resize=()=>{
   const height=viewport?.height??window.innerHeight;
   node?.style.setProperty('--smartmenu-dialog-height',Math.max(120,height-16)+'px');
   node?.style.setProperty('--smartmenu-dialog-center',((viewport?.offsetTop??0)+height/2)+'px');
  };
  resize();
  viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);};
 },[smartMenu]);
 function submit(e:FormEvent){e.preventDefault();if(!allowAdd)return;
  const valid=product.kind==='item'?requiredGroups(product.groups,options):(product.slots||[]).every(s=>{const ids=choices[s.id]||[];return ids.length>=s.min&&ids.length<=s.max&&ids.every(id=>{const c=s.choices.find(c=>c.id===id);return c?.item.available&&requiredGroups(c.item.groups,choiceOptions[id]||[]);});});
  if(!valid){setError(t.select);return;}
  const common={id:product.id,menu_id:product.menu_id,quantity,note:note.replace(/\r\n/g,'\n')};
  onAdd(product.kind==='item'?{...common,kind:'item',options}:{...common,kind:'combo',choices:Object.values(choices).flat().map(id=>({id,options:choiceOptions[id]||[]}))});
 }
 return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className="fb-order-dialog" aria-labelledby="fb-composer-title"><form onSubmit={submit}>
  <div className="fb-order-between"><h3 id="fb-composer-title">{product.name}</h3><button type="button" onClick={onClose}>{t.close}</button></div>
  {smartMenu&&product.image_url?<Image unoptimized src={product.image_url} alt="" width={900} height={600} className="smartmenu-detail-photo"/>:null}
  {smartMenu&&product.description?<p>{product.description}</p>:null}
  {smartMenu&&product.allergens?<p>{product.allergens}</p>:null}
  <p>{product.amount_minor===null?t.unavailable:money(product.amount_minor,product.currency,language)}</p>
  {product.kind==='combo'?<p>{t.comboNotice}</p>:null}
  <ModifierFields groups={product.groups} selected={options} onChange={setOptions} language={language} prefix="item-" currency={product.currency}/>
  {product.slots?.map(s=><fieldset key={s.id} className="fb-order-fieldset"><legend>{s.name} · {s.min}–{s.max} · ×{s.multiplicity}</legend>{s.choices.map((c:ComboChoice)=><div key={c.id}>
   <label className="fb-order-option"><input type={s.max===1?'radio':'checkbox'} name={s.id} disabled={!c.item.available} checked={(choices[s.id]||[]).includes(c.id)} onChange={e=>setChoices(v=>({...v,[s.id]:e.target.checked?s.max===1?[c.id]:[...(v[s.id]||[]),c.id]:(v[s.id]||[]).filter(id=>id!==c.id)}))}/><span>{c.item.name}{c.extra_minor>0?' · +'+money(c.extra_minor,product.currency,language):''}{!c.item.available?' · '+t.unavailable:''}</span></label>
   {(choices[s.id]||[]).includes(c.id)?<ModifierFields groups={c.item.groups} selected={choiceOptions[c.id]||[]} onChange={ids=>setChoiceOptions(v=>({...v,[c.id]:ids}))} language={language} prefix={c.id} currency={product.currency}/>:null}
  </div>)}{s.min===0?<button type="button" onClick={()=>setChoices(v=>({...v,[s.id]:[]}))}>{t.remove}</button>:null}</fieldset>)}
  <label className="fb-order-field">{t.quantity}<input type="number" min={1} max={20} required value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
  <label className="fb-order-field">{t.itemNote}<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
  {error?<p role="alert">{error}</p>:null}<button className="fb-order-primary" type="submit" disabled={!allowAdd}>{replacing?smartMenuCopy[language].replace:t.add}</button>
 </form></dialog>;
}

export function NativeOrderingOutlet({initial,slug,language,hasRoomContext,premium=false,concealed=false,smartMenu=false}:{initial:NativeOutlet;slug:string;language:Language;hasRoomContext:boolean;premium?:boolean;concealed?:boolean;smartMenu?:boolean}){
 const t=orderCopy(language);const [outlet,setOutlet]=useState(initial);const [room,setRoom]=useState(hasRoomContext);const [product,setProduct]=useState<Product|null>(null);const [cart,setCart]=useState<CartLine[]>([]);const [fulfilment,setFulfilment]=useState<Basket['fulfilment']>(smartMenu?'room_delivery':hasRoomContext&&initial.room_delivery?'room_delivery':initial.pickup?'pickup':'room_delivery');const [quote,setQuote]=useState<Quote|null>(null);const [first,setFirst]=useState('');const [last,setLast]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [errorCode,setErrorCode]=useState('');const [uncertain,setUncertain]=useState(false);const [receipt,setReceipt]=useState<Receipt|null>(null);const attempt=useRef<Attempt|null>(null);const cartRef=useRef<HTMLElement>(null);
 const [replacing,setReplacing]=useState<string[]>([]);
 function openProduct(value:Product,replace:string[]=[]){setReplacing(replace);setProduct(value);}
 // All cart, identity, note and quote state is transient memory. Nothing is persisted in Web Storage.
 useEffect(()=>{let stopped=false;let controller:AbortController|undefined;const refresh=async()=>{if(document.hidden)return;controller?.abort();controller=new AbortController();try{const r=await fetch('/api/fb/hotel/'+slug+'/offer?lang='+language,{cache:'no-store',signal:controller.signal});if(r.ok){const value=await r.json();const found:NativeOutlet|undefined=value.outlets.find((o:NativeOutlet)=>o.id===initial.id);if(!stopped){setOutlet(found?{...found,products:smartMenu?found.products.filter(product=>initial.menus.some(menu=>menu.id===product.menu_id)):found.products}:{...initial,available:false,products:[]});setRoom(value.has_room_context===true);}}}catch{/* Availability is rechecked authoritatively on quote and confirmation. */}};
  const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);return()=>{stopped=true;clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
 },[slug,language,initial,smartMenu]);
 const currency=cart[0]?.currency;
 const categories=outlet.menus.flatMap(m=>m.categories);
 const canFulfil=smartMenu?outlet.room_delivery&&room:fulfilment==='pickup'?outlet.pickup:outlet.room_delivery&&room;
 const estimates=cart.map(line=>smartLineEstimate(outlet.products.find(product=>product.id===line.intent.id&&product.menu_id===line.intent.menu_id),line.intent));
 const estimatedTotal=estimates.every(value=>value!==null)?estimates.reduce<number>((total,value)=>total+(value??0),0):null;
 function report(e:unknown){const code=e instanceof ApiError?e.message:'unavailable';setErrorCode(code);setError(t.errors[code as keyof typeof t.errors]||t.errors.unavailable);}
 function add(line:LineIntent){const p=outlet.products.find(p=>p.id===line.id&&p.menu_id===line.menu_id);if(!p||cart.length>=20||smartMenu&&(!p.available||!outlet.available||!canFulfil||busy||!!quote||uncertain)){setError(t.errors.invalid_input);return;}if(currency&&p.currency!==currency){setError(t.currency);return;}setCart(v=>[...v.filter(existing=>!replacing.includes(existing.clientId)),{clientId:crypto.randomUUID(),intent:line,currency:p.currency}]);setQuote(null);setReceipt(null);setError('');setProduct(null);}
 async function review(){setBusy(true);setError('');try{const q=await post<Quote>(slug,'quote',{outlet_id:outlet.id,intent:{lines:cart.map(c=>c.intent),fulfilment,language}});setQuote(q);attempt.current=null;}catch(e){report(e);}finally{setBusy(false);}}
 async function confirm(e:FormEvent){e.preventDefault();if(!quote)return;setBusy(true);setError('');
  if(!attempt.current)attempt.current={key:crypto.randomUUID(),quote,intent:{lines:cart.map(c=>c.intent),fulfilment,language,first_name:first.trim(),last_name:last.trim(),note:note.replace(/\r\n/g,'\n')}};
  const current=attempt.current;
  try{const r=await post<Receipt>(slug,'confirm',{outlet_id:outlet.id,quote_id:current.quote.quote_id,quote_reference:current.quote.quote_reference,key:current.key,intent:current.intent});setReceipt(smartMenu?{...r,tracking_href:r.tracking_href+(r.tracking_href.includes('?')?'&':'?')+'smartmenu=1'}:r);setCart([]);setQuote(null);setFirst('');setLast('');setNote('');setUncertain(false);attempt.current=null;}
  catch(e){if(!(e instanceof ApiError)||e.message==='unavailable'){setUncertain(true);setError(t.pending);}else{report(e);if(['review_required','quote_expired'].includes(e.message)){setUncertain(false);attempt.current=null;setQuote(null);}else if(!uncertain){attempt.current=null;if(e.message==='session_expired')setQuote(null);}}}finally{setBusy(false);}
 }
 if(outlet.hidden&&!cart.length&&!quote&&!uncertain&&!receipt)return null;
 return <article hidden={concealed} id={'outlet-'+outlet.id} data-fb-order-outlet={outlet.id} data-smartmenu-ordering={smartMenu||undefined} data-fb-order-presentation={premium?'premium':'current'} className="fb-order-outlet md:col-span-2">
  <header className="fb-order-outlet-header">{outlet.image_url?<Image unoptimized src={outlet.image_url} alt="" width={1200} height={500} className="fb-order-cover"/>:null}<div><h2>{outlet.name}</h2>{outlet.description?<p>{outlet.description}</p>:null}{!outlet.available?<p role="status">{t.unavailable}</p>:null}</div></header>
  <div className="fb-order-columns"><section aria-label={outlet.name} id={smartMenu?"smartmenu-catalog":undefined} tabIndex={smartMenu?-1:undefined}>
   <FbCatalog compact={smartMenu} active={!concealed} language={language} categories={categories} items={outlet.products} listClass="fb-order-products" renderItem={p=>smartMenu?<SmartMenuProduct key={p.menu_id+p.id} product={p} language={language} available={p.available&&outlet.available} disabled={busy||!!quote||uncertain} onOpen={()=>openProduct(p)}/>:<li key={p.menu_id+p.id} data-fb-order-product={p.id}>{p.image_url?<Image unoptimized src={p.image_url} alt="" width={320} height={220}/>:null}<div><h3>{p.name}</h3>{p.kind==='combo'?<small>{t.combo}</small>:null}{p.description?<p>{p.description}</p>:null}{p.allergens?<p>{p.allergens}</p>:null}{p.dietary?<p>{p.dietary}</p>:null}<p className="fb-order-price">{p.amount_minor===null?t.unavailable:money(p.amount_minor,p.currency,language)}</p><button disabled={!p.available||!outlet.available||busy||!!quote||uncertain||!canFulfil||!!currency&&currency!==p.currency} onClick={()=>setProduct(p)}>{p.available&&outlet.available?(p.groups.length||p.kind==='combo'?t.configure:t.add):t.unavailable}</button></div></li>}/>
  </section><aside id={smartMenu?"smartmenu-cart":undefined} tabIndex={smartMenu?-1:undefined} ref={cartRef} className="fb-order-cart" aria-label={t.cart}><h3>{t.cart}</h3>
   {receipt?<div role="status"><p>{receipt.status==='registered'?t.received:publicOrderStatus(receipt.status,language)}</p><a className="fb-order-primary" href={receipt.tracking_href}>{t.follow}</a><button onClick={()=>setReceipt(null)}>{t.newOrder}</button></div>:<>
    <label className="fb-order-field">{t.fulfilment}<select aria-label={t.fulfilment} value={fulfilment} disabled={busy||!!quote||uncertain} onChange={e=>setFulfilment(e.target.value as Basket['fulfilment'])}>
     {outlet.pickup&&!smartMenu?<option value="pickup">{t.pickup}</option>:null}{outlet.room_delivery?<option value="room_delivery" disabled={!room}>{t.delivery}</option>:null}
    </select></label>{outlet.room_delivery&&!room?<p>{t.qr}</p>:null}
    {!cart.length?<p>{t.empty}</p>:<ul>{cart.map(c=>{const p=outlet.products.find(p=>p.id===c.intent.id&&p.menu_id===c.intent.menu_id);return smartMenu?<SmartMenuCartItem key={c.clientId} line={c} product={p} language={language} disabled={busy||!!quote||uncertain} onRemove={()=>setCart(v=>v.filter(x=>x.clientId!==c.clientId))} onQuantity={quantity=>setCart(v=>v.map(x=>x.clientId===c.clientId?{...x,intent:{...x.intent,quantity}}:x))}/>:<li key={c.clientId}><p>{p?.name||t.unavailable} ×{c.intent.quantity}</p>{c.intent.note?<p className="whitespace-pre-line break-words">{c.intent.note}</p>:null}<button disabled={busy||!!quote||uncertain} onClick={()=>setCart(v=>v.filter(x=>x.clientId!==c.clientId))}>{t.remove}</button></li>;})}</ul>}
    {smartMenu&&!quote&&!uncertain?<SmartMenuRecommendations outlet={outlet} cart={cart} language={language} disabled={busy||!canFulfil} onOpen={openProduct}/>:null}
    {smartMenu&&cart.length&&!quote&&estimatedTotal!==null?<p className="smartmenu-total">{smartMenuCopy[language].estimate}<strong>{money(estimatedTotal,currency!,language)}</strong></p>:null}
    {!quote?<button className="fb-order-primary" disabled={!cart.length||busy||!outlet.available||!canFulfil||uncertain} onClick={review}>{busy?t.loading:t.review}</button>:<form onSubmit={confirm} autoComplete="off">
     <ul>{quote.lines.map((l,i)=><li key={i}>{l.name} ×{l.quantity} · {money(l.total_minor,quote.currency,language)}{l.options.map(o=><p key={o.id} className="text-sm">{o.group}: {o.name} · +{money(o.unit_minor*o.quantity,quote.currency,language)}</p>)}{l.components.map((c,j)=><div key={j} className="pl-3 text-sm"><p>{c.name} ×{c.quantity}{c.extra_minor>0?' · +'+money(c.extra_minor*c.quantity,quote.currency,language):''}</p>{c.options.map(o=><p key={o.id}>{o.group}: {o.name} · +{money(o.unit_minor*o.quantity,quote.currency,language)}</p>)}</div>)}</li>)}</ul><p className="fb-order-price">{t.total}: {money(quote.total_minor,quote.currency,language)}</p><small>{t.expires} {new Date(quote.expires_at).toLocaleTimeString(language)}</small>
     <p>{t.quoteNotice}</p><p>{t.identity}</p><label className="fb-order-field">{t.first}<input name="first_name" autoComplete="off" required maxLength={80} value={first} disabled={busy||uncertain} onChange={e=>setFirst(e.target.value)}/></label><label className="fb-order-field">{t.last}<input name="last_name" autoComplete="off" required maxLength={80} value={last} disabled={busy||uncertain} onChange={e=>setLast(e.target.value)}/></label>
     <label className="fb-order-field">{t.note}<textarea maxLength={1000} value={note} disabled={busy||uncertain} onChange={e=>setNote(e.target.value)}/></label>
     <button className="fb-order-primary" disabled={busy||errorCode===`confirmation_expired`} type="submit">{busy?t.loading:uncertain?t.retry:t.confirm}</button><button disabled={busy||uncertain} type="button" onClick={()=>{setQuote(null);attempt.current=null;}}>{t.edit}</button>
    </form>}
   </>}
   {error?<p role="alert">{error}</p>:null}{errorCode==='session_expired'&&!uncertain?<button disabled={busy} onClick={async()=>{setBusy(true);try{await post(slug,'restart',{});setError('');setErrorCode('');setQuote(null);}catch(e){report(e);}finally{setBusy(false);}}}>{t.restart}</button>:null}
  </aside></div>
  {cart.length?<button className="fb-order-mobile-cart" onClick={()=>cartRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>{t.cart} · {cart.reduce((n,c)=>n+c.intent.quantity,0)}{smartMenu&&estimatedTotal!==null?" · "+money(estimatedTotal,currency!,language):null}</button>:null}
  {product?<Composer key={product.menu_id+product.id} product={product} smartMenu={smartMenu} allowAdd={!smartMenu||canFulfil&&product.available&&outlet.available&&!busy&&!quote&&!uncertain} replacing={replacing.length>0} language={language} onClose={()=>setProduct(null)} onAdd={add}/>:null}
 </article>;
}
