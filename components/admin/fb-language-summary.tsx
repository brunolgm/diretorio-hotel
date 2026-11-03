import { hasHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { FB_KINDS,FB_TABLES,FB_TRANSLATION_TABLES,FB_LIMITS } from '@/lib/fb/types';
import {readFbRows} from '@/lib/fb/pagination';
import { fbTranslationStatus } from '@/lib/fb/translations';
import { AdminSurface } from './ui';
export async function FbLanguageSummary({hotelId}:{hotelId:string}) {
 if(!await hasHotelModule('fb.menu'))return null;
 const client=await createClient();
 const summaries=await Promise.all(FB_KINDS.map(async kind=>{
  const [source,translations]=await Promise.all([
   readFbRows((from,to)=>client.from(FB_TABLES[kind]).select('*',{count:'exact'}).eq('hotel_id',hotelId).order('id').range(from,to),FB_LIMITS[kind],r=>r.id),
   readFbRows((from,to)=>client.from(FB_TRANSLATION_TABLES[kind]).select('*',{count:'exact'}).eq('hotel_id',hotelId).order('entity_id').order('language').range(from,to),FB_LIMITS[kind]*2,r=>r.entity_id+':'+r.language)
  ]);
  if(source.error||translations.error)throw new Error('Não foi possível carregar idiomas F&B.');
  return (source.data||[]).map(row=>({kind,id:row.id,name:row.name,en:fbTranslationStatus(kind,row,translations.data?.find(t=>t.entity_id===row.id&&t.language==='en')),es:fbTranslationStatus(kind,row,translations.data?.find(t=>t.entity_id===row.id&&t.language==='es'))}));
 }));
 return <AdminSurface><h2 className="font-semibold">Gastronomia · idiomas por campos da fonte PT</h2><p className="mt-2 text-sm">Traduções de outra revisão são consideradas ausentes. Conteúdo faltante usa PT.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Conteúdo</th><th className="p-2">EN</th><th className="p-2">ES</th></tr></thead><tbody>{summaries.flat().map(r=><tr key={r.kind+r.id}><td className="p-2">{r.name}</td><td className="p-2">{r.en}</td><td className="p-2">{r.es}</td></tr>)}</tbody></table></div></AdminSurface>;
}
