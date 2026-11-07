import type {SupportedPublicLanguage} from '../public-language';

// Keep the terminology already used by the public F&B catalogue, including ES producto(s).
const units={
 pt:{item:['item','itens'],category:['categoria','categorias']},
 en:{item:['item','items'],category:['category','categories']},
 es:{item:['producto','productos'],category:['categoría','categorías']},
} as const;

export function fbCatalogCount(count:number,kind:'item'|'category',language:SupportedPublicLanguage){
 return count+' '+units[language][kind][count===1?0:1];
}
