/** Optional absent source fields are not missing translations. Blank translated source text falls back to PT. */
export function hasTranslationFallback(source:Record<string,unknown>,translation:Record<string,unknown>|null|undefined,fields:readonly string[]){
 return fields.some(k=>typeof source[k]==='string'&&String(source[k]).trim()&&!(typeof translation?.[k]==='string'&&String(translation[k]).trim()));
}
export function translatedText(source:string,translation:string|null|undefined):string;
export function translatedText(source:string|null,translation:string|null|undefined):string|null;
export function translatedText(source:string|null,translation:string|null|undefined){return translation?.trim()?translation:source;}
