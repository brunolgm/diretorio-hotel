export function publicLanguageHref(basePath:string,language:'pt'|'en'|'es'){
 const url=new URL(basePath,'https://route.invalid');url.searchParams.set('lang',language);
 return url.pathname+url.search+url.hash;
}
