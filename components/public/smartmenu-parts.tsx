import Image from 'next/image';
import {Plus, ShoppingBag, Sparkles, Layers, Minus, Trash2} from 'lucide-react';
import {money, orderCopy, type Product, type Language, type NativeOutlet} from '@/lib/fb/orders/journey';
import {smartMenuSuggestions, smartLineEstimate, type SmartCartLine} from '@/lib/fb/smartmenu';

export const smartMenuCopy = {
  pt: {details: 'Ver detalhes', suggestions: 'Para combinar com seu pedido', related: 'Complementos dos combos cadastrados pelo hotel', combo: 'Transformar em combo', explore: 'Ver opção de combo', replace: 'Substituir seleção por combo', availability: 'Disponível para pedir', browse: 'Consultar produto', estimate: 'Total estimado', decrease: 'Diminuir quantidade', increase: 'Aumentar quantidade'},
  en: {details: 'View details', suggestions: 'Pair with your order', related: 'Pairings from the hotel’s configured combos', combo: 'Make it a combo', explore: 'View combo option', replace: 'Replace selection with combo', availability: 'Available to order', browse: 'View product', estimate: 'Estimated total', decrease: 'Decrease quantity', increase: 'Increase quantity'},
  es: {details: 'Ver detalles', suggestions: 'Para combinar con tu pedido', related: 'Complementos de los combos configurados por el hotel', combo: 'Convertir en combo', explore: 'Ver opción de combo', replace: 'Sustituir selección por combo', availability: 'Disponible para pedir', browse: 'Consultar producto', estimate: 'Total estimado', decrease: 'Reducir cantidad', increase: 'Aumentar cantidad'},
};

export function SmartMenuProduct({product, language, available, disabled, onOpen}: {
  product: Product; language: Language; available: boolean; disabled: boolean; onOpen: () => void;
}) {
  const t = smartMenuCopy[language];
  return <li data-fb-order-product={product.id} className="smartmenu-product" data-has-photo={Boolean(product.image_url)}>
    {product.image_url ? <button className="smartmenu-product-photo" type="button" aria-label={t.details + ' · ' + product.name} onClick={onOpen}><Image unoptimized src={product.image_url} alt="" width={420} height={280}/></button> : null}
    <div className="smartmenu-product-copy"><h3><button type="button" onClick={onOpen}>{product.name}</button></h3>
      {product.description ? <p className="smartmenu-description">{product.description}</p> : null}
      {product.dietary ? <small>{product.dietary}</small> : null}
      <strong>{product.amount_minor === null ? orderCopy(language).unavailable : money(product.amount_minor, product.currency, language)}</strong>
      <span className="smartmenu-availability" data-available={available}>{available ? t.availability : orderCopy(language).unavailable}</span>
      <button className="smartmenu-add" type="button" disabled={disabled} onClick={onOpen}><ShoppingBag aria-hidden/>{available ? orderCopy(language).add : t.browse}</button>
    </div>
  </li>;
}

export function SmartMenuRecommendations({outlet, cart, language, disabled, onOpen}: {
  outlet: NativeOutlet; cart: SmartCartLine[]; language: Language; disabled: boolean; onOpen: (product: Product, replace?: string[]) => void;
}) {
  const {complements, combos} = smartMenuSuggestions(outlet, cart);
  const t = smartMenuCopy[language];
  return <>{complements.length ? <section className="smartmenu-recommendations" data-smartmenu-recommendations><h4><Sparkles aria-hidden/>{t.suggestions}</h4><p>{t.related}</p><ul>{complements.map(product => <li key={product.menu_id + product.id}>
    {product.image_url ? <Image unoptimized src={product.image_url} alt="" width={72} height={72}/> : null}
    <span>{product.name}<strong>{money(product.amount_minor!, product.currency, language)}</strong></span><button type="button" disabled={disabled} aria-label={orderCopy(language).add + ' · ' + product.name} onClick={() => onOpen(product)}><Plus aria-hidden/></button>
  </li>)}</ul></section> : null}
    {combos.map(({product, replace}) => <section key={product.id} className="smartmenu-combo" data-smartmenu-combo><h4><Layers aria-hidden/>{t.combo}</h4><p>{product.name} · {money(product.amount_minor!, product.currency, language)}</p><button type="button" disabled={disabled} onClick={() => onOpen(product, replace)}>{t.explore}</button></section>)}
  </>;
}

export function SmartMenuCartItem({line, product, language, disabled, onQuantity, onRemove}: {
  line: SmartCartLine; product?: Product; language: Language; disabled: boolean; onQuantity: (quantity: number) => void; onRemove: () => void;
}) {
  const t = smartMenuCopy[language];
  const estimate = smartLineEstimate(product, line.intent);
  const selectedOptions = line.intent.kind === 'item' ? line.intent.options : [];
  return <li className="smartmenu-cart-item">
    {product?.image_url ? <Image unoptimized src={product.image_url} alt="" width={90} height={80}/> : null}
    <div><strong>{product?.name || orderCopy(language).unavailable}</strong>
      {estimate !== null ? <p>{money(estimate, line.currency, language)}</p> : null}
      {product?.groups.flatMap(group => group.options).filter(option => selectedOptions.includes(option.id)).map(option => <small key={option.id}>{option.name} · +{money(option.amount_minor, line.currency, language)}</small>)}
      {line.intent.kind === 'combo' ? product?.slots?.flatMap(slot => slot.choices).filter(choice => line.intent.kind === 'combo' && line.intent.choices.some(selected => selected.id === choice.id)).map(choice => {
        const selected = line.intent.kind === 'combo' ? line.intent.choices.find(selected => selected.id === choice.id) : undefined;
        return <div key={choice.id}><small>{choice.item.name}{choice.extra_minor > 0 ? ' · +' + money(choice.extra_minor, line.currency, language) : ''}</small>{choice.item.groups.flatMap(group => group.options).filter(option => selected?.options.includes(option.id)).map(option => <small key={option.id}>{option.name} · +{money(option.amount_minor, line.currency, language)}</small>)}</div>;
      }) : null}
      {line.intent.note ? <p>{line.intent.note}</p> : null}
      <div className="smartmenu-quantity"><button type="button" aria-label={t.decrease + ' · ' + product?.name} disabled={disabled || line.intent.quantity <= 1} onClick={() => onQuantity(line.intent.quantity - 1)}><Minus aria-hidden/></button><span>{line.intent.quantity}</span><button type="button" aria-label={t.increase + ' · ' + product?.name} disabled={disabled || line.intent.quantity >= 20} onClick={() => onQuantity(line.intent.quantity + 1)}><Plus aria-hidden/></button><button type="button" aria-label={orderCopy(language).remove + ' · ' + product?.name} disabled={disabled} onClick={onRemove}><Trash2 aria-hidden/></button></div>
    </div>
  </li>;
}
