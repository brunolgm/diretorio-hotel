import type { ReactNode } from 'react';
import { requireHotelModule } from '@/lib/admin-entitlements';

export default async function FlightCenterLayout({ children }: { children: ReactNode }) {
  await requireHotelModule('travel.flights');
  return children;
}
