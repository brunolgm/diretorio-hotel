import dictionary from './bugan-room-names.json' with {type:'json'};
import type {RoomNameRow} from './room-name-translations.ts';

type Texts = Record<string,string|null>;
export type CommercialTranslationResult = {generated:number;preserved:number;pending:number;disabled:boolean};
export type CommercialTranslationSave = {
  p_kind:string;p_id:string;p_source_name:string;p_revision:number;p_name_en:string|null;p_name_es:string|null;
};
const kinds = new Set(['combo','combo_slot','modifier_group','modifier_option']);
const reviewedDefaults:Record<string,{source:string}> = dictionary.names;
// Exact, unambiguous terminology already reviewed for this menu takes precedence
// over generic machine interpretations (e.g. Refrigerante is a soft drink).
const terminology = new Map<string,{en:string;es:string}|null>();
for(const entry of Object.values(dictionary.names)) {
  const existing=terminology.get(entry.source);
  terminology.set(entry.source,existing===undefined?{en:entry.en,es:entry.es}
    :existing&&existing.en===entry.en&&existing.es===entry.es?existing:null);
}
const termFor=(row:RoomNameRow)=>terminology.get(row.source_name);
const safeText = (value:unknown):string|null => typeof value==='string'&&value.trim().length>0
  &&value.trim().length<=160&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():null;

/** Only labels reach the provider; reviewed values (including blanks) are immutable here. */
export async function syncRoomCommercialTranslations(io:{
  languagesEnabled():Promise<boolean>; load():Promise<RoomNameRow[]>;
  translate(fields:Texts,language:'en'|'es'):Promise<Texts|null>;
  save(args:CommercialTranslationSave):Promise<boolean>;
}):Promise<CommercialTranslationResult> {
  const result:CommercialTranslationResult = {generated:0,preserved:0,pending:0,disabled:false};
  if (!await io.languagesEnabled()) return {...result,disabled:true};
  const rows = (await io.load()).filter(row=>kinds.has(row.kind));
  const candidates:RoomNameRow[]=[];
  for(const row of rows) {
    const current=row.saved_source_name===row.source_name;
    if ((row.revision>0&&row.origin!=='automatic') || (row.revision===0&&Object.hasOwn(reviewedDefaults,row.id))) {
      result.preserved++;
      if(!current&&row.revision>0) result.pending++;
      if(row.revision===0&&reviewedDefaults[row.id]?.source!==row.source_name) result.pending++;
    } else if(current&&row.name_en&&row.name_es&&(!termFor(row)
      ||row.name_en===termFor(row)?.en&&row.name_es===termFor(row)?.es)) result.preserved++;
    else candidates.push(row);
  }
  if(!candidates.length) return result;
  const translated=await Promise.all((['en','es'] as const).map(async language=>{
    const fields=Object.fromEntries(candidates.flatMap((row,index)=>
      termFor(row)?.[language]||row.saved_source_name===row.source_name&&safeText(row['name_'+language as 'name_en'|'name_es'])?[]:[['label'+index,row.source_name]]));
    if(!Object.keys(fields).length) return null;
    try {return await io.translate(fields,language);} catch {return null;}
  }));
  await Promise.all(candidates.map(async(row,index)=>{
    const current=row.saved_source_name===row.source_name;
    const en=termFor(row)?.en??(current?safeText(row.name_en):null)??safeText(translated[0]?.['label'+index]);
    const es=termFor(row)?.es??(current?safeText(row.name_es):null)??safeText(translated[1]?.['label'+index]);
    if(!en&&!es) {result.pending++;return;}
    try {
      const saved=await io.save({p_kind:row.kind,p_id:row.id,p_source_name:row.source_name,
        p_revision:row.revision,p_name_en:en,p_name_es:es});
      if(saved) result.generated++;
      if(!saved||!en||!es) result.pending++;
    } catch {result.pending++;}
  }));
  return result;
}

export function commercialTranslationFeedback(status?:string) {
  if(status==='pending') return 'Rascunho salvo. Há traduções pendentes; confira a área de traduções. Os textos revisados foram preservados.';
  if(status==='disabled') return 'Rascunho salvo. A tradução automática requer o recurso de idiomas habilitado.';
  if(status==='complete') return 'Rascunho salvo. Traduções em inglês e espanhol disponíveis para revisão; textos já revisados preservados.';
  return 'Rascunho salvo para revisão.';
}
