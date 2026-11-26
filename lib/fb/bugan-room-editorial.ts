import dictionary from './bugan-room-editorial.json' with {type: 'json'};
import type {Language, NativeOutlet, Product} from './orders/journey';
import type {RoomNameRow} from './room-name-translations';

type EditorialTranslation = {source: string; en: string; es: string};
const descriptions: Record<string, EditorialTranslation> = dictionary.descriptions;
const categories: Record<string, EditorialTranslation> = dictionary.categories;

function translated(entries: Record<string, EditorialTranslation>, kind:'item_description'|'category', id: string, source: string | null | undefined, language: Language, overrides:Map<string,RoomNameRow>) {
  const saved=overrides.get(kind+':'+id);
  // Rows carry the current authoritative source, even when the offer is already localized.
  if(language!=='pt'&&saved&&saved.revision>0&&saved.saved_source_name===saved.source_name)
    return (language==='en'?saved.name_en:saved.name_es)?.trim()||saved.source_name;
  const entry = entries[id];
  return language !== 'pt' && entry?.source === source ? entry[language] : source;
}

/** Guest presentation only: shared catalogue records and all business fields remain authoritative. */
export function localizeBuganRoomEditorial(slug: string, hotelId: string, language: Language, outlets: NativeOutlet[], rows:RoomNameRow[] = []) {
  if (language === 'pt' || slug !== dictionary.slug || hotelId !== dictionary.hotelId) return outlets;
  const overrides=new Map(rows.filter(row=>row.hotel_id===dictionary.hotelId&&row.outlet_id===dictionary.outletId).map(row=>[row.kind+':'+row.id,row]));
  function product(value: Product): Product {
    return {...value,
      ...(value.kind === 'item' ? {description: translated(descriptions, 'item_description', value.id, value.description, language, overrides)} : {}),
      ...(value.slots ? {slots: value.slots.map(slot => ({...slot,
        choices: slot.choices.map(choice => ({...choice, item: product(choice.item)})),
      }))} : {}),
    };
  }
  return outlets.map(outlet => outlet.id === dictionary.outletId ? {...outlet,
    menus: outlet.menus.map(menu => ({...menu, categories: menu.categories.map(category => ({...category,
      name: translated(categories, 'category', category.id, category.name, language, overrides) ?? category.name,
    }))})),
    products: outlet.products.map(product),
  } : outlet);
}
