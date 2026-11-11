import {redirect} from 'next/navigation';
import {requireAdminAccess} from '@/lib/auth';
import {AdminBreadcrumbs} from '@/components/admin/ui';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {readFbWorkspaceLinks} from '@/lib/fb/admin-workspace.server';
import {FbPrintingConsole} from '@/components/admin/fb-printing-console';
import {printingConsole} from '@/lib/fb/printing/admin.server';
import {PrintBoundaryError} from '@/lib/fb/printing/validation';
export const dynamic='force-dynamic';
export default async function Page(){
 await requireAdminAccess('operador');
 let initial;
 try{initial=await printingConsole();}
 catch(error){
  if(error instanceof PrintBoundaryError&&error.status===403)redirect('/admin/acesso-negado');
  return <section role="alert" className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-[var(--admin-text)]"><h1 className="text-xl font-semibold">Impressão temporariamente indisponível</h1><p>Não foi possível obter uma leitura atualizada. Nenhuma alteração foi confirmada.</p><a className="inline-flex min-h-11 items-center underline" href="/admin/impressao">Atualizar impressão</a></section>;
 }
 const links=await readFbWorkspaceLinks({operationalRole:true});
 return <div className="fb-workspace fb-print-page"><AdminBreadcrumbs items={[{label:'Gastronomia',href:links[0]?.href},{label:'Impressão'}]}/><FbWorkspaceHeader links={links} active="printing" title="Impressão" description="Configure por setor. Acompanhe cada envio com segurança."/><FbPrintingConsole initial={initial}/></div>;
}
