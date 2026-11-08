import {redirect} from 'next/navigation';
import {requireAdminAccess} from '@/lib/auth';
import {AdminBreadcrumbs} from '@/components/admin/ui';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {readFbWorkspaceLinks} from '@/lib/fb/admin-workspace.server';
import {FbPrintingConsole} from '@/components/admin/fb-printing-console';
import {printingConsole} from '@/lib/fb/printing/admin.server';
export const dynamic='force-dynamic';
export default async function Page(){await requireAdminAccess('operador');let initial;try{initial=await printingConsole();}catch{redirect('/admin/acesso-negado');}const links=await readFbWorkspaceLinks({operationalRole:true});return <div className="fb-workspace fb-print-page"><AdminBreadcrumbs items={[{label:'Gastronomia',href:links[0]?.href},{label:'Impressão'}]}/><FbWorkspaceHeader links={links} active="printing" title="Impressão" description="Acompanhe a operação e configure a impressão por setor."/><FbPrintingConsole initial={initial}/></div>;}
