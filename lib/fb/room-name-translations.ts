import dictionary from './bugan-room-names.json' with {type:'json'};
import editorial from './bugan-room-editorial.json' with {type:'json'};

export const ROOM_NAME_KINDS = ['item','combo','combo_slot','modifier_group','modifier_option','item_description','category'] as const;
export type RoomNameKind = typeof ROOM_NAME_KINDS[number];
export type RoomNameRow = {
  hotel_id:string; outlet_id:string; kind:RoomNameKind; id:string; source_name:string;
  context_name:string; parent_id:string|null; saved_source_name:string|null;
  name_en:string|null; name_es:string|null; revision:number;
  origin?:'reviewed'|'automatic';
  fallback_en?:string|null; fallback_es?:string|null;
};
export type RoomNameEditorRow = RoomNameRow & {stale:boolean};
export type RoomNameActionState = {error?:string;success?:string;revision?:number;saved_en?:string;saved_es?:string};
export const roomNameKindLabels:Record<RoomNameKind,string> = {
  item:'Produtos',combo:'Combos',combo_slot:'Grupos de escolhas',modifier_group:'Grupos de adicionais',modifier_option:'Adicionais',
  item_description:'Descrições de produtos',category:'Títulos de categorias',
};

export function roomTextLimit(kind:RoomNameKind) { return kind==='item_description'?10000:160; }

/** Initial reviewed names remain available until an editor explicitly saves an override. */
export function roomNameEditorRows(rows:RoomNameRow[]):RoomNameEditorRow[] {
  const defaults:Record<string,{source:string;en:string;es:string}> = dictionary.names;
  return rows.map(row=>{
    const descriptions:Record<string,{source:string;en:string;es:string}> = editorial.descriptions;
    const categories:Record<string,{source:string;en:string;es:string}> = editorial.categories;
    const initial=(row.kind==='item_description'?descriptions:row.kind==='category'?categories:defaults)[row.id];
    const matching=initial?.source===row.source_name;
    return {...row,stale:row.revision>0&&row.saved_source_name!==row.source_name,
      name_en:row.revision>0?row.name_en??'':matching?initial.en:row.fallback_en??'',
      name_es:row.revision>0?row.name_es??'':matching?initial.es:row.fallback_es??'',
    };
  });
}

export function parseRoomNameForm(form:FormData) {
  const allowed=['kind','id','source_name','revision','name_en','name_es'];
  for(const key of form.keys()) if(!allowed.includes(key)&&!key.startsWith('$ACTION_')) throw Error('invalid');
  const read=(key:string)=>{const values=form.getAll(key);if(values.length!==1||typeof values[0]!=='string')throw Error('invalid');return values[0];};
  const kind=read('kind'),id=read('id'),source_name=read('source_name'),revision=read('revision'),name_en=read('name_en'),name_es=read('name_es');
  const limit=roomTextLimit(kind as RoomNameKind);
  const invalidText=kind==='item_description'?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/;
  if(!ROOM_NAME_KINDS.includes(kind as RoomNameKind)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ||!source_name.trim()||source_name.length>limit||!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision))
    ||[name_en,name_es].some(name=>name.length>limit||invalidText.test(name))) throw Error('invalid');
  return {p_kind:kind,p_id:id,p_source_name:source_name,p_revision:Number(revision),p_name_en:name_en.trim(),p_name_es:name_es.trim()};
}
