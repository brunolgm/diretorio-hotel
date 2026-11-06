import {redirect} from 'next/navigation';
import {AdminBreadcrumbs} from '@/components/admin/ui';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {readFbWorkspaceLinks} from '@/lib/fb/admin-workspace.server';
import {FbOrdersPanel} from '@/components/admin/fb-orders-panel';
import {orderPanelPage,requireOrderShell} from '@/lib/fb/orders/operations.server';
export const dynamic='force-dynamic';
export default async function Page(){await requireOrderShell();let initial;try{initial=await orderPanelPage(new URLSearchParams());}catch{redirect('/admin/acesso-negado');}
 const links=await readFbWorkspaceLinks({operationalRole:true,archived:initial.access.hotel_status==='archived'});
 return <div className="fb-workspace"><AdminBreadcrumbs items={[{label:'Gastronomia',href:links[0]?.href},{label:'Pedidos'}]}/><FbWorkspaceHeader links={links} active="orders" title="Pedidos" description="Atenda os pedidos por setor. Cada avanço e decisão depende das permissões e da versão atual do pedido."/><FbOrdersPanel initial={initial}/></div>;
}
