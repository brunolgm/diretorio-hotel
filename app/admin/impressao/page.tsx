import {redirect} from 'next/navigation';
import {requireAdminAccess} from '@/lib/auth';
import {AdminPageHero} from '@/components/admin/ui';
import {FbPrintingConsole} from '@/components/admin/fb-printing-console';
import {printingConsole} from '@/lib/fb/printing/admin.server';
export const dynamic='force-dynamic';
export default async function Page(){await requireAdminAccess('operador');let initial;try{initial=await printingConsole();}catch{redirect('/admin/acesso-negado');}return <div className="space-y-6"><AdminPageHero eyebrow="Gastronomia · operação" title="Impressão" description="Bridges, destinos, roteamento e fila por setor. A impressão é independente do atendimento comercial."/><FbPrintingConsole initial={initial}/></div>;}
