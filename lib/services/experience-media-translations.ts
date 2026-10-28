import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { hasHotelModule } from '@/lib/admin-entitlements';
import { translateExperienceMediaFields } from '@/lib/services/translation-service';

export async function syncExperienceMediaTranslations({client,slot,revision,fields}:{
 client: Awaited<ReturnType<typeof createClient>>; slot:string; revision:number;
 fields:{title:string|null;description:string|null;alt_text:string|null;cta_label:string|null};
}):Promise<'complete'|'failed'|'skipped'> {
 try {
  if(!await hasHotelModule('content.languages')) return 'skipped';
  const normalized=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v?.trim()||null])) as typeof fields;
  const results=await Promise.all((['en','es'] as const).map(async language=>{
   const translated=await translateExperienceMediaFields(normalized,language);
   if(!translated)return false;
   const result=await client.rpc('save_current_hotel_experience_media_translation',{p_slot:slot,p_language:language,p_expected_revision:revision,p_fields:translated});
   return !result.error&&result.data===true;
  }));
  return results.every(Boolean)?'complete':'failed';
 } catch { return 'failed'; }
}