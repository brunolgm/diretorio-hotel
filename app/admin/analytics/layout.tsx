import type { ReactNode } from 'react';
import { requireHotelModule } from '@/lib/admin-entitlements';

export default async function AdminAnalyticsLayout({ children }: { children: ReactNode }) {
  await requireHotelModule('analytics.basic');
  return children;
}
