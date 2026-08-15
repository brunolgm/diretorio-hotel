import { AdminComingSoonPage } from '@/components/admin/admin-coming-soon-page';
import { requireAdminAccess } from '@/lib/auth';

export default async function AdminAccessLogsPage() {
  await requireAdminAccess('administrador');
  return <AdminComingSoonPage title="Logs de Acesso" description="Espaço reservado para uma futura visão operacional de acessos, sem consultar a auditoria atual." />;
}
