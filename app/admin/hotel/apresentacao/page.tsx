import Link from 'next/link';
import {requireAdminAccess} from '@/lib/auth';
import {requireHotelModule} from '@/lib/admin-entitlements';
import {createClient} from '@/lib/supabase/server';
import {emptyPresentation,parsePublicPresentation} from '@/lib/public-presentation';
import {PresentationEditor} from '@/components/admin/presentation-editor';
import {savePresentationAction} from './actions';
export default async function PresentationPage({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
 const {profile}=await requireAdminAccess('editor');await requireHotelModule('experience.appearance');
 const client=await createClient();const row=await client.from('hotel_public_presentation').select('*').eq('hotel_id',profile.hotel_id).maybeSingle();
 if(row.error)throw new Error('Não foi possível carregar a apresentação.');
 const params=await searchParams;
 return <main className="mx-auto max-w-5xl space-y-6 p-4"><Link href="/admin/hotel" className="underline">Voltar ao hotel</Link><h1 className="text-2xl font-semibold">Apresentação editorial</h1><p>Benefícios e cards da Home V3. A disponibilidade continua condicionada à configuração e aos módulos do hotel.</p>
  {params.error?<p role="alert">{params.error}</p>:params.saved?<p role="status">Apresentação salva.</p>:null}
  <PresentationEditor initial={parsePublicPresentation(row.data?.configuration,profile.hotel_id)??emptyPresentation()} revision={row.data?.revision??0} action={savePresentationAction}/>
 </main>;
}
