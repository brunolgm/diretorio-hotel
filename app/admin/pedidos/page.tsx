import {redirect} from 'next/navigation';
import {AdminPageHero} from '@/components/admin/ui';
import {FbOrdersPanel} from '@/components/admin/fb-orders-panel';
import {orderPanelPage,requireOrderShell} from '@/lib/fb/orders/operations.server';
export const dynamic='force-dynamic';
export default async function Page(){await requireOrderShell();let initial;try{initial=await orderPanelPage(new URLSearchParams());}catch{redirect('/admin/acesso-negado');}
 return <div className="space-y-6"><AdminPageHero eyebrow="Gastronomia · operação" title="Pedidos" description="Atenda os pedidos por setor. Cada avanço e decisão depende das permissões e da versão atual do pedido."/><FbOrdersPanel initial={initial}/></div>;
}
