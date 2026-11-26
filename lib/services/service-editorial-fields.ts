import { parseGuestServicePresentation } from '../guest-service-presentation.ts';
import type { Json } from '../../types/database';

export const SERVICE_EDITORIAL_FIELDS = ['title', 'content', 'category', 'cta', 'summary', 'hours', 'location', 'conditions'] as const;
export const SERVICE_FIELD_LABELS = {title:'Nome do serviço',content:'Descrição completa',category:'Categoria editorial',cta:'Texto do botão',summary:'Resumo curto',hours:'Horário',location:'Localização',conditions:'Condições de utilização'};
export type ServiceEditorialField = typeof SERVICE_EDITORIAL_FIELDS[number];
export type ServiceEditorialSource = {title:string;content:string|null;category:string|null;cta:string|null;guest_presentation?:unknown};
export type ServiceTranslationRow = {language:string;title?:string|null;content?:string|null;category?:string|null;cta?:string|null;guest_fields?:Json|null;editorial_state?:Json|null;updated_at?:string|null};
export type FieldState = {origin?:'auto'|'manual'|'legacy';status?:'current'|'stale'|'failed'};
export function serviceEditorialFields(source:ServiceEditorialSource):Record<ServiceEditorialField,string|null> {
  const guest=parseGuestServicePresentation(source.guest_presentation);
  return {title:source.title.trim(),content:source.content?.trim()||null,category:source.category?.trim()||null,cta:source.cta?.trim()||null,...Object.fromEntries(['summary','hours','location','conditions'].map(field=>[field,guest[field as 'summary']?.pt||null]))} as Record<ServiceEditorialField,string|null>;
}
export function serviceFieldState(row:ServiceTranslationRow|undefined,field:ServiceEditorialField):FieldState {
  const state=row?.editorial_state;
  return state&&typeof state==='object'&&!Array.isArray(state)&&state[field]&&typeof state[field]==='object'?state[field] as FieldState:{};
}
export function serviceTranslationValue(source:ServiceEditorialSource,row:ServiceTranslationRow|undefined,field:ServiceEditorialField,language=row?.language||'en') {
  if(['title','content','category','cta'].includes(field)) return (row?.[field as 'title']||'').trim()||null;
  const guest=row?.guest_fields;
  if(guest&&typeof guest==='object'&&!Array.isArray(guest)&&Object.hasOwn(guest,field)) return typeof guest[field]==='string'?guest[field].trim()||null:null;
  return parseGuestServicePresentation(source.guest_presentation)[field as 'summary']?.[language as 'en']||null;
}
export function serviceLanguageStatus(source:ServiceEditorialSource,row:ServiceTranslationRow|undefined,language:string) {
  const fields=serviceEditorialFields(source),required=SERVICE_EDITORIAL_FIELDS.filter(field=>fields[field]);
  const states=required.map(field=>({field,...serviceFieldState(row,field),value:serviceTranslationValue(source,row,field,language)}));
  const pending=states.filter(state=>!state.value||state.status==='stale'||state.status==='failed');
  return {status:states.some(state=>state.status==='stale'&&state.origin!=='auto')?'review':states.some(state=>state.status==='failed')?'failed':pending.length?'pending':'current',pending:pending.map(state=>state.field),total:required.length,complete:required.length-pending.length} as const;
}
export function eligibleServiceTranslationFields(source:ServiceEditorialSource,row:ServiceTranslationRow|undefined,language:string,force=false,replaceManual=false){
  const values=serviceEditorialFields(source);
  return SERVICE_EDITORIAL_FIELDS.filter(field=>{
    const state=serviceFieldState(row,field),value=serviceTranslationValue(source,row,field,language);
    const manual=state.origin==='manual'||state.origin==='legacy'||!state.origin&&Boolean(value);
    return values[field]&&(!manual||replaceManual)&&(force||!value||state.status==='stale'||state.status==='failed');
  });
}
export function localizeServiceEditorial<T extends ServiceEditorialSource>(source:T,row:ServiceTranslationRow|undefined,language:string):T {
  if(language==='pt') return source;
  const result={...source},guest=parseGuestServicePresentation(source.guest_presentation);
  for(const field of SERVICE_EDITORIAL_FIELDS){
    const state=serviceFieldState(row,field),value=state.status==='stale'||state.status==='failed'?null:serviceTranslationValue(source,row,field,language);
    if(['title','content','category','cta'].includes(field)) Object.assign(result,{[field]:value||source[field as 'title']});
    else guest[field as 'summary']={...guest[field as 'summary'],[language]:value||undefined};
  }
  return {...result,guest_presentation:guest};
}
