import dictionary from './bugan-room-names.json' with {type: 'json'};
import type {Language, NativeOutlet, Product, QuoteLine} from './orders/journey';

type NameTranslation = {source: string; en: string; es: string; groupId?: string};
const names: Record<string, NameTranslation> = dictionary.names;

function inScope(slug: string, hotelId: string, outletId: string, language: Language) {
  return language !== 'pt' && slug === dictionary.slug && hotelId === dictionary.hotelId && outletId === dictionary.outletId;
}

function name(id: string, source: string, language: Language) {
  const translated = names[id];
  // A renamed or unknown record keeps its current authoritative name, never a stale translation.
  return language !== 'pt' && translated?.source === source ? translated[language] : source;
}

/** Guest labels only. Shared Filipe records, operational snapshots, prices and choices stay intact. */
export function localizeBuganRoomOutlets(slug: string, hotelId: string, language: Language, outlets: NativeOutlet[]) {
  if (!inScope(slug, hotelId, dictionary.outletId, language)) return outlets;
  function product(value: Product): Product {
    return {...value, name: name(value.id, value.name, language),
      groups: value.groups.map(group => ({...group, name: name(group.id, group.name, language),
        options: group.options.map(option => ({...option, name: name(option.id, option.name, language)}))})),
      ...(value.slots ? {slots: value.slots.map(slot => ({...slot, name: name(slot.id, slot.name, language),
        choices: slot.choices.map(choice => ({...choice, item: product(choice.item)}))}))} : {}),
    };
  }
  return outlets.map(outlet => outlet.id === dictionary.outletId ? {...outlet, products: outlet.products.map(product)} : outlet);
}

/** Translate the guest quote response after pricing; the persisted quote and confirmation are untouched. */
export function localizeBuganRoomQuoteLines(slug: string, hotelId: string, outletId: string, language: Language, lines: QuoteLine[]) {
  if (!inScope(slug, hotelId, outletId, language)) return lines;
  function line(value: QuoteLine): QuoteLine {
    return {...value, name: name(value.id, value.name, language),
      options: value.options.map(option => ({...option, name: name(option.id, option.name, language),
        group: names[option.id]?.groupId ? name(names[option.id].groupId!, option.group, language) : option.group})),
      components: value.components.map(line),
    };
  }
  return lines.map(line);
}
