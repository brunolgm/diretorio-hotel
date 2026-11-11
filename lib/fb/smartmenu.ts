import type {NativeOutlet, Product, LineIntent} from './orders/journey.ts';

export interface SmartCartLine {clientId: string; intent: LineIntent; currency: string}

/** Relationships come exclusively from the hotel's configured combo choices. */
export function smartMenuSuggestions(outlet: NativeOutlet, cart: SmartCartLine[]) {
  if (!outlet.available || outlet.hidden || !cart.length) return {complements: [] as Product[], combos: [] as {product: Product; replace: string[]}[]};
  const currency = cart[0].currency;
  const items = new Set(cart.filter(line => line.intent.kind === 'item' && outlet.products.some(product => product.id === line.intent.id && product.menu_id === line.intent.menu_id && product.available)).map(line => line.intent.menu_id + ':' + line.intent.id));
  const complements = new Map<string, Product>();
  const combos: {product: Product; replace: string[]}[] = [];
  for (const product of outlet.products.filter(product => product.kind === 'combo' && product.available && product.amount_minor !== null && product.currency === currency && product.slots?.every(slot => slot.choices.filter(choice => choice.item.available).length >= slot.min))) {
    const choices = product.slots?.flatMap(slot => slot.choices) ?? [];
    if (!choices.some(choice => items.has(product.menu_id + ':' + choice.item.id))) continue;
    for (const choice of choices) {
      const candidate = outlet.products.find(item => item.kind === 'item' && item.id === choice.item.id && item.menu_id === product.menu_id && item.available && item.amount_minor !== null && item.currency === currency);
      if (candidate && !items.has(candidate.menu_id + ':' + candidate.id)) complements.set(candidate.menu_id + ':' + candidate.id, candidate);
    }
    // Only unambiguous one-unit, uncustomized lines can be replaced together.
    const replace: string[] = [];
    const exact = !!product.slots?.length && product.slots.every(slot => {
      if (slot.min !== 1 || slot.max !== 1 || slot.multiplicity !== 1) return false;
      const line = cart.find(line => !replace.includes(line.clientId) && line.intent.kind === 'item' && line.intent.quantity === 1 && !line.intent.note && !line.intent.options.length && line.intent.menu_id === product.menu_id && slot.choices.some(choice => choice.item.available && choice.item.id === line.intent.id));
      if (!line) return false;
      replace.push(line.clientId);
      return true;
    });
    if (exact && !cart.some(line => line.intent.kind === 'combo' && line.intent.id === product.id)) combos.push({product, replace});
  }
  return {complements: [...complements.values()].slice(0, 3), combos: combos.slice(0, 2)};
}

/** Display estimate only. The authoritative quote continues to validate every amount. */
export function smartLineEstimate(product: Product | undefined, intent: LineIntent): number | null {
  if (!product || product.amount_minor === null) return null;
  let unit = product.amount_minor;
  if (intent.kind === 'item') {
    for (const group of product.groups) for (const option of group.options) {
      if (intent.options.includes(option.id)) unit += option.amount_minor;
    }
  } else {
    for (const slot of product.slots ?? []) for (const choice of slot.choices) {
      const selected = intent.choices.find(selected => selected.id === choice.id);
      if (!selected) continue;
      unit += choice.extra_minor * slot.multiplicity;
      for (const group of choice.item.groups) for (const option of group.options) {
        if (selected.options.includes(option.id)) unit += option.amount_minor * slot.multiplicity;
      }
    }
  }
  const total = unit * intent.quantity;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}
