import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { hasHotelModule } from '@/lib/admin-entitlements';
import { translateSectionFields, type SupportedTranslationLanguage } from './translation-service';
import { SERVICE_EDITORIAL_FIELDS, eligibleServiceTranslationFields, serviceEditorialFields, serviceFieldState, serviceLanguageStatus, serviceTranslationValue, type ServiceTranslationRow } from './service-editorial-fields';
import type { Json } from '@/types/database';

/** Existing Google provider, existing child table, save-time only. PT is already committed. */
export async function syncServiceEditorialTranslations({supabase,sectionId,hotelId,languages=['en','es'],force=false,replaceManual=false}:{
  supabase:Awaited<ReturnType<typeof createClient>>;sectionId:string;hotelId:string;
  languages?:SupportedTranslationLanguage[];force?:boolean;replaceManual?:boolean;
}) {
  const successfulLanguages:SupportedTranslationLanguage[]=[],failedLanguages:SupportedTranslationLanguage[]=[];
  try {
    if(!await hasHotelModule('content.languages'))return {status:'failed' as const,successfulLanguages,failedLanguages:languages};
    // Always re-read persisted PT and row revisions; never trust a stale form or an arbitrary tenant.
    const [{data:source,error},{data:translations,error:translationError},{data:hotel}] = await Promise.all([
      supabase.from('hotel_sections').select('*').eq('id',sectionId).eq('hotel_id',hotelId).single(),
      supabase.from('hotel_section_translations').select('*').eq('section_id',sectionId),
      supabase.from('hotels').select('name,city').eq('id',hotelId).single(),
    ]);
    if(error||translationError||!source||!source.updated_at)throw Error('Service translation source unavailable');
    const fields=serviceEditorialFields(source),sourceVersion=source.updated_at;
    await Promise.all(languages.map(async language=>{
      const row=translations?.find(t=>t.language===language) as ServiceTranslationRow|undefined;
      const eligible=eligibleServiceTranslationFields(source,row,language,force,replaceManual);
      if(!eligible.length){(serviceLanguageStatus(source,row,language).status==='current'?successfulLanguages:failedLanguages).push(language);return;}
      const pending=Object.fromEntries(eligible.map(field=>[field,fields[field]]));
      const translated=await translateSectionFields(pending,language,[hotel?.name||'',hotel?.city||'']);
      const {data:accepted,error:saveError}=await supabase.rpc('save_current_hotel_service_translation',{
        p_section_id:sectionId,p_language:language,p_expected_source_version:sourceVersion,
        p_expected_translation_version:row?.updated_at??null,p_fields:(translated||pending) as Json,
        p_origin:translated?'auto':'failed',p_replace_manual:replaceManual,
      });
      if(saveError||!accepted||!translated){failedLanguages.push(language);return;}
      const remaining=SERVICE_EDITORIAL_FIELDS.some(field=>fields[field]&&!eligible.includes(field)&&(serviceFieldState(row,field).status==='stale'||!serviceTranslationValue(source,row,field,language)));
      (remaining?failedLanguages:successfulLanguages).push(language);
    }));
  }catch {for(const language of languages)if(!failedLanguages.includes(language)&&!successfulLanguages.includes(language))failedLanguages.push(language);}
  return {status:failedLanguages.length?successfulLanguages.length?'partial' as const:'failed' as const:'complete' as const,successfulLanguages,failedLanguages};
}
