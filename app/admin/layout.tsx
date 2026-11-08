import {AdminShell} from '@/components/admin/admin-shell';
import { ReactNode } from 'react';
import { requireAdminAccess } from '@/lib/auth';
import { resolveAdminTheme } from '@/lib/admin-theme';
import { getAdminNavigationForRole } from '@/lib/admin-navigation';
import { getCurrentHotelEntitlements } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {requireOrderShell} from '@/lib/fb/orders/operations.server';
import {workspaceOrderAccess as currentOrderAccess,workspacePrintAccess as currentPrintAccess} from '@/lib/fb/admin-workspace.server';

interface AdminLayoutProps {
  children: ReactNode;
}

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const orderShell=(await headers()).get('x-libguest-orders-shell')==='1';
  const { profile } = await (orderShell?requireOrderShell():requireAdminAccess('visualizador'));
  const orderAccess=profile.normalizedRole==='visualizador'?null:await currentOrderAccess();
  if(orderShell&&!orderAccess)redirect('/acesso-indisponivel');
  const archivedDrain=orderShell&&orderAccess?.hotel_status==='archived';
  const enabledModules = archivedDrain?new Set<never>():await getCurrentHotelEntitlements();
  const printAccess=profile.normalizedRole==='visualizador'||archivedDrain?null:await currentPrintAccess();
  const navGroups = getAdminNavigationForRole(profile.normalizedRole, enabledModules, { orders: !!orderAccess, printing: !!printAccess, archivedDrain });
  const supabase = await createClient();
  const { data: hotel } = archivedDrain ? {data:orderAccess.hotel} : await supabase
    .from('hotels')
    .select('name, city, logo_url, brand_code, theme_preset')
    .eq('id', profile.hotel_id)
    .single();
  const hotelName = hotel?.name || 'Hotel';
  const hotelCity = hotel?.city || null;
  const userName = profile.full_name?.trim() || 'Usuário do hotel';
  const adminTheme = resolveAdminTheme(hotel?.brand_code, hotel?.theme_preset);

  return <AdminShell adminTheme={adminTheme} hotelName={hotelName} hotelCity={hotelCity} hotelLogoUrl={hotel?.logo_url||null} navGroups={navGroups} userName={userName} userRole={profile.normalizedRole} signOut={signOut}>{children}</AdminShell>;
}
