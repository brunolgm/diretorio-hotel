import Link from 'next/link';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { updateCurrentHotelSlugAction } from './actions';

export default async function HotelSlugPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
 await requireAdminAccess('administrador');
 const [hotel,params]=await Promise.all([getAdminHotel(),searchParams]);
 const allowed=['draft','suspended'].includes(hotel.platform_status);
 return <main className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-slate-950">
  <Link href="/admin/hotel" className="text-sm underline">Voltar para Informações</Link>
  <h1 className="mt-6 text-2xl font-semibold">Alterar slug público</h1>
  <p className="mt-3 text-sm text-slate-600">Hotel: {hotel.name}. O subdomínio e os QR codes serão preservados. O slug anterior continuará resolvendo para o mesmo hotel quando ele estiver ativo.</p>
  {params.error?<p role="alert" className="mt-4 text-red-700">Não foi possível alterar o slug. Confira a disponibilidade, o formato e o estado de preparação do hotel.</p>:null}
  {allowed?<form action={updateCurrentHotelSlugAction} className="mt-6">
   <input type="hidden" name="expected_slug" value={hotel.slug}/>
   <label htmlFor="hotel-new-slug" className="block text-sm font-medium">Novo slug</label>
   <input id="hotel-new-slug" name="slug" defaultValue={hotel.slug} required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="mt-2 h-12 w-full rounded-xl border px-3"/>
   <p className="mt-2 text-sm text-slate-500">Use letras minúsculas, números e hífens. Este endereço precisa ser exclusivo.</p>
   <button className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-white">Salvar slug</button>
  </form>:<p className="mt-5">A alteração está disponível somente durante a preparação, com hotel em rascunho ou suspenso.</p>}
 </main>;
}