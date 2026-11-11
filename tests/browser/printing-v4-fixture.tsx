import {createRoot} from 'react-dom/client';
import {AdminShell} from '@/components/admin/admin-shell';
import {AdminBreadcrumbs} from '@/components/admin/ui';
import {FbWorkspaceHeader} from '@/components/admin/fb-workspace-header';
import {FbPrintingConsole} from '@/components/admin/fb-printing-console';
import {resolveAdminTheme} from '@/lib/admin-theme';
import {getAdminNavigationForRole} from '@/lib/admin-navigation';
import {fbWorkspaceLinks} from '@/lib/fb/admin-workspace';
const params=new URLSearchParams(location.search),brand=params.get('theme')??'bugan';
const names:Record<string,string>={bugan:'Bugan Recife','grand-mercure':'Grand Mercure Copacabana',mercure:'Mercure Rio Boutique Copacabana',novotel:params.has('salvador')?'Novotel Salvador Rio Vermelho':'Novotel Leme','libguest-default':'Hotel LibGuest'};
const initial=await (await fetch('/__fixture')).json();
const role=initial.access.configure?'administrador':'operador';
const links=fbWorkspaceLinks({editorial:true,orders:true,printing:true});
createRoot(document.getElementById('root')!).render(<AdminShell adminTheme={resolveAdminTheme(brand,brand)} hotelName={names[brand]} hotelCity="Dados controlados · sem tenant real" hotelLogoUrl={null} navGroups={getAdminNavigationForRole(role,undefined,{orders:true,printing:true})} userName="Homologação local" userRole={role} signOut={async()=>{}}>
 <main className="fb-workspace fb-print-page"><AdminBreadcrumbs items={[{label:'Gastronomia',href:'/admin/cardapio'},{label:'Impressão'}]}/><FbWorkspaceHeader links={links} active="printing" title="Impressão" description="Configure por setor. Acompanhe cada envio com segurança."/><p className="fb-print-fixture-note" data-fixture-note>Dados sintéticos · nenhuma impressão</p><FbPrintingConsole initial={initial}/></main>
</AdminShell>);
