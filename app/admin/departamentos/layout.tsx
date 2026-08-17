import type { ReactNode } from 'react'; import { requireHotelModule } from '@/lib/admin-entitlements';
export default async function Layout({ children }: { children: ReactNode }) { await requireHotelModule('content.departments'); return children; }
