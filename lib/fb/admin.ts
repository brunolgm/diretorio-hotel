import type { FbKind } from './types.ts';
export function fbAdminHref(kind:FbKind,feedback:{success?:string;warning?:string;error?:string}={},id?:string,parent?:string) {
  const query=new URLSearchParams({kind});if(id)query.set('id',id);if(parent)query.set('parent',parent);
  for(const [key,value] of Object.entries(feedback))if(value)query.set(key,value);
  return '/admin/cardapio?'+query;
}
