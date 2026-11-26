import dictionary from './bugan-room-names.json' with {type: 'json'};
import type {Language, NativeOutlet, Product, QuoteLine} from './orders/journey';
import type {RoomNameKind,RoomNameRow} from './room-name-translations';

type NameTranslation = {source: string; en: string; es: string; groupId?: string};
const names: Record<string, NameTranslation> = dictionary.names;

function inScope(slug: string, hotelId: string, outletId: string, language: Language) {
  return language !== 'pt' && slug === dictionary.slug && hotelId === dictionary.hotelId && outletId === dictionary.outletId;
}

function name(kind:RoomNameKind,id: string, source: string, language: Language,overrides:Map<string,RoomNameRow>,localizedSource=false) {
  const saved=overrides.get(kind+':'+id);
  if(language!=='pt'&&saved&&saved.revision>0&&saved.saved_source_name===saved.source_name&&(localizedSource||saved.source_name===source))
    return (language==='en'?saved.name_en:saved.name_es)?.trim()||saved.source_name;
  const translated = names[id];
  // A renamed or unknown record keeps its current authoritative name, never a stale translation.
  return language !== 'pt' && translated?.source === source ? translated[language] : source;
}

function scopedOverrides(rows:RoomNameRow[]) {
  return new Map(rows.filter(row=>row.hotel_id===dictionary.hotelId&&row.outlet_id===dictionary.outletId).map(row=>[row.kind+':'+row.id,row]));
}

/** Guest labels only. Shared Filipe records, operational snapshots, prices and choices stay intact. */
export function localizeBuganRoomOutlets(slug: string, hotelId: string, language: Language, outlets: NativeOutlet[],rows:RoomNameRow[] = []) {
  if (!inScope(slug, hotelId, dictionary.outletId, language)) return outlets;
  const overrides=scopedOverrides(rows);
  function product(value: Product): Product {
    return {...value, name: name(value.kind,value.id, value.name, language,overrides,value.kind==='item'),
      groups: value.groups.map(group => ({...group, name: name('modifier_group',group.id, group.name, language,overrides),
        options: group.options.map(option => ({...option, name: name('modifier_option',option.id, option.name, language,overrides)}))})),
      ...(value.slots ? {slots: value.slots.map(slot => ({...slot, name: name('combo_slot',slot.id, slot.name, language,overrides),
        choices: slot.choices.map(choice => ({...choice, item: product(choice.item)}))}))} : {}),
    };
  }
  return outlets.map(outlet => outlet.id === dictionary.outletId ? {...outlet, products: outlet.products.map(product)} : outlet);
}

/** Translate the guest quote response after pricing; the persisted quote and confirmation are untouched. */
export function localizeBuganRoomQuoteLines(slug: string, hotelId: string, outletId: string, language: Language, lines: QuoteLine[],rows:RoomNameRow[] = []) {
  if (!inScope(slug, hotelId, outletId, language)) return lines;
  const overrides=scopedOverrides(rows);
  function line(value: QuoteLine): QuoteLine {
    return {...value, name: name(value.kind==='combo'?'combo':'item',value.id, value.name, language,overrides),
      options: value.options.map(option => {
        const groupId=overrides.get('modifier_option:'+option.id)?.parent_id??names[option.id]?.groupId;
        return {...option, name: name('modifier_option',option.id, option.name, language,overrides),
          group: groupId ? name('modifier_group',groupId, option.group, language,overrides) : option.group};
      }),
      components: value.components.map(line),
    };
  }
  return lines.map(line);
}
