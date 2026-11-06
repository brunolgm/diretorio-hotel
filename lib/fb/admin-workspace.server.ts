import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { hasHotelModule } from '@/lib/admin-entitlements';
import { currentOrderAccess } from './orders/operations.server';
import { currentPrintAccess } from './printing/admin.server';
import { printRpc } from './printing/rpc.server';
import { PrintBoundaryError } from './printing/validation';
import type { Commissioning } from './printing/commissioning';
import { fbWorkspaceLinks } from './admin-workspace';

export const workspaceOrderAccess = cache(currentOrderAccess);
export const workspacePrintAccess = cache(currentPrintAccess);
export async function readFbWorkspaceLinks({ editorial, operationalRole, archived = false }: { editorial?: boolean; operationalRole: boolean; archived?: boolean }) {
  const [canReadEditorial, orders, printing] = await Promise.all([
    archived ? false : editorial ?? hasHotelModule('fb.menu'),
    operationalRole ? workspaceOrderAccess() : null,
    operationalRole && !archived ? workspacePrintAccess() : null,
  ]);
  return fbWorkspaceLinks({ editorial: canReadEditorial, orders: !!orders, printing: !!printing });
}

/** Existing read-only RPC; lack of permission never implies catalog_only. */
export async function readFbWorkspaceMode(): Promise<{ mode: Commissioning['mode'] | null; unavailable: 'permission' | 'error' | null }> {
  try {
    const result = await printRpc<Commissioning>(await createClient(), 'get_current_hotel_fb_commissioning');
    if (result.mode !== 'catalog_only' && result.mode !== 'ordering') return { mode: null, unavailable: 'error' };
    return { mode: result.mode, unavailable: null };
  } catch (error) {
    return { mode: null, unavailable: error instanceof PrintBoundaryError && error.status === 403 ? 'permission' : 'error' };
  }
}
