import { AdminComingSoonPage } from '@/components/admin/admin-coming-soon-page';
import { requireAdminAccess } from '@/lib/auth';

export default async function AdminTourismPage() {
  await requireAdminAccess('visualizador');
  return <AdminComingSoonPage title="Turismo" description="Espaço reservado para o futuro conteúdo de turismo e recomendações locais." />;
}
