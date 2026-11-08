// Real page components; data boundaries are replaced by local-only adapters in the runner.
import {createRoot} from 'react-dom/client';
import Dashboard from '@/app/admin/page';
import Services from '@/app/admin/servicos/page';
import Gastronomy from '@/app/admin/cardapio/page';
import Tourism from '@/app/admin/turismo/page';
import {AdminShell} from '@/components/admin/admin-shell';
import {resolveAdminTheme} from '@/lib/admin-theme';
import {getAdminNavigationForRole} from '@/lib/admin-navigation';

const view=new URLSearchParams(location.search).get('view')??'dashboard';
const searchParams=Promise.resolve({});
const content=view==='services'?await Services({searchParams}):view==='gastronomy'?await Gastronomy({searchParams}):view==='tourism'?await Tourism({searchParams}):await Dashboard();
createRoot(document.getElementById('root')!).render(<AdminShell adminTheme={resolveAdminTheme('bugan','bugan')} hotelName="Bugan Recife" hotelCity="Regressão local" hotelLogoUrl={null} navGroups={getAdminNavigationForRole('visualizador',undefined,{orders:false,printing:false})} userName="Perfil de leitura local" userRole="visualizador" signOut={async()=>{}}>{content}</AdminShell>);
