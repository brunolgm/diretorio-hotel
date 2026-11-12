import {redirect} from 'next/navigation';
import {FbKdsAdmin} from '@/components/admin/fb-kds-admin';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {readFbWorkspaceLinks} from '@/lib/fb/admin-workspace.server';
import {readKdsAdmin} from '@/lib/fb/kds/server';
import {requireAdminAccess} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireAdminAccess('editor');let initial;try{initial=await readKdsAdmin();}catch{redirect('/admin/acesso-negado');}const links=await readFbWorkspaceLinks({operationalRole:true});return <div className="fb-workspace"><FbWorkspaceHeader links={links} active="kds" title="KDS" description="Gerencie telas, setores e acesso da cozinha, bar e expedição."/><FbKdsAdmin initial={initial}/></div>;}
