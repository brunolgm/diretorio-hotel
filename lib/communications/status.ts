import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../security/identifiers.ts';
import { hasMinimumRole, normalizeAppRole } from '../app-roles.ts';

export class CommunicationStatusError extends Error {
  code: string; status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
export type CommunicationKind = 'banner' | 'announcement';
export type StatusAudit = (event: { actorUserId: string; hotelId: string; action: string; entityType: string; entityId: string; metadata: { is_active: boolean } }) => Promise<boolean>;
/** Same normal-session/RLS mutation for Admin and authenticated automation. Audit never authorizes the write. */
export async function setCommunicationStatus(client: SupabaseClient, input: { kind: CommunicationKind; id: string; isActive: boolean; expectedUpdatedAt?: string; administratorOnly?: boolean }, audit: StatusAudit) {
  if (!['banner','announcement'].includes(input.kind) || !isUuid(input.id) || typeof input.isActive !== 'boolean' || (input.expectedUpdatedAt !== undefined && !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) throw new CommunicationStatusError('invalid_input');
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new CommunicationStatusError('authentication_required',401);
  const profile = await client.from('profiles').select('hotel_id,role,is_active').eq('id',user.data.user.id).single();
  const p = profile.data, role = normalizeAppRole(p?.role);
  if (profile.error || !p?.hotel_id || !p.is_active || !role || !hasMinimumRole(role,input.administratorOnly ? 'administrador' : 'operador')) throw new CommunicationStatusError('authorization_required',403);
  const hotel = await client.from('hotels').select('platform_status').eq('id',p.hotel_id).single();
  if (hotel.error || !hotel.data || hotel.data.platform_status === 'archived') throw new CommunicationStatusError('hotel_unavailable',403);
  const modules = await client.rpc('get_current_hotel_modules');
  const key = input.kind === 'banner' ? 'content.banners' : 'content.announcements';
  if (modules.error || !modules.data?.some((m: {module_key: string; is_enabled: boolean}) => m.module_key === key && m.is_enabled === true)) throw new CommunicationStatusError('module_required',403);
  const table = input.kind === 'banner' ? 'hotel_promotional_banners' : 'hotel_announcements';
  const current = await client.from(table).select('id,hotel_id,is_active,updated_at').eq('id',input.id).eq('hotel_id',p.hotel_id).single();
  if (current.error || !current.data) throw new CommunicationStatusError('record_unavailable',404);
  if (input.expectedUpdatedAt && current.data.updated_at !== input.expectedUpdatedAt) throw new CommunicationStatusError('PT409',409);
  const result = await client.from(table).update({is_active:input.isActive,updated_at:new Date().toISOString()}).eq('id',input.id).eq('hotel_id',p.hotel_id).eq('updated_at',current.data.updated_at!).select('id,is_active,updated_at').maybeSingle();
  if (result.error) throw new CommunicationStatusError('status_update_unconfirmed',409);
  if (!result.data || result.data.is_active !== input.isActive) throw new CommunicationStatusError('PT409',409);
  const audited = await audit({actorUserId:user.data.user.id,hotelId:p.hotel_id,action:(input.kind === 'banner' ? 'banner' : 'announcement') + (input.isActive ? '.activated' : '.deactivated'),entityType:input.kind === 'banner' ? 'hotel_promotional_banner' : 'hotel_announcement',entityId:input.id,metadata:{is_active:input.isActive}});
  if (!audited) throw new CommunicationStatusError('status_changed_audit_unconfirmed',503);
  return {status:'communication_status_confirmed',id:result.data.id,is_active:result.data.is_active,updated_at:result.data.updated_at};
}
