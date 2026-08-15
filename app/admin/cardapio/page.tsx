import { AdminComingSoonPage } from '@/components/admin/admin-coming-soon-page';
import { requireAdminAccess } from '@/lib/auth';

export default async function AdminMenuPage() {
  await requireAdminAccess('visualizador');
  return <AdminComingSoonPage title="Cardápio (F&B)" description="Espaço reservado para a futura gestão de alimentos e bebidas." />;
}
