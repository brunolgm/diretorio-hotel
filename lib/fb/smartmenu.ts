import type {NativeOutlet, Product, LineIntent} from './orders/journey.ts';

export interface SmartCartLine {clientId: string; intent: LineIntent; currency: string}

/** Relationships come exclusively from the hotel's configured combo choices. */
export function smartMenuSuggestions(outlet: NativeOutlet, cart: SmartCartLine[], skipFilledSlots = false) {
  if (!outlet.available || outlet.hidden || !cart.length) return {complements: [] as Product[], combos: [] as {product: Product; replace: string[]}[]};
  const currency = cart[0].currency;
  const items = new Set(cart.filter(line => line.intent.kind === 'item' && outlet.products.some(product => product.id === line.intent.id && product.menu_id === line.intent.menu_id && product.available)).map(line => line.intent.menu_id + ':' + line.intent.id));
  const complements = new Map<string, Product>();
  const combos: {product: Product; replace: string[]}[] = [];
  for (const product of outlet.products.filter(product => product.kind === 'combo' && product.available && product.amount_minor !== null && product.currency === currency && product.slots?.every(slot => slot.choices.filter(choice => choice.item.available).length >= slot.min))) {
    const choices = product.slots?.flatMap(slot => slot.choices) ?? [];
    if (!choices.some(choice => items.has(product.menu_id + ':' + choice.item.id))) continue;
    for (const slot of product.slots ?? []) {
      const eligible = slot.choices.filter(choice => choice.item.available);
      if (skipFilledSlots && slot.max === 1 && eligible.some(choice => items.has(product.menu_id + ':' + choice.item.id))) continue;
      for (const choice of eligible) {
        const candidate = outlet.products.find(item => item.kind === 'item' && item.id === choice.item.id && item.menu_id === product.menu_id && item.available && item.amount_minor !== null && item.currency === currency);
        if (candidate && !items.has(candidate.menu_id + ':' + candidate.id)) complements.set(candidate.menu_id + ':' + candidate.id, candidate);
      }
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

/** Compare the base combo to available standalone items, before optional modifiers. */
export function smartComboSavings(combo: Product, products: Product[]) {
  if (combo.kind !== 'combo' || !combo.available || combo.amount_minor === null || !combo.slots?.length) return null;
  let minimum = 0;
  let maximum = 0;
  for (const slot of combo.slots) {
    if (slot.min !== 1 || slot.max !== 1) return null;
    const amounts: number[] = [];
    for (const choice of slot.choices) {
      if (!choice.item.available) continue;
      const standalone = products.find(item => item.kind === 'item' && item.id === choice.item.id &&
        item.menu_id === combo.menu_id && item.currency === combo.currency && item.available);
      if (!standalone || standalone.amount_minor === null) return null;
      amounts.push((standalone.amount_minor - choice.extra_minor) * slot.multiplicity);
    }
    if (!amounts.length) return null;
    minimum += Math.min(...amounts);
    maximum += Math.max(...amounts);
  }
  const amount = minimum - combo.amount_minor;
  return Number.isSafeInteger(amount) && amount > 0 ? {amount, varies: minimum !== maximum} : null;
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
