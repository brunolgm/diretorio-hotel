import dictionary from './bugan-room-editorial.json' with {type: 'json'};
import type {Language, NativeOutlet, Product} from './orders/journey';

type EditorialTranslation = {source: string; en: string; es: string};
const descriptions: Record<string, EditorialTranslation> = dictionary.descriptions;
const categories: Record<string, EditorialTranslation> = dictionary.categories;

function translated(entries: Record<string, EditorialTranslation>, id: string, source: string | null | undefined, language: Language) {
  const entry = entries[id];
  return language !== 'pt' && entry?.source === source ? entry[language] : source;
}

/** Guest presentation only: shared catalogue records and all business fields remain authoritative. */
export function localizeBuganRoomEditorial(slug: string, hotelId: string, language: Language, outlets: NativeOutlet[]) {
  if (language === 'pt' || slug !== dictionary.slug || hotelId !== dictionary.hotelId) return outlets;
  function product(value: Product): Product {
    return {...value,
      ...(value.kind === 'item' ? {description: translated(descriptions, value.id, value.description, language)} : {}),
      ...(value.slots ? {slots: value.slots.map(slot => ({...slot,
        choices: slot.choices.map(choice => ({...choice, item: product(choice.item)})),
      }))} : {}),
    };
  }
  return outlets.map(outlet => outlet.id === dictionary.outletId ? {...outlet,
    menus: outlet.menus.map(menu => ({...menu, categories: menu.categories.map(category => ({...category,
      name: translated(categories, category.id, category.name, language) ?? category.name,
    }))})),
    products: outlet.products.map(product),
  } : outlet);
}
